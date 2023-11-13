import EventEmitter from 'events';
import net from 'net';
import { Logger } from './mylog.js';
import { idGenerate } from './tool.js';
import SignalClient from './signalClient.js';
import WebRTC from './webRTC.js'; // Assuming you need this

export default class MappingServer extends EventEmitter {
  constructor({ server_port, serverKey, logLevel = 'info',
    websocket_url = "https://ai1to1.com",
    iceServers = [
      'stun:stun.l.google.com:19302',
      'turn:free:free@freeturn.net:3478',
    ]
  }) {
    super();
    let self = this;
    this.logger = Logger({ moduleName: 'mappingServer', logLevel });
    // Generate service key for the server
    this.serviceKey_server = idGenerate();
    this.logger.debug(`serverKey:${serverKey}, serviceKey_server:${this.serviceKey_server}`);

    this.version = '0.1';
    this.onConnectMsg = 'welcome'; // Message sent to client upon connection establishment

    this.signalClient = new SignalClient(websocket_url);

    this.netCreateConnection = net.createConnection; // If you need it
    self.iceServers = iceServers;

    self.server_port = server_port // server port to be mapped to peer.
    self.clientDict = {}
    self.serverKey = serverKey

    self.signalClient.on('close', async () => {
      self.logger.info('signalClient closed.');
      self.emit("close", { serverKey: self.serverKey })
      /* we can add this back in future if we need to close MappingServer when signalClient temporarily closed.
      await self.close();
      self.signalClient = undefined
      self.emit("close", {serverKey: self.serverKey})
      */
    })
    self.signalClient.on('connect', () => {
      // self.signalClient.server_keep_alive({ serverKey })
      self.register();
    })

    self.signalClient.on('message', async (msgObj) => {
      let { msgType, data } = msgObj
      console.log(`from signal server, msgType:${msgType}, data:${JSON.stringify(data)}`)
      if (msgType === 'server_registered') {
        if (self.serverKey !== data.serverKey) {
          self.logger.error(`self.serverKey:${self.serverKey} !== registered serverKey:${data.serverKey}`)
          return
        }
        self.emit('server_registered', { serverKey: self.serverKey })
      } else
        if (msgType === 'messageBox') {
          self.emit('updateMessageBox', data)
        } else
          if (msgType === 'errMsg') {
            self.logger.error(`error:${JSON.stringify(data)}`)
            self.emit("error", JSON.stringify(data));
          } else
            if (msgType === 'clientSignal') {
              const { event, clientId, subClientId, buf } = data
              self.logger.info(`mappingServer: clientId:${clientId} subClientId:${subClientId}, event:${event}, buf:${buf}`)
              switch (event) {
                case 'client_signal_description': {
                  let clientSignalData = buf
                  if (clientId in self.clientDict) {
                    self.clientDict[clientId].peerAnswer.setRemoteDescription(buf)
                  } else {
                    self.logger.info(`creating peerAnswer...`)
                    const peerAnswer = new WebRTC("server_peer", this.iceServers);
                    peerAnswer.on('channel_closed', async (channel) => {
                      self.emit('channel_closed', channel);
                    });
                    peerAnswer.on('channel_connected', async (channel) => {
                      self.emit('channel_connected', channel);
                      let ret = peerAnswer.isDefaultChannel(channel)
                      self.logger.info(`server side channel:${channel} connected`)
                      console.log(`server side channel:${channel} connected`)
                      if (ret) { // is default channel
                        self.sendMsg2Client(clientId, self.onConnectMsg)
                        console.log(`sent msg to client, onConnectMsg:${self.onConnectMsg}`)
                        return
                      }
                      console.log(`trying to connect local server...`);
                      ret = await self.connect2LocalServer(clientId, channel)
                      if (ret !== true) {
                        self.logger.error(`error to connect local server for channel:${channel}`)
                      }
                      self.logger.info(`channel:${channel} connected to local server.`)
                    })
                    peerAnswer.on('signal_description', signalData => { // server response
                      self.logger.info(`server side signal generated.`)
                      self.signalClient.server_send_signal({
                        event: 'server_signal_description',
                        clientId, serverKey: self.serverKey,
                        buf: signalData,
                      })
                    })
                    peerAnswer.on('error', (err) => {
                      self.logger.error(`mappingServer error:${err}`)
                      self.emit('error', err);
                    })
                    peerAnswer.on('peer_connected', clientId => {
                      self.emit('peer_connected', clientId);
                    });
                    peerAnswer.on('peer_closed', () => {
                      self.emit('peer_closed', clientId);
                      if (!self.clientDict[clientId]) {
                        return
                      }
                      for (let subClientId in self.clientDict[clientId].subClientDict) {
                        self.clientDict[clientId].subClientDict[subClientId].socket2server.end()
                      }
                      // peerAnswer.close() // already disconnected, do not call close()
                      delete self.clientDict[clientId]
                    })
                    peerAnswer.on('signal_candidate', signalData => { // server response
                      self.signalClient.server_send_signal({
                        event: 'server_signal_candidate',
                        clientId, serverKey: self.serverKey,
                        buf: signalData,
                      })
                    })
                    peerAnswer.on('data', ({ label, data, nodeId }) => {
                      let subClientId = label;
                      if (subClientId in self.clientDict[clientId].subClientDict) {
                        // self.logger.info(`wrtc -> local server`);
                        self.clientDict[clientId].subClientDict[subClientId].socket2server.write(data);
                      }
                    });
                    self.clientDict[clientId] = {
                      subClientDict: {},
                      peerAnswer,
                    }
                    // we have remotedescription already here.
                    self.clientDict[clientId].peerAnswer.setRemoteDescription(buf);
                  }
                  break
                }
                case 'client_signal_candidate': {
                  if (!(self.clientDict[clientId])) {
                    break
                  }
                  let peerAnswer = self.clientDict[clientId].peerAnswer
                  self.logger.info(`mappingServer: addRemoteCandidate ${JSON.stringify(buf)}`);
                  peerAnswer.addRemoteCandidate(buf)
                  break
                }
                case 'disconnectRemoteServer': {
                  break
                }
                case 'clientMsg': {
                  self.emit('clientMsg', { clientId, buf })
                  break
                }
                case 'connectRemoteServer': {
                  break
                }
                case 'errMsg': {
                  self.logger.error(`error:${buf}`)
                  break
                }
                default: {
                  self.logger.error(`unknown event:${event}`)
                  break
                }
              }
            }
    })
  }

