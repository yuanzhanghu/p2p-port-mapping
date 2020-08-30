const net = require('net')
const EventEmitter = require('events')
const { idGenerate, delay } = require('./tool')
const SignalClient = require('./signalClient')
const MappingClient = require('./mappingClient')
const { Logger }= require('./mainLog')


var startClient = async ({localListenPort, serverKey,logLevel='info', signalAddress='p2p.ai1to1.com', signalPort=15001}) => {
    const logger =  Logger({ moduleName:'mappingClient', logLevel})
    // const moduleName = `serverStart_serverId${serverId}_${serverName}`
    const netCreateConnection = net.createConnection
    const serviceKey_client = idGenerate()
    const signalClient = new SignalClient({logger})
    logger.debug(`serverKey:${serverKey}, serviceKey_client:${serviceKey_client}`)

    let localServer = net.createServer()
    localServer.listen(localListenPort, '127.0.0.1', () => { // listen on localhost only, to avoid security issue.
    logger.debug(`local server bound on 127.0.0.1: ${localListenPort}`)
    })


    let mapClient = new MappingClient({ logger, serverKey, serviceKey_client, localServer, signalPort, signalAddress, signalClient, })
    mapClient.on('updateMessageBox', messageBox => {
      logger.debug('updateMessageBox', messageBox)
    })
    mapClient.on('updateStatus', status => {
      logger.debug(`mapClient updateStatus ${status}`)
    })
    mapClient.on('client_registered', clientId => {
      logger.info(`client registered`)
      mapClient.registered = true
      mapClient.createPeer()
    })
    mapClient.on('serverMsg', msg => {
      logger.debug(`serverMsg:${msg}`)
    })
    let timeout = 30 // 30seconds
    for (let i=0; i < timeout; i++) {
      await delay(1000)
      if (mapClient.peer_connected) {
        logger.info(`tunnel established. serverKey:${serverKey} ====> local port:${localListenPort}`)
        return mapClient
      }
    }
    logger.error(`timeout:${timeout}, failed to establish tunnel`)
    return mapClient
}

module.exports = startClient