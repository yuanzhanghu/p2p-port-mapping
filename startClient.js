import { delay } from './tool.js';
import MappingClient from './mappingClient.js';
import { Logger } from './mylog.js';

export default async function ({ localListenPort, serverKey, logLevel = 'info',
                websocket_url = "https://ai1to1.com",
                iceServers = [
                  'stun:stun.l.google.com:19302',
                  'turn:free:free@freeturn.net:3478',
                ]}) {
  const logger = Logger({ moduleName: 'MappingClientManager', logLevel });
  let mapClient = new MappingClient({ localListenPort, serverKey, logLevel, websocket_url, iceServers});
  mapClient.on('updateMessageBox', messageBox => {
    logger.debug('updateMessageBox', messageBox)
  })
  mapClient.on('error', error => {
    logger.debug(`mapClient error ${error}`);
  })
  mapClient.on('client_registered', clientId => {
    logger.info(`client registered: ${clientId}`);
    mapClient.registered = true
    mapClient.createPeer()
  })
  mapClient.on('channel_connected', ({ clientId, channel }) => {
    logger.debug(`clientId:${clientId}, channel:${channel} connected.`);
  });
  mapClient.on('channel_closed', ({ clientId, channel }) => {
    logger.debug(`clientId:${clientId}, channel:${channel} closed.`);
  });
  mapClient.on('peer_connected', clientId => {
    logger.debug(`clientId:${clientId} connected.`);
  });
  mapClient.on('peer_closed', clientId => {
    logger.debug(`clientId:${clientId} closed.`);
  });
  mapClient.on('serverMsg', msg => {
    logger.debug(`serverMsg:${msg}`)
  })
  let timeout = 30 // 30seconds
  for (let i = 0; i < timeout; i++) {
    await delay(1000)
    if (mapClient.peer_connected) {
      logger.info(`tunnel established. serverKey:${serverKey} ====> local port:${localListenPort}`)
      return mapClient
    }
  }
  logger.error(`timeout:${timeout}, failed to establish tunnel`)
  mapClient.close()
  return null
}