import EventEmitter from 'events';
import { delay, decrypt, createWord } from './tool.js';
import io from 'socket.io-client';

export default class SignalClient extends EventEmitter {
  constructor(url = 'https://ai1to1.com') {
    super();
    this.socket = null;
    this.connected = false;
    this.connectToServer(url);
  }

  connectToServer(url) {
    const NAMESPACE = '/api/netptop/websocket';
    this.socket = io.connect(url + NAMESPACE, {
      transports: ['websocket']  // Use WebSockets only; optional
    });

    this.socket.on('connect', () => {
      console.log(`socket.io connected`);
      this.connected = true;
      this.emit('connect');
    });

    this.socket.on('message', (data) => {
      console.log(`socket.io message received: ${JSON.stringify(data)}`);
      let parsedData = data;
      this.emit('message', parsedData);
    });

    this.socket.on('error', (err) => {
      console.error("WebSocket error:", err);
      this.emit('error', err);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`socket.io disconnected: ${reason}`);
      this.connected = false;
      this.emit('close', reason);
    });
  }

  async server_keep_alive(data) {
    this._sendData('server_keep_alive', data);
  }

  async client_keep_alive(data) {
    this._sendData('client_keep_alive', data);
  }

  async server_register(data) {
    while (!this.connected) {
      console.log(`waiting for connection established for socket.io`);
      await delay(1000); // Wait for 1s
    }
    this._sendData('server_register', data);
  }

  async client_register(data) {
    while (!this.connected) {
      console.log(`waiting for connection established for socket.io`);
      await delay(1000); // Wait for 1s
    }
    this._sendData('client_register', data);
  }

  getMessageBox(data) {
    this._sendData('get_messagebox', data);
  }

  client_send_signal(dataObj) {
    console.log(`client_send_signal: ${JSON.stringify(dataObj)}`);
    this._sendData('client_send_signal', dataObj);
  }

  server_send_signal(dataObj) {
    this._sendData('server_send_signal', dataObj);
  }

  _sendData(eventType, data) {
    if (this.connected) {
      this.socket.emit(eventType, data);
    } else {
      console.error(`Cannot send data for event "${eventType}". Socket is not connected.`);
    }
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }
};
