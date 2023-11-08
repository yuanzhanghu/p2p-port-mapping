import EventEmitter from 'events';
import { delay, idGenerate } from './tool.js';
import WebRTC from './webRTC.js';

export default class MappingClient extends EventEmitter {
  // const localServer = net.createServer()
  // const signalSocket = new SignalClient()
  constructor({ logger, serverKey, serviceKey_client, localServer, signalClient, signalPort, signalAddress }) {
    super()
    let self = this;
    self.logger = logger;
    self.serverKey = serverKey // process.argv[2]
    self.peer_connected = false
    self.peerOffer = undefined
    self.g_subClientId = 0
    self.subClientDict = {} // to save each clientSocket for subClient
    self.server = localServer
    self.signalClient = signalClient
    self.clientId = "client_" + idGenerate()
    self.listeners('errMsg')
    self.signalPort = signalPort
    self.signalAddress = signalAddress

    self.signalClient.client_register({ serverKey: self.serverKey, serviceKey_client, clientId: self.clientId })

    self.server.on('connection', c => { // local server which map to remote server.
      // 'connection' listener
      let subClientId = `subClientId_${self.g_subClientId}`;
      self.logger.info(`local client connected, subClientId:${subClientId}, peer_connected:${self.peer_connected}`)
      if (!self.peer_connected) {
        self.logger.error('peer not connected yet.')
        c.end()
        return
      }
      c.on('data', (data) => {
        if (self.peer_connected) {
          // self.logger.info(`local socket data: ${data}`);
          // Define the sendLogic as an async function with a retry limit
          //self.logger.debug(`${subClientId} channel connected, sending data: ${data}`);
          // console.log(`client -> wrtc`);
          self.peerOffer.sendBuf(data, subClientId);
        } else {
          self.logger.error('Peer not connected, shutdown local socket for subClientId:', subClientId);
          c.end(); // Close the socket.
        }
      });
      c.on('error', (e) => {
        self.logger.error(`local socket error:${e}`)
      })
      c.on('end', () => {
        // self.logger.info('client dispeer_connected, subClientId:', subClientId)
      })
      c.on('close', err => {
        self.logger.info(`subClientId:${subClientId} closed, err:${err}`)
        if (self.peerOffer) {
          self.peerOffer.closeDataChannel(subClientId)
        }
        delete self.subClientDict[subClientId]
      })
      self.peerOffer.createDataChannel(subClientId);
      self.subClientDict[subClientId] = { subClientSocket: c, subClientId };
      self.emit('connection', { clientId: self.clientId, subClientId: self.subClientId });
      self.g_subClientId += 1
    })
    self.server.on('error', (err) => {
      // throw err
      self.logger.error(`emitting errMsg:${err.toString()}`)
      self.emit('updateStatus', err.toString())
    })

    self.signalClient.on('close', () => {
      self.logger.info('signal server disconnected')
    })
    self.signalClient.on('message', (msgObj) => {
      let { msgType, data } = msgObj
      if (msgType === 'client_registered') {
        const { clientId, server_key, protocol } = data
        self.logger.info(`client_registered:${clientId}, server_key:${serverKey}, protocol:${protocol}`);
        self.emit('client_registered', { clientId, serverKey, protocol })
      } else
        if (msgType === 'messageBox') {
          self.emit('updateMessageBox', data)
        } else
          if (msgType === 'errMsg') {
            self.logger.error(`error:${JSON.stringify(data)}`)
            self.emit('updateStatus', JSON.stringify(data))
          } else
            if (msgType === 'serverSignal') {
              let { event, serverKey, clientId, subClientId, buf } = data
              self.logger.info(`subClientId:${subClientId}, event:${event}, buf:${buf}`)
              switch (event) {
                case 'server_signal_description': {
                  self.peerOffer.setRemoteDescription(buf)
                  break
                }
                case 'server_signal_candidate': {
                  self.logger.info(`mappingClient: addRemoteCandidate ${JSON.stringify(buf)}`);
                  self.peerOffer.addRemoteCandidate(buf)
                  break
                }
                case 'errMsg': {
                  self.logger.error(`error:${JSON.stringify(data)}`)
                  break
                }
                case 'serverMsg': {
                  self.emit('serverMsg', buf)
                  break
                }
                case 'remoteServer_connected': {
                  break
                }
                case 'remoteServer_disconnected': {
                  break
                }
                case 'remoteServer_error_connect': {
                  break
                }
                default: {
                  self.logger.error(`unknown event:${event}`)
                }
              }
            }
    })
  }

  createPeer() {
    let self = this
    // self.signalClient.emit('client_signal_description', { self.serverKey, self.clientId, signalData:'from client'})
    self.peerOffer = new WebRTC("client_peer");
    self.peerOffer.on('disconnected', async () => {
      console.log(`self.peerOffer.on('disconnected') called.`);
      await self.close()
      self.emit('updateStatus', 'disconnected')
      self.peer_connected = false
    })
    self.peerOffer.on('signal_description', signalData => {
      self.logger.info('offer generated.')
      self.signalClient.client_send_signal({
        event: 'client_signal_description',
        clientId: self.clientId,
        serverKey: self.serverKey,
        buf: signalData
      })
    })
    self.peerOffer.on('signal_candidate', signalData => {
      if (!self.signalClient) {
        return
      }
      self.signalClient.client_send_signal({
        event: 'client_signal_candidate',
        clientId: self.clientId,
        serverKey: self.serverKey,
        buf: signalData
      })
    })
    self.peerOffer.on('error', error => {
      self.emit('updateStatus', error)
      self.peer_connected = false
    })
    self.peerOffer.on('connect', (channel) => {
      self.logger.info(`client side channel:${channel} connected.`)
      if (self.peerOffer.isDefaultChannel(channel)) {
        self.peer_connected = true
        self.emit('connected')
      }
    })
    self.peerOffer.on('data', ({ label, data }) => { //data: Buffer
      let subClientId = label
      // self.logger.debug(`client side, received subClientId:${subClientId}, data:${data}`)
      if (subClientId in self.subClientDict) { // don't send after local socket closed.
        try {
          // console.log(`wrtc -> client`);
          self.subClientDict[subClientId].subClientSocket.write(data);
        } catch (e) {
          console.log(`error to write to local socket for subClientId:${subClientid}`)
          self.logger.error(`error to write to local socket for subClientId:${subClientid}`)
        }
      }
    })
    self.peerOffer.createDefaultDataChannel();
  }
  async sendMsg2Server(buf) {
    let { signalPort, signalAddress } = this
    self.signalClient.client_send_signal({
      event: 'clientMsg',
      clientId: self.clientId,
      serverKey: self.serverKey,
      buf,
    })
  }
  async close() {
    let self = this
    if (this.peerOffer) {
      console.log('closing peerOffer')
      self.logger.info('closing peerOffer')
      await this.peerOffer.close()
      this.peerOffer = null
    }
    if (this.server) {
      console.log('closing local socket server')
      self.logger.info('closing local socket server')
      this.server.close()
      this.server = null
    }
    if (this.signalClient) {
      console.log('closing signalClient')
      self.logger.info('closing signalClient')
      // this.signalClient.disconnect(true)
      this.signalClient.close()
      this.signalClient = null
    }
  }
}
