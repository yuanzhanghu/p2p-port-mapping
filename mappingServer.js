import EventEmitter from 'events';
import WebRTC from './webRTC.js';
import { delay } from './tool.js';

const delayMs = ms => new Promise(res => setTimeout(res, ms))

export default class MappingServer extends EventEmitter {
  constructor({ logger, onConnectMsg, version, serverKey, serviceKey_server, server_port, signalClient, signalAddress, signalPort, netCreateConnection, protocol }) {
    super()
    let self = this
    self.logger = logger
    self.version = version
    self.server_port = server_port // server port to be mapped to peer.
    self.clientDict = {}
    self.signalClient = signalClient
    self.protocol = protocol
    self.serverKey = serverKey
    self.serviceKey_server = serviceKey_server
    self.signalPort = signalPort
    self.signalAddress = signalAddress
    self.netCreateConnection = netCreateConnection

    self.signalClient.on('close', async () => {
      self.logger.info('signalClient closed.');
      /* we can add this back in future if we need to close MappingServer when signalClient temporarily closed.
      await self.close();
      self.signalClient = undefined
      self.emit("close", {serverKey: self.serverKey})
      */
    })
    self.signalClient.on('connect', () => {
      // self.signalClient.server_keep_alive({ serverKey })
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
                    const peerAnswer = new WebRTC("server_peer")
                    peerAnswer.on('connect', async (channel) => {
                      let ret = peerAnswer.isDefaultChannel(channel)
                      self.logger.info(`server side channel:${channel} connected`)
                      console.log(`server side channel:${channel} connected`)
                      if (ret) { // is default channel
                        self.sendMsg2Client(clientId, onConnectMsg)
                        console.log(`sent msg to client, onConnectMsg:${onConnectMsg}`)
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
                    })
                    peerAnswer.on('disconnected', () => {
                      if (!self.clientDict[clientId]) {
                        return
                      }
                      for (let subClientId in self.clientDict[clientId].subClientDict) {
                        self.clientDict[clientId].subClientDict[subClientId].socket2server.end()
                      }
                      // peerAnswer.close() // already disconnected, do not call close()
                      delete self.clientDict[clientId]
                      self.emit('tunnelsChange', Object.keys(self.clientDict).length)
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
                    self.emit('tunnelsChange', Object.keys(self.clientDict).length);
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

  keepUdpAlive() {
    let self = this
    // sending packet to another port periodically, to keep udp alive.
    // console.log(`sending keepalive packet`)
    if (self.signalClient) {
      self.signalClient.sendFakeData(self.signalPort, self.signalAddress)
      setTimeout(() => {
        self.keepUdpAlive()
      }, 9500) // 9.5 seconds
    }
  }

  register() {
    let self = this
    let { version } = this
    self.signalClient.server_register({
      version, serverKey: self.serverKey, server_port: self.server_port,
      serviceKey_server: self.serviceKey_server,
      protocol: self.protocol,
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
    let { signalPort, signalAddress } = this
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
