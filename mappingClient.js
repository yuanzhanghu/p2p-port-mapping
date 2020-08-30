const EventEmitter = require('events')
const WebRTC = require('./webRTC')
const wrtc = require('wrtc')
const {idGenerate, delay} = require('./tool')

class MappingClient extends EventEmitter {
  // const localServer = net.createServer()
  // const signalSocket = new SignalClient()
  constructor({ logger, serverKey, serviceKey_client, localServer, signalClient, signalPort, signalAddress}) {
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
    self.clientId = idGenerate()
    self.listeners('errMsg')
    self.signalPort = signalPort
    self.signalAddress = signalAddress

    self.signalClient.send(signalPort, signalAddress, {msgType:'client_register', data:{serverKey:self.serverKey, serviceKey_client, clientId:self.clientId}})

    self.server.on('connection', c => { // local server which map to remote server.
      // 'connection' listener
      let subClientId = self.g_subClientId
      self.logger.debug(`local client connected, subClientId:${subClientId}, peer_connected:${self.peer_connected}`)
      if (!self.peer_connected) {
        self.logger.error('peer not connected yet.')
        c.end()
        return
      }
      self.peerOffer.createDataChannel(subClientId)
      c.on('data', async (data) => { // data is a buffer
        // console.log('client side, send data to peer, data.length:', data.length)
        if (self.peer_connected) {
          // let buf = Uint8Array.from(JSON.stringify({clientId: self.clientId, subClientId, data}))
          // self.logger.debug(`send data to peer, data.length:${data.length}, subClientId:${subClientId}`)
          // let encodedData = encodeIdBuf(subClientId, data) //ArrayBuffer
          // console.log(`client side, sending data:${data}`);
          if (!self.peerOffer.dataChannelCreated(subClientId)) {
            let i = 0
            for (i = 0; i < 100; i++) { // 10s timeout
              await delay(100)
              if (self.peerOffer.dataChannelCreated(subClientId)) {
                break
              }
            }
            if (i === 10) { // timeout
              self.logger.error(`failed to create dataChannel:${subClientId}`)
              return
            }
          }
          self.peerOffer.send(data, subClientId) // data is a Buffer
        } else {
          self.logger.error('peer not connected, shutdown local socket for subClientId:', subClientId)
          c.end() // close the socket.
        }
      })
      c.on('error', (e) => {
          self.logger.error(`local socket error:${e}`)
      })
      c.on('end', () => {
        // self.logger.debug('client dispeer_connected, subClientId:', subClientId)
      })
      c.on('close', err => {
        self.logger.debug(`subClientId:${subClientId} closed, err:${err}`)
        if (self.peerOffer) {
          self.peerOffer.closeDataChannel(subClientId)
        }
        delete self.subClientDict[subClientId]
      })
      self.subClientDict[subClientId] = {subClientSocket:c, subClientId}
      self.emit('connection', { clientId:self.clientId, subClientId:self.subClientId })
      self.g_subClientId += 1
    })
    self.server.on('error', (err) => {
      // throw err
      self.logger.error(`emitting errMsg:${err.toString()}`)
      self.emit('updateStatus', err.toString())
    })

    self.signalClient.on('close', () => {
      self.logger.debug('signal server disconnected')
    })
    self.signalClient.on('message', ({msgObj, rinfo}) => {
      let {msgType, data} = msgObj
      if (msgType === 'client_registered') {
        const {clientId} = data
        self.logger.debug(`client_registered:${clientId}`)
        self.emit('client_registered', clientId)
      } else
      if (msgType === 'messageBox') {
        self.emit('updateMessageBox', data)
      } else
      if (msgType === 'errMsg') {
        self.logger.error(`error:${JSON.stringify(data)}`)
        self.emit('updateStatus', JSON.stringify(data))
      } else
      if (msgType === 'serverSignal') {
        let {event, serverKey, clientId, subClientId, buf } = data
        self.logger.debug(`subClientId:${subClientId}, event:${event}, buf:${buf}`)
        switch (event) {
          case 'server_signal_description': {
            self.peerOffer.setRemoteDescription(buf)
            break
          }
          case 'server_signal_candidate': {
            self.logger.debug(`mappingClient: addIceCandidate address:${buf.address} ` +
              `protocol:${buf.protocol} port:${buf.port} type:${buf.type} tcpType:${buf.tcpType}`)
            self.peerOffer.addIceCandidate(buf)
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
    self.peerOffer = new WebRTC({logger:self.logger})
    self.peerOffer.makeOffer({ disable_stun: false })
    self.peerOffer.on('disconnected', async () => {
      await self.close()
      self.emit('updateStatus', 'disconnected')
      self.peer_connected = false
    })
    self.peerOffer.on('signal_description', signalData => {
      self.logger.debug('offer generated.')
      self.signalClient.send(self.signalPort, self.signalAddress, {
        msgType:'clientSignal', data:{
          event: 'client_signal_description',
          clientId: self.clientId,
          serverKey: self.serverKey,
          buf: signalData
        }
      })
    })
    self.peerOffer.on('signal_candidate', signalData => {
      if (!self.signalClient) {
        return
      }
      self.signalClient.send(self.signalPort, self.signalAddress, {
        msgType:'clientSignal', data:{
          event: 'client_signal_candidate',
          clientId: self.clientId,
          serverKey: self.serverKey,
          buf: signalData
        }
      })
    })
    self.peerOffer.on('error', error => {
      self.emit('updateStatus', error)
      self.peer_connected = false
    })
    self.peerOffer.on('connect', (channel) => {
      self.logger.debug(`client side channel:${channel} connected.`)
      if(self.peerOffer.isDefaultChannel(channel)) {
        self.peer_connected = true
        self.emit('connected')
      }
    })
    self.peerOffer.on('data', ({label, data})=> { //data: ArrayBuffer
      let subClientId = label
      // self.logger.debug(`client side, received subClientId:${subClientId}, data:${data}`)
      if (subClientId in self.subClientDict) { // don't send after local socket closed.
        try {
          self.subClientDict[subClientId].subClientSocket.write(Buffer.from(data))
        } catch(e) {
          console.log(`error to write to local socket for subClientId:${subClientid}`)
          self.logger.error(`error to write to local socket for subClientId:${subClientid}`)
        }
      }
    })
  }
  async sendMsg2Server(buf) {
    let {signalPort, signalAddress } = this
    self.signalClient.send(signalPort, signalAddress, {
      msgType:'clientSignal', data:{
        event: 'clientMsg',
        clientId: self.clientId,
        serverKey: self.serverKey,
        buf,
      }
    })
  }
  async close() {
    let self = this
    if (this.peerOffer) {
      console.log('closing peerOffer')
      self.logger.debug('closing peerOffer')
      await this.peerOffer.close()
      this.peerOffer = null
    }
    if (this.server) {
      console.log('closing local socket server')
      self.logger.debug('closing local socket server')
      this.server.close()
      this.server = null
    }
    if (this.signalClient) {
      console.log('closing signalClient')
      self.logger.debug('closing signalClient')
      // this.signalClient.disconnect(true)
      this.signalClient.close()
      this.signalClient = null
    }
  }
}

module.exports = MappingClient
