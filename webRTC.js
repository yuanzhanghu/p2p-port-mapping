import EventEmitter from 'events';
import { maxHeaderSize } from 'http';
import nodeDataChannel from 'node-datachannel';
const delayMs = ms => new Promise(res => setTimeout(res, ms));
const BUFFER_SIZE = 10 * 1024;   // set buffer size to 0

class WebRTC extends EventEmitter {
  constructor(nodeId) {
    super();
    this.init(nodeId);
  }

  async init(nodeId) {
    this.dataChannels = {};
    this.nodeId = nodeId;
    this.defaultChannel = 'datachannel';
    this.setRemoteDescriptionFlag = false;
    this.messageQueues = {};
    this.sendIntervals = {}; // interval functions for each label
    this.events = {
      CONNECT: 'connect',
      DISCONNECTED: 'disconnected',
      DATA: 'data',
      CLOSE: 'close',
      SIGNAL_DESCRIPTION: 'signal_description',
      SIGNAL_CANDIDATE: 'signal_candidate'
    };
    this.initializePeerConnection(['stun:stun.l.google.com:19302']);
  }

  isDefaultChannel(channelName) {
    return channelName === this.defaultChannel
  }

  createDefaultDataChannel() {
    return this.createDataChannel(this.defaultChannel);
  }
  // The rest of your methods would need to be updated similarly
  // For example:
  createDataChannel(label) {
    if (this.peerConnection) {
      try {
        console.log('createDataChannel: datachannel', label);
        let dc = this.peerConnection.createDataChannel(label);
        this.setupDataChannelEvents(dc);
        this.dataChannels[label] = { dc, "opened": false };
        return dc;
      } catch (error) {
        console.log('DataChannel establishment error:', error.message);
      }
    } else {
      console.log('PeerConnection has not been initialized.');
    }
  }

  closeDataChannel(label) {
    if (this.dataChannels[label]) {
      console.log(`Closing data channel: ${label}`);
      try {
        this.dataChannels[label].dc.close(); // Close the data channel
        delete this.dataChannels[label]; // Remove the reference from the dictionary
        this.emit(this.events.CLOSE, label); // Emit a close event
        if (label in this.messageQueues) {
          delete this.messageQueues[label];
        }
        if (label in this.sendIntervals) {
          console.log(`closed sendIntervals2 for channel:${label}`);
          clearInterval(this.sendIntervals[label]);
          delete this.sendIntervals[label];
        }
      } catch (error) {
        console.error(`Error closing data channel ${label}:`, error);
      }
    } else {
      console.log(`Data channel with label "${label}" does not exist or has already been closed.`);
    }
  }

  setupDataChannelEvents(dc) {
    dc.onOpen(async () => {
      await delayMs(100); // Wait a bit for all events to process
      let label = dc.getLabel();
      console.log(`Data channel ${label} opened`);
      this.dataChannels[label]["opened"] = true
      if (label !== this.defaultChannel) {
        this.sendIntervals[label] = setInterval(() => {
          this._tryToSend(label);
        }, 10);
      }
      this.emit(this.events.CONNECT, label);
    });

    dc.onMessage((msg, isBinary) => {
      this.emit(this.events.DATA, {
        label: dc.getLabel(),
        data: msg,
        nodeId: this.nodeId
      });
    });

    dc.onClosed(() => {
      const channel = dc.getLabel();
      console.log(`DataChannel ${channel} is closed`);
      if (channel in this.dataChannels) {
        delete this.dataChannels[channel]
      }
      if (channel in this.messageQueues) {
        delete this.messageQueues[channel];
      }
      if (channel in this.sendIntervals) {
        console.log(`closed sendIntervals for channel:${channel}`);
        clearInterval(this.sendIntervals[channel]);
        delete this.sendIntervals[channel];
      }
      this.emit(this.events.CLOSE, channel);
    });

    dc.onError((error) => {
      console.log(`DataChannel error: ${error}`);
    });
  }

