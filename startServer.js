import SignalClient from './signalClient.js';
import MappingServer from './mappingServer.js';
import { Logger } from './mylog.js';
import net from 'net';
import { idGenerate } from './tool.js';
// const { start } = require('repl')

export default async ({ server_port, serverKey, logLevel = 'info' }) => {
  const logger = Logger({ moduleName: 'mappingServer', logLevel })
  const netCreateConnection = net.createConnection

  const onConnectMsg = 'welcome' // send msg to client while connection established.
  const serviceKey_server = idGenerate()
  const version = '0.1'
  const signalClient = new SignalClient('https://ai1to1.com');
  logger.debug(`serverKey:${serverKey}, serviceKey_server:${serviceKey_server}`);

  let p2pMappingServer = new MappingServer({ version, signalClient, logger, onConnectMsg, serverKey, serviceKey_server, server_port, netCreateConnection })
  p2pMappingServer.on('server_registered', ({ serverKey }) => {
    logger.info(`server_registered, local port:${server_port} ====> serverKey:${serverKey}`)
    p2pMappingServer.registered = true
  })
  p2pMappingServer.on('updateMessageBox', messageBox => {
    logger.debug(`server messageBox:${messageBox}`)
  })
  p2pMappingServer.on('updateStatus', status => {
    logger.error(`server${serverKey} side status:${status}`)
  })
  p2pMappingServer.on('tunnelsChange', tunnels => {
    logger.info(`server ${serverKey} side tunnelsChange:${tunnels}`)
    p2pMappingServer.tunnels = tunnels
  })
  p2pMappingServer.on('clientMsg', ({ clientId, buf }) => {
    logger.debug(`clientMsg, clientId:${clientId}, buf:${buf}`)
  })
  return p2pMappingServer
}