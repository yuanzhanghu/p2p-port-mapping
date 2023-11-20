import net from 'net';
import EventEmitter from 'events';
import { idGenerate } from './tool.js';
import SignalClient from './signalClient.js';
import WebRTC from './webRTC.js';
import { Logger } from './mylog.js';

export default class MappingClient extends EventEmitter {
  constructor({ serverKey, localListenPort, logLevel = 'info',
    websocket_url = "https://ai1to1.com",
    iceServers = ['stun:stun.l.google.com:19302', 'turn:free:free@freeturn.net:3478'] }) {
    super();
    this.logger = Logger({ moduleName: 'mappingClient', logLevel });
    this.serviceKey_client = idGenerate();
    this.logger.debug(`serverKey:${serverKey}, serviceKey_client:${this.serviceKey_client}`);
    this.serverKey = serverKey;
    this.iceServers = iceServers;
    this.clientId = "client_" + idGenerate();
    this.peer_connected = false;
    this.peerOffer = undefined;
    this.g_subClientId = 0;
    this.subClientDict = {};
    this.websocket_url = websocket_url;
    this.localListenPort = localListenPort;
    this.client_registered = false;

    // this.client_register();
  }

  listenLocalPort(localListenPort) {
    let self = this;
    self.server = net.createServer();
    self.server.listen(localListenPort, '127.0.0.1', () => {
      self.logger.debug(`Local server bound on 127.0.0.1: ${localListenPort}`);
    });

    self.server.on('connection', (c) => {
      let subClientId = `subClientId_${self.g_subClientId++}`;
      self.logger.info(`Local client connected, subClientId:${subClientId}, peer_connected:${self.peer_connected}`);

      if (!self.peer_connected) {
        self.logger.error('Peer not connected yet.');
        c.end();
        return;
      }

      self.setupClientSocket(c, subClientId);
    });

    self.server.on('error', (err) => {
      self.logger.error(`Server error: ${err.toString()}`);
      self.emit('error', err.toString());
    });
  }

  setupClientSocket(c, subClientId) {
    let self = this;

    c.on('data', (data) => {
      if (self.peer_connected) {
        self.peerOffer.sendBuf(data, subClientId);
      } else {
        self.logger.error('Peer not connected, shutdown local socket for subClientId:', subClientId);
        c.end();
      }
    });

    c.on('error', (e) => {
      self.logger.error(`Local socket error: ${e}`);
    });

    c.on('end', () => {
      // Client disconnected
    });

    c.on('close', (err) => {
      self.logger.info(`SubClientId:${subClientId} local socket closed, err: ${err}`);
      if (self.peerOffer) {
        self.peerOffer.closeDataChannel(subClientId);
      }
      delete self.subClientDict[subClientId];
    });

    self.peerOffer.createDataChannel(subClientId);
    self.subClientDict[subClientId] = { subClientSocket: c, subClientId };
    self.emit('connection', { clientId: self.clientId, subClientId });
  }

  client_register() {
    let self = this;
    self.logger.info(`MappingClient: client_register() is called`);
    this.listenLocalPort(this.localListenPort);
    self.signalClient = new SignalClient(this.websocket_url);

    self.signalClient.on('close', () => {
      self.logger.info('Signal server disconnected');
      self.client_registered = false;
    });

    self.signalClient.on('connect', () => {
      self.signalClient.client_register({
        serverKey: self.serverKey,
        serviceKey_client: self.serviceKey_client,
        clientId: self.clientId
      });
    });

    self.signalClient.on('message', (msgObj) => {
      let { msgType, data } = msgObj;

      switch (msgType) {
        case 'client_registered':
          const { clientId, serverKey } = data;
          self.logger.info(`Client registered: ${clientId}, serverKey: ${serverKey}`);
          self.client_registered = true;
          self.emit('client_registered', { clientId, serverKey });
          break;
        case 'messageBox':
          self.emit('updateMessageBox', data);
          break;
        case 'errMsg':
          self.logger.error(`Error: ${JSON.stringify(data)}`);
          self.emit('error', JSON.stringify(data));
          break;
        case 'serverSignal':
          self.handleServerSignal(data);
          break;
        // Add other cases as needed
      }
    });
  }

  handleServerSignal(data) {
    let { event, serverKey, clientId, subClientId, buf } = data;
    this.logger.info(`SubClientId: ${subClientId}, event: ${event}, buf: ${buf}`);

    switch (event) {
      case 'server_signal_description':
        this.peerOffer.setRemoteDescription(buf);
        break;
      case 'server_signal_candidate':
        this.peerOffer.addRemoteCandidate(buf);
        break;
      case 'errMsg':
        this.logger.error(`Error: ${JSON.stringify(data)}`);
        break;
      case 'serverMsg':
        this.emit('serverMsg', buf);
        break;
      case 'remoteServer_connected':
        // Handle remote server connected event
        break;
      case 'remoteServer_disconnected':
        // Handle remote server disconnected event
        break;
      case 'remoteServer_error_connect':
        // Handle remote server connection error
        break;
      default:
        this.logger.error(`Unknown event: ${event}`);
    }
  }

  isRegistered2SignalServer() {
    return this.client_registered;
  }

  isPeerConnected() {
    return this.peer_connected;
  }

  createPeer() {
    let self = this
    // self.signalClient.emit('client_signal_description', { self.serverKey, self.clientId, signalData:'from client'})
    self.peerOffer = new WebRTC("client_peer", this.iceServers);
    self.peerOffer.on('peer_closed', async () => {
      console.log(`self.peerOffer.on('peer_closed') called.`);
      // await self.close()
      self.emit('peer_closed', self.clientId);
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
      self.emit('error', error)
      self.peer_connected = false
    })
    self.peerOffer.on('peer_connected', () => {
      self.peer_connected = true;
      self.emit('peer_connected', self.clientId);
    })
    self.peerOffer.on('channel_connected', (channel) => {
      self.logger.info(`clientId: ${self.clientId}, channel:${channel} connected.`);
      self.emit('channel_connected', { clientId: self.clientId, channel });
    })
    self.peerOffer.on('channel_closed', (channel) => {
      self.logger.info(`clientId: ${self.clientId}, channel:${channel} closed.`);
      self.emit('channel_closed', { clientId: self.clientId, channel });
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
      self.logger.info('closing peerOffer')
      await this.peerOffer.close()
      this.peerOffer = null
      self.logger.info('closed peerOffer')
    }
    if (this.server) {
      self.logger.info('closing local socket server')
      this.server.close()
      this.server = null
      self.logger.info('closed local socket server')
    }
    if (this.signalClient) {
      self.logger.info('closing signalClient')
      // this.signalClient.disconnect(true)
      this.signalClient.close()
      this.signalClient = null
      self.logger.info('closed signalClient')
    }
  }
}
