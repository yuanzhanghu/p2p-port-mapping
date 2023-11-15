import { delay } from './tool.js';
import MappingClient from './mappingClient.js';
import { Logger } from './mylog.js';

export default async function ({
    localListenPort, serverKey, logLevel = 'info',
    websocket_url = "https://ai1to1.com",
    iceServers = [ 'stun:stun.l.google.com:19302', 'turn:free:free@freeturn.net:3478', ]}) {
  const logger = Logger({ moduleName: 'startClient', logLevel });
  let mapClient = new MappingClient({ localListenPort, serverKey, logLevel, websocket_url, iceServers });
  let isPeerCreated = false;
  let isPeerConnected = false;

  mapClient.on('updateMessageBox', messageBox => {
    logger.info('updateMessageBox', messageBox);
  });

  mapClient.on('error', error => {
    logger.info(`mapClient error ${error}`);
  });

  mapClient.on('client_registered', clientId => {
    logger.info(`client registered: ${clientId}`);
    if (!isPeerCreated) {
      mapClient.createPeer(); // only call once at beginning.
      isPeerCreated = true;
    }
  });

  mapClient.on('channel_connected', ({ clientId, channel }) => {
    logger.info(`clientId:${clientId}, channel:${channel} connected.`);
  });

  mapClient.on('channel_closed', ({ clientId, channel }) => {
    logger.info(`clientId:${clientId}, channel:${channel} closed.`);
  });

  mapClient.on('peer_connected', clientId => {
    logger.info(`clientId:${clientId} peer connected.`);
    isPeerConnected = true;
  });

  mapClient.on('peer_closed', clientId => {
    logger.info(`clientId:${clientId} peer closed.`);
    isPeerConnected = false;
    mapClient.createPeer();
  });

  mapClient.on('serverMsg', msg => {
    logger.info(`serverMsg:${msg}`);
  });

  for (let i=0; i<10; i++) {
    await delay(3000);
    if (isPeerConnected) {
      logger.info(`tunnel established. serverKey:${serverKey} ====> local port:${localListenPort}`);
      return;
    }
  }
  logger.error(`timeout:${timeout}, failed to establish tunnel`);
  mapClient.close();
};
