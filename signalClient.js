const EventEmitter = require('events')
const { delay, encrypt, decrypt, createWord, buf2obj, obj2buf } = require('./tool')
const dgram = require('dgram')

class SignalClient extends EventEmitter {
  constructor({logger}) {
    super()
    let socket = dgram.createSocket('udp4')
    this.socket = socket
    this.closeFlag = false
    socket.on('close', () => {
      this.closeFlag = true
      this.emit('close', {})
    })
    socket.on('error', err => {
      logger.error(err)
      socket.close()
    })
    socket.on('message', (msg, rinfo) => {
      let msgObj = buf2obj(msg)
      logger.debug(`msgObj:${JSON.stringify(msgObj)}, rinfo:${JSON.stringify(rinfo)}`)
      this.msgObj = msgObj
      this.rinfo = rinfo
      this.emit('message', {msgObj, rinfo})
    })
  }

  async getMsg(timeout) {
    for (let i=0; i<timeout*100; i++) {
      if (this.msgObj) {
        let {msgObj, rinfo} = this
        this.msgObj = undefined
        this.rinfo = undefined
        return { msgObj, rinfo }
      }
      await delay(10)
    }
    return {} //timeout
  }

  sendFakeData(port, address) {
    this.socket.send(Buffer.from([1]), port, address)
  }

  send(port, address, dataObj) {
    this.msgObj = undefined
    this.rinfo = undefined
    let msg = obj2buf(dataObj)
    this.socket.send(msg, port, address)
  }

  async close() {
    this.socket.close()
    while (!this.closeFlag) {
      await delay(100)
    }
  }
}

module.exports = SignalClient
