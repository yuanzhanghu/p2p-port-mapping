const net = require('net')
const EventEmitter = require('events')
const { customAlphabet } = require('nanoid')
const idGenerate = customAlphabet('23456789abcdefghijkmnpqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ', 9) //=> "4f9Dd1A42"
const { delay } = require('./tool')
const SignalClient = require('./signalClient')
const MappingClient = require('./mappingClient')
const { Logger }= require('./mainLog')


var start = async ({logger, localListenPort, serverKey, signalAddress, signalPort}) => {
    // const moduleName = `serverStart_serverId${serverId}_${serverName}`
    const netCreateConnection = net.createConnection
    const serviceKey_client = idGenerate()
    const signalClient = new SignalClient({logger})
    logger.debug(`serverKey:${serverKey}, serviceKey_client:${serviceKey_client}`)

    let localServer = net.createServer()
    localServer.listen(localListenPort, '127.0.0.1', () => { // listen on localhost only, to avoid security issue.
    logger.debug(`local server bound on 127.0.0.1: ${localListenPort}`)
    })


    const mapClient = new MappingClient({ logger, serverKey, serviceKey_client, localServer, signalPort, signalAddress, signalClient, })
    mapClient.on('updateMessageBox', messageBox => {
      logger.debug('updateMessageBox', messageBox)
    })
    mapClient.on('updateStatus', status => {
      logger.debug(`mapClient updateStatus ${status}`)
    })
    mapClient.on('client_registered', clientId => {
      logger.info(`client registered`)
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
        return true
      }
    }
    logger.error(`timeout:${timeout}, failed to establish tunnel`)
    return false
}

const signalAddress = 'p2p.ai1to1.com'
const signalPort = 15001
const serverKey = process.argv[2]
const localListenPort = process.argv[3]
const logger =  Logger({ moduleName:'mappingClient', logLevel:'info'})

start({logger, localListenPort, serverKey, signalAddress, signalPort})
