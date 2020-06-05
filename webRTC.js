const EventEmitter = require('events')
const { RTCPeerConnection, RTCSessionDescription } = require('wrtc')

const delayMs = ms => new Promise(res => setTimeout(res, ms))

class WebRTC extends EventEmitter {
  constructor({logger}) {
    super()
    this.logger = logger
    this.rtc = null
    this.dataChannels = {}
    this.type = ''
    this.nodeId = ''
    this.defaultChannel = 'datachannel'
    this.candidates = [] // candidates to be sent
    this.setRemoteDescriptionFlag = false
    this.events = {
      CONNECT: 'connect',
      DISCONNECTED: 'disconnected',
      DATA: 'data',
      CLOSE: 'close',
      SIGNAL_DESCR: 'signal_description',
      SIGNAL_CANDIDATE: 'signal_candidate',
    }
  }

  isDefaultChannel(channelName) {
    return channelName === this.defaultChannel
  }

  dataChannelCreated(label) {
    // this.logger.debug(`dataChannelCreated(): label:${label}, this.dataChannels keys:${Object.keys(this.dataChannels)}`)
    return label in this.dataChannels
  }

  createDataChannel(label) {
    try {
      const dc = this.rtc.createDataChannel(label, {
        reliable: true
      })
      this.logger.debug('createDataChannel: datachannel', dc.label, 'created.')
      this._dataChannelEvents(dc)
      this.dataChannels[label] = dc
      return dc
    } catch (dce) {
      this.logger.debug('datachannel established error: ' + dce.message)
    }
  }

  _periodicallyCheckStatus() {
    let self = this
    if (this.rtc.connectionState !== 'connected') {
      this.logger.debug(`periodicallyCheckStatus, peerconnectionstatus:${this.rtc.connectionState}`)
    }
    if(self.rtc.connectionState === 'disconnected' ||
       self.rtc.connectionState === 'closed' ||
       self.rtc.connectionState === 'failed') {
      self.emit(this.events.DISCONNECTED)
    } else {
      setTimeout( ()=> {
        self._periodicallyCheckStatus()
      }, 5000)
    }
  }

  _dataChannelEvents(channel) {
    let self = this
    channel.onopen = () => {
      this.logger.debug(`data channel:${channel.label} opened`)
      self.emit(this.events.CONNECT, channel.label)
    }
    channel.onmessage = event => {
      this.emit(this.events.DATA, {
        label: channel.label,
        data: event.data,
        nodeId: this.nodeId
      })
    }
    channel.onerror = err => {
      this.logger.debug('Datachannel Error: ' + err)
    }
    channel.onclose = () => {
      this.logger.debug('DataChannel', channel.label, 'is closed')
      this.emit(this.events.CLOSE, channel.label)
    }
  }

  _prepareNewConnection(opt) {
    let peer
    if (opt.disable_stun) {
      this.logger.debug('disable stun')
      peer = new RTCPeerConnection({
        iceServers: []
      })
    } else {
      peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun3.l.google.com:19302' },
          {
            urls: "turn:p2p.ai1to1.com:15002",
            username: "ai1to1",
            credential: "ai123",
          }
          /*
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.webrtc.ecl.ntt.com:3478' },
          { urls: 'stun:stunserver.org' },
          */
        ],
      })
    }

    peer.onicecandidate = async (evt) => {
      this.logger.debug('onicecandidate, evt:', JSON.stringify(evt))
      if (evt.candidate) { // we have candidate to signal
        if (this.type === 'offer') {
          let i
          for ( i = 0; i < 20; i++) {
            if (this.setRemoteDescriptionFlag === true) {
              break
            }
            await delayMs(1000)
          }
        }
        this.logger.debug(`${this.type==='offer'?'client':'server'} side sent candidate`)
        this.emit(this.events.SIGNAL_CANDIDATE, evt.candidate)
      }
    }

    peer.ondatachannel = evt => {
      const dataChannel = evt.channel
      this.dataChannels[dataChannel.label] = dataChannel
      this.logger.debug('ondatachannel: datachannel', dataChannel.label, 'created.')
      this._dataChannelEvents(dataChannel)
    }
    peer.onerror = err => {
      this.logger.debug(`RTCPeerConnection error:${err}`)
    }
    peer.onclose = (evt) => {
      this.logger.debug(`RTCPeerConnection closed`)
    }
    return peer
  }

  makeOffer(opt = { disable_stun: false }) {
    this.type = 'offer'
    this.rtc = this._prepareNewConnection(opt)
    this._periodicallyCheckStatus()
    this.rtc.onnegotiationneeded = async () => {
      this.logger.debug(`onnegotiationneeded is called.`)
      try {
        let offer = await this.rtc.createOffer()
        await this.rtc.setLocalDescription(offer)
        this.emit(this.events.SIGNAL_DESCR, this.rtc.localDescription)
      } catch (err) {
        console.error('setLocalDescription(offer) ERROR: ', err)
      }
    }
    this.createDataChannel(this.defaultChannel)
  }

  setRemoteDescription(sdp) {
    try {
      this.logger.debug(`${this.type==='offer'?'client':'server'} side setRemoteDescription2`)
      this.rtc.setRemoteDescription(new RTCSessionDescription(sdp))
      this.setRemoteDescriptionFlag = true
    } catch (err) {
      console.error('setRemoteDescription(answer) ERROR: ', err)
    }
  }

  async makeAnswer(sdp, opt = { disable_stun: false }) {
    this.type = 'answer'
    this.rtc = this._prepareNewConnection(opt)
    this._periodicallyCheckStatus()
    try {
      this.logger.debug(`${this.type==='offer'?'client':'server'} side setRemoteDescription1`)
      await this.rtc.setRemoteDescription(new RTCSessionDescription(sdp))
      try {
        const answer = await this.rtc.createAnswer()
        await this.rtc.setLocalDescription(answer)
        this.emit(this.events.SIGNAL_DESCR, this.rtc.localDescription)
      } catch (err) {
        console.error(err)
      }
    } catch (err) {
      console.error('setRemoteDescription(offer) ERROR: ', err)
    }
  }

  async addIceCandidate(candidate) {
    try {
      await this.rtc.addIceCandidate(candidate)
    } catch(e) {
      this.logger.debug(`failed to addIceCandidate:${JSON.stringify(candidate)}`)
    }
  }

  send(data, label) {
    if (this.dataChannels[label].readyState === 'open') {
      this.dataChannels[label].send(data)
    } else {
      this.emit(this.events.CLOSE, label)
    }
  }

  async close() {
    let self = this
    for (let label in this.dataChannels) {
      this.dataChannels[label].close()
    }
    // since we have datachannel.InternalCleanUp() crash issue.
    // rtc.close() has to be called only when all data channels closed and rtc.connectionState != 'open'
    for (let i=0; i<10; i++) {
      await delayMs(1000)
      if(self.rtc.connectionState === 'disconnected' ||
         self.rtc.connectionState === 'closed' ||
         self.rtc.connectionState === 'failed') {
        this.logger.debug(`rtc closed already`)
        return
      } else
      if(self.rtc.connectionState === 'new' || !(self.defaultChannel in this.dataChannels) ||
         this.dataChannels[self.defaultChannel].readyState === 'closed') {
        await delayMs(1000)
        this.logger.debug(`rtc.close() being called.`)
        self.rtc.close()
        return
      }
    }
    this.logger.debug(`timeout for rtc.close()`)
  }

  closeDataChannel(channelName) {
    if (channelName in this.dataChannels) {
      this.dataChannels[channelName].close()
      delete this.dataChannels[channelName]
    }
  }
}

module.exports = WebRTC
