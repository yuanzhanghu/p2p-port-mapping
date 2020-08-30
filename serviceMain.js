const SignalClient = require('./signalClient')
const proces = require('process')
/* config.mappingOutList=[{port:xxx, serverKey:xxx}]
 * config.mappingInList=[{port:xxx, serverKey:xxx, name:xxx}]
 */
const config = require('./config.json') 
const startServer = require('./startServer')
const startClient = require('./startClient')
const { delay } = require('./tool'); // ms

const jayson = require('jayson')
// create a server
const server = jayson.server({
  displayList: function(args, callback) {
    let retStr = `mapping port out list:\n`
    config.mappingOutList.forEach(item => {
      retStr += ` port:${item.port} ====> serverKey:${item.serverKey}, registered:${item.mappingServer.registered}, tunnels:${item.mappingServer.tunnels}`
      retStr += '\n'
    })
    retStr += `mapping port in list:\n`
    config.mappingInList.forEach(item => {
      retStr += ` serverKey:${item.serverKey} ====> port:${item.port}, registered:${item.mappingClient.registered}, connected:${item.mappingClient.peer_connected}`
      retStr += '\n'
    })
    callback(null, retStr) // callback(err,result)
  }
})
server.http().listen(7002);

(async () => {
  const signalAddress = 'p2p.ai1to1.com'
  const signalPort = 15001
  const logLevel = 'info'

  while (true) {
    config.mappingOutList.forEach( async ({port, serverKey}, index) => {
      if (!config.mappingOutList[index].mappingServer || !config.mappingOutList[index].mappingServer.registered) {
        console.log(`starting mappingOut, port:${port}, serverKey:${serverKey}`)
        config.mappingOutList[index].mappingServer = await startServer({server_port:port, serverKey, logLevel, signalAddress, signalPort})
      }
    })
    await delay(5000)
    config.mappingInList.forEach( async ({port, serverKey, name}, index) => {
      if (!config.mappingInList[index].mappingClient || !config.mappingInList[index].mappingClient.registered ||
          !config.mappingInList[index].mappingClient.peer_connected) {
        if (config.mappingInList[index].mappingClient) {
          await config.mappingInList[index].mappingClient.close()
        }
        console.log(`starting mappingIn, port:${port}, serverKey:${serverKey}, name:${name}`)
        let mappingClient = await startClient({localListenPort:port, serverKey, logLevel, signalAddress, signalPort})
        if (mappingClient) {
          config.mappingInList[index].mappingClient = mappingClient
        }
      }
    })
    await delay(60000)
  }
})()