  register() {
    let self = this
    let { version } = this
    self.signalClient.server_register({
      version, serverKey: self.serverKey, server_port: self.server_port,
      serviceKey_server: self.serviceKey_server
    })
  }

  async connect2LocalServer(clientId, subClientId) {
    let self = this
    return new Promise((resolve, reject) => {
      const socket2server = self.netCreateConnection({ port: parseInt(self.server_port) }, () => {
        // 'connect' listener
        if (self.clientDict[clientId] && self.clientDict[clientId].subClientDict) {
          self.clientDict[clientId].subClientDict[subClientId].connected2LocalServer = true
        }
        self.logger.info(`connected to server for clientId:${clientId}, subClientId:${subClientId}`)
        resolve(true)
      })
      socket2server.on('data', async (data) => { // data is a Buffer
        // self.clientDict[clientId].subClientDict[subClientId].sendBufList.push(data)
        if (self.clientDict[clientId]) {
          // console.log(`local server -> webrtc, peerAnswer.sendBuf called`);
          self.clientDict[clientId].peerAnswer.sendBuf(data, subClientId)
        }
      })
      socket2server.on('end', () => {
        self.logger.info(`${subClientId} disconnected from server`)
      })
      socket2server.on('close', err => {
        self.logger.info(`socket closed with local server, err:${err}`)
        if (self.clientDict[clientId] && subClientId in self.clientDict[clientId].subClientDict) {
          try {
            self.clientDict[clientId].peerAnswer.closeDataChannel(subClientId)
          } catch (e) {
          }
          delete self.clientDict[clientId].subClientDict[subClientId]
        }
        resolve(false)
      })
      socket2server.on('error', (err) => {
        self.logger.error(`error to connect to local server, err: ${err}`)
        if (self.clientDict[clientId] && subClientId in self.clientDict[clientId].subClientDict) {
          // self.clientDict[clientId].peerAnswer.closeDataChannel(subClientId)
          delete self.clientDict[clientId].subClientDict[subClientId]
        }
        resolve(false)
      })
      if (self.clientDict[clientId]) {
        self.clientDict[clientId].subClientDict[subClientId] = {
          socket2server,
        }
      } else {
        self.logger.error(`clientId${clientId} not in self.clientDict:${Object.keys(self.clientDict)}`)
      }
    })
  }

  async sendMsg2Client(clientId, buf) {
    let self = this
    self.signalClient.server_send_signal({
      event: 'serverMsg',
      clientId, serverKey: self.serverKey,
      buf,
    })
  }

  async close() {
    let self = this
    for (let clientId in self.clientDict) {
      if (!self.clientDict[clientId]) {
        break
      }
      if (self.clientDict[clientId]) {
        let { peerAnswer, subClientDict } = self.clientDict[clientId]
        if (peerAnswer) {
          await peerAnswer.close()
        }
        for (let subClientId in subClientDict) {
          let { socket2server } = subClientDict[subClientId]
          if (socket2server) {
            socket2server.end()
          }
        }
      }
    }
    if (self.signalClient) {
      self.signalClient.close()
    }
  }
};