  // Initialize the PeerConnection using node-datachannel
  initializePeerConnection(iceServers = []) {
    // Initialize logger if needed
    nodeDataChannel.initLogger('Info');

    console.log(`nodeId: ${this.nodeId}, iceServers:${iceServers}, typeof iceServers:${typeof (iceServers)}`);
    console.log(`nodeDataChannel: ${JSON.stringify(nodeDataChannel)}`);
    this.peerConnection = new nodeDataChannel.PeerConnection(this.nodeId, { iceServers: ['stun:stun3.l.google.com:19302'] });

    // Setup peer connection events
    this.peerConnection.onLocalDescription((sdp, type) => {
      console.log(`onLocalDescription: ${sdp}, ${type}`);
      this.emit(this.events.SIGNAL_DESCRIPTION, { sdp, type });
    });

    this.peerConnection.onLocalCandidate((candidate, mid) => {
      console.log(`onLocalCandidate: ${candidate}, ${mid}`);
      this.emit(this.events.SIGNAL_CANDIDATE, { candidate, mid });
    });

    this.peerConnection.onDataChannel((dc) => {
      console.log('New DataChannel:', dc.getLabel());
      this.dataChannels[dc.getLabel()] = { dc, "opened": false }
      this.setupDataChannelEvents(dc);
      this.emit(this.DATACHANNEL_CREATED, dc.getLabel());
    });

    this.peerConnection.onStateChange((state) => {
      console.log(`peerConnection state changed: ${state}`);
      if (state === 'disconnect') {
        this.emit(this.events.DISCONNECTED);
      }
    });

  }

  setRemoteDescription({ sdp, type }) {
    if (!this.peerConnection) {
      console.error('PeerConnection has not been initialized.');
      return;
    }

    try {
      this.peerConnection.setRemoteDescription(sdp, type);
      this.setRemoteDescriptionFlag = true; // This flag might be used to check if the remote description was set.
    } catch (error) {
      console.error('Failed to set remote description:', error);
    }
  }

  dataChannelConnected(subClientId) {
    if (subClientId in this.dataChannels) {
      return this.dataChannels[subClientId].opened;
    }
    return false;
  }

  addRemoteCandidate({ candidate, mid }) {
    // ${buf.address} ` + `protocol:${buf.protocol} port:${buf.port} type:${buf.type} tcpType:${buf.tcpType}`)
    if (!this.peerConnection) {
      console.error('PeerConnection has not been initialized.');
      return;
    }
    try {
      this.peerConnection.addRemoteCandidate(candidate, mid);
    } catch (error) {
      console.error('Failed to add remote ICE candidate:', error);
    }
  }

  sendBuf(buf, label) {
    if (label in this.dataChannels) {
      if (!(label in this.messageQueues)) {
        this.messageQueues[label] = [];
        this._setupBufferedAmountLowHandler(label);
      }
      // console.error(`pushed buf`);
      this.messageQueues[label].push(buf);
    } else {
      console.error(`sendBuf: Data channel with label "${label}" does not exist.`);
    }
  }

  _setupBufferedAmountLowHandler(label) {
    console.log(`setup onBufferedAmountLow`);
    this.dataChannels[label].dc.setBufferedAmountLowThreshold(BUFFER_SIZE);
    this.dataChannels[label].dc.onBufferedAmountLow(() => {
      // console.log(`onBufferedAmountLow triggered`);
      this._tryToSend(label);
    });
  }

  _tryToSend(label) {
    if (!this.messageQueues[label] || !this.dataChannels[label] || !this.dataChannels[label].opened) {
      console.error(`_tryToSend: message queue or data channel does not exist`);
      return;
    }
    while (this.messageQueues[label].length > 0 &&
      this.dataChannels[label].dc.bufferedAmount() <= BUFFER_SIZE &&
      this.dataChannels[label].opened) {
      const message = this.messageQueues[label].shift();
      // console.log(`sendMessageBinary buf`);
      this.dataChannels[label].dc.sendMessageBinary(message);
    }
  }

  async close() {
    for (const label in this.dataChannels) {
      this.dataChannels[label].dc.close();
      delete this.dataChannels[label];
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Optionally, if you want to make sure everything is cleaned up
    await delayMs(1000); // Wait a bit for all events to process
    nodeDataChannel.cleanup();
  }
}

export default WebRTC;
