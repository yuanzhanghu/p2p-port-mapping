import { delay } from './tool.js';
import MappingClient from './mappingClient.js';
import { Logger } from './mylog.js';

export default async function ({
  localListenPort, serverKey, logLevel = 'info',
  websocket_url = "https://ai1to1.com",
  iceServers = ['stun:stun.l.google.com:19302', 'turn:free:free@freeturn.net:3478',] }) {
  const logger = Logger({ moduleName: 'startClient', logLevel });
  let mapClient = new MappingClient({ localListenPort, serverKey, logLevel, websocket_url, iceServers });

  mapClient.on('updateMessageBox', messageBox => {
    logger.info('updateMessageBox', messageBox);
  });

  mapClient.on('error', error => {
    logger.info(`mapClient error ${error}`);
  });

  mapClient.on('client_registered', ({clientId, serverKey}) => {
    logger.info(`client registered: ${clientId}, serverKey:${serverKey}`);
  });

  mapClient.on('channel_connected', ({ clientId, channel }) => {
    logger.info(`clientId:${clientId}, channel:${channel} connected.`);
  });

  mapClient.on('channel_closed', ({ clientId, channel }) => {
    logger.info(`clientId:${clientId}, channel:${channel} closed.`);
  });

  mapClient.on('peer_connected', clientId => {
    logger.info(`clientId:${clientId} peer connected.`);
  });

  mapClient.on('peer_closed', clientId => {
    logger.info(`clientId:${clientId} peer closed.`);
  });

  mapClient.on('serverMsg', msg => {
    logger.info(`serverMsg:${msg}`);
  });

  while (true) {
    mapClient.client_register();
    while (!mapClient.isRegistered2SignalServer()) {
      await delay(1000);
    }
    logger.info(`mapClient.createPeer() called.`);
    mapClient.createPeer();
    for (let i = 0; i < 10; i++) {
      await delay(3000);
      if (mapClient.isPeerConnected()) {
        logger.info(`tunnel established. serverKey:${serverKey} ====> local port:${localListenPort}`);
        break;
      }
    }
    while (mapClient.isPeerConnected()) {
      await delay(1000);
    }
    // peer disconnected
    await mapClient.close(); // restart mapClient
    await delay(5000);
    logger.info(`restarting mapClient ...................`);
  }
};
