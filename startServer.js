const SignalClient = require('./signalClient')

const MappingServer = require('./mappingServer')
const { Logger }= require('./mainLog')
const net = require('net')
const { idGenerate, delay } = require('./tool')
// const { start } = require('repl')

const startServer = async ({server_port, serverKey, logLevel='info', signalAddress='p2p.ai1to1.com', signalPort=15001}) => {
    const logger =  Logger({ moduleName:'mappingServer', logLevel})
    const netCreateConnection = net.createConnection

    const onConnectMsg = 'welcome' // send msg to client while connection established.
    const serviceKey_server = idGenerate()
    const version = '0.1'
    const signalClient = new SignalClient({logger})
    logger.debug(`serverKey:${serverKey}, serviceKey_server:${serviceKey_server}`)

    let p2pMappingServer = new MappingServer({version, signalClient, logger, onConnectMsg, serverKey, serviceKey_server, server_port, signalPort, signalAddress, netCreateConnection})
    p2pMappingServer.on('server_registered', ({serverKey}) => {
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
    p2pMappingServer.on('clientMsg', ({clientId, buf}) => {
      logger.debug(`clientMsg, clientId:${clientId}, buf:${buf}`)
    })
    p2pMappingServer.register()
    return p2pMappingServer
}

module.exports = startServer