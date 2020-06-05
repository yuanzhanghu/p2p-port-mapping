const net = require('net')
const EventEmitter = require('events')
const WebRTC = require('./webRTC')
const {delay} = require('./tool')
const wrtc = require('wrtc')

const delayMs = ms => new Promise(res => setTimeout(res, ms))

class MappingServer extends EventEmitter {
  constructor({ logger, onConnectMsg, version, serverKey, serviceKey_server, server_port, signalClient, signalPort, signalAddress, netCreateConnection }) {
    super()
    let self = this
    self.logger = logger
    self.version = version
    self.server_port = server_port // server port to be mapped to peer.
    self.clientDict = {}
    self.signalClient = signalClient
    self.serverKey = serverKey
    self.serviceKey_server = serviceKey_server
    self.signalPort = signalPort
    self.signalAddress = signalAddress
    self.netCreateConnection = netCreateConnection
    self.keepUdpAlive()

    self.signalClient.on('close', () => {
      self.logger.debug('signalClient closed.')
      self.signalClient = undefined
    })

    self.signalClient.on('message', async ({rinfo, msgObj}) => {
      let {msgType, data} = msgObj
      self.logger.debug(`from signal server, msgType:${msgType}, data:${JSON.stringify(data)}`)
      if (msgType === 'server_registered') {
        if (self.serverKey !== data.serverKey) {
          self.logger.error(`self.serverKey:${self.serverKey} !== registered serverKey:${data.serverKey}`)
          return
        }
        self.emit('server_registered', {serverKey:self.serverKey})
      } else
      if (msgType === 'messageBox') {
        self.emit('updateMessageBox', data)
      } else
      if (msgType === 'errMsg') {
        self.logger.error(`error:${JSON.stringify(data)}`)
      } else
      if (msgType === 'clientSignal') {
        const { event, clientId, subClientId, buf } = data
        self.logger.debug(`mappingServer: clientId:${clientId} subClientId:${subClientId}, event:${event}, buf:${buf}`)
        switch(event) {
          case 'client_signal_description': {
            let clientSignalData = buf
            if (clientId in self.clientDict) {
              self.clientDict[clientId].peerAnswer.setRemoteDescription(buf)
            } else {
              self.logger.debug(`creating peerAnswer...`)
              const peerAnswer = new WebRTC({logger:self.logger})
              peerAnswer.on('connect', async (channel) => {
                let ret = peerAnswer.isDefaultChannel(channel)
                self.logger.debug(`server side channel:${channel} connected`)
                console.log(`server side channel:${channel} connected`)
                if (ret) { // is default channel
                  self.sendMsg2Client(clientId, onConnectMsg)
                  console.log(`sent msg to client, onConnectMsg:${onConnectMsg}`)
                  return
                }
                ret = await self.connect2LocalServer(clientId, channel)
                if (ret !== true) {
                  self.logger.error(`error to connect local server for channel:${channel}`)
                }
                self.logger.debug(`channel:${channel} connected to local server.`)
              })
              peerAnswer.on('signal_description', signalData => { // server response
                self.logger.debug(`server side signal generated.`)
                self.signalClient.send(signalPort, signalAddress, {
                  msgType:'serverSignal', data:{
                    event: 'server_signal_description',
                    clientId, serverKey:self.serverKey,
                    buf: signalData,
                  }
                })
              })
              peerAnswer.on('error', (err) => {
                self.logger.error(`mappingServer error:${err}`)
              })
              peerAnswer.on('disconnected', () => {
                if(!self.clientDict[clientId]) {
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
                self.signalClient.send(signalPort, signalAddress, {
                  msgType:'serverSignal', data:{
                    event: 'server_signal_candidate',
                    clientId, serverKey:self.serverKey,
                    buf: signalData,
                  }
                })
              })
              peerAnswer.on('data', async ({ label, data, nodeId}) => { // data is ArrayBuffer
                // console.log(`server side, received subClientId:${label}, data:${data}`)
                let subClientId = label
                // data = Buffer.from(data.data)
                // self.logger.debug(`received peer data, buf.length:${buf.length} from clientId:${clientId} subClientId:${subClientId}`)
                let i = 0
                for (i=0; i<20; i++) { // timeout 2 seconds
                  if(!self.clientDict[clientId]) {
                    return
                  }
                  if(subClientId in self.clientDict[clientId].subClientDict) {
                    break
                  }
                  await delay(100)
                }
                if (i === 20) {
                  // timeout
                  return
                }
                if(self.clientDict[clientId]) {
                  self.clientDict[clientId].subClientDict[subClientId].socket2server.write(Buffer.from(data))
                }
              })
              self.clientDict[clientId] = {
                subClientDict:{},
                peerAnswer,
              }
              self.emit('tunnelsChange', Object.keys(self.clientDict).length)
              await peerAnswer.makeAnswer(clientSignalData, { disable_stun: false})
            }
            break
          }
          case 'client_signal_candidate': {
            if(!(self.clientDict[clientId])) {
              break
            }
            let peerAnswer = self.clientDict[clientId].peerAnswer
            self.logger.debug(`mappingClient: addIceCandidate address:${buf.address} ` +
              `protocol:${buf.protocol} port:${buf.port} type:${buf.type} tcpType:${buf.tcpType}`)
            peerAnswer.addIceCandidate(buf)
            break
          }
          case 'disconnectRemoteServer': {
            break
          }
          case 'clientMsg': {
            self.emit('clientMsg', {clientId, buf})
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
      setTimeout(() => {
        self.keepUdpAlive()
        self.signalClient.send(self.signalPort, self.signalAddress, {
            msgType:'keep_alive',
            data:{serverKey:self.serverKey, serviceKey_server:self.serviceKey_server},
        })
      }, 9500) // 9.5 seconds
    }
  }

  register () {
    let self = this
    let {version} = this
    self.signalClient.send(self.signalPort, self.signalAddress, {
        msgType:'server_register',
        data:{version, serverKey:self.serverKey, server_port:self.server_port, serviceKey_server:self.serviceKey_server},
    })
  }

  async connect2LocalServer(clientId, subClientId) {
    let self = this
    return new Promise( (resolve, reject) => {
      const socket2server = self.netCreateConnection({ port: parseInt(self.server_port)}, () => {
        // 'connect' listener
        if (self.clientDict[clientId] && self.clientDict[clientId].subClientDict) {
          self.clientDict[clientId].subClientDict[subClientId].connected2LocalServer = true
        }
        self.logger.debug(`connected to server for clientId:${clientId}, subClientId:${subClientId}`)
        resolve(true)
      })
      socket2server.on('data', async (data) => { // data is a Buffer
        // self.clientDict[clientId].subClientDict[subClientId].sendBufList.push(data)
        if (self.clientDict[clientId]) {
          self.clientDict[clientId].peerAnswer.send(data, subClientId)
        }
      })
      socket2server.on('end', () => {
        self.logger.debug(`${subClientId} disconnected from server`)
      })
      socket2server.on('close', err => {
        self.logger.debug(`socket closed with local server, err:${err}`)
        if (self.clientDict[clientId] && subClientId in self.clientDict[clientId].subClientDict) {
          try {
            self.clientDict[clientId].peerAnswer.closeDataChannel(subClientId)
          } catch(e) {
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
    let {signalPort, signalAddress} = this
    self.signalClient.send(signalPort, signalAddress, {
      msgType:'serverSignal', data:{
        event: 'serverMsg',
        clientId, serverKey:self.serverKey,
        buf,
      }
    })
  }

  async close() {
    let self = this
    for (let clientId in self.clientDict) {
      if(!self.clientDict[clientId]){
        break
      }
      if (self.clientDict[clientId])
      {
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
}

module.exports = MappingServer
