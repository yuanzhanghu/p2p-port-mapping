import MappingServer from './mappingServer.js';
import { Logger } from './mylog.js';

export default async function({ server_port, serverKey, logLevel = 'info',
                websocket_url = "https://ai1to1.com",
                iceServers = [
                  'stun:stun.l.google.com:19302',
                  'turn:free:free@freeturn.net:3478',
                ]}) {
  const logger = Logger({ moduleName: 'MappingServerManager', logLevel });

  let p2pMappingServer = new MappingServer({ server_port, serverKey, logLevel, websocket_url, iceServers });
  p2pMappingServer.on('server_registered', ({ serverKey }) => {
    logger.info(`server_registered, local port:${server_port} ====> serverKey:${serverKey}`)
    p2pMappingServer.registered = true
  })
  p2pMappingServer.on('updateMessageBox', messageBox => {
    logger.debug(`server messageBox:${messageBox}`)
  })
  p2pMappingServer.on('error', error => {
    logger.error(`server${serverKey} side error:${error}`)
  })
  p2pMappingServer.on('peer_closed', clientId => {
    logger.info(`server${serverKey} side client disconnected: ${clientId}`);
  })
  p2pMappingServer.on('peer_connected', clientId => {
    logger.info(`server${serverKey} side client connected: ${clientId}`);
  })
  p2pMappingServer.on('channel_connected', ({ clientId, channel }) => {
    logger.info(`server${serverKey} side clientId: ${clientId}, channel:${channel} connected`);
  })
  p2pMappingServer.on('channel_closed', ({ clientId, channel }) => {
    logger.info(`server${serverKey} side clientId: ${clientId}, channel:${channel} closed`);
  })
  p2pMappingServer.on('clientMsg', ({ clientId, buf }) => {
    logger.debug(`clientMsg, clientId:${clientId}, buf:${buf}`)
  })
  return p2pMappingServer
}