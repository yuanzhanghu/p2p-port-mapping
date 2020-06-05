const MappingClient = require('../mappingClient')
const MappingServer = require('../mappingServer')
const EventEmitter = require('events')

class MockNetSocket extends EventEmitter {
  constructor() {
    super()
  }
  end() {
    this.emit('close')
  }
}
class MockSocketServer extends EventEmitter {
  constructor() {
    super()
  }
  listen(port) {
    let c = new MockNetSocket()
    this.emit('connection', c)
  }
}
class MockSignalSocket extends EventEmitter {
  constructor() {
    super()
  }
}

beforeEach(() => {
  // initializeCityDatabase();
});

afterEach(() => {
  // clearCityDatabase();
});

test('error happens', async () => {
  // expect(isCity('Vienna')).toBeTruthy();
  let server_id = 823923;
  const localServer = new MockSocketServer()
  const signalSocket = new MockSignalSocket()
  // localServer.listen(9102)
  let client = new MappingClient(server_id, localServer, signalSocket)

  let err = await new Promise((resolve, reject) => {
    client.on('errMsg', err => {
      resolve(err)
    })
    // console.log(client.listeners('errMsg'))
    localServer.emit('error', 'error happens')
  })
  expect(err).toBe('error happens')
})

test('register_client', async () => {
  // expect(isCity('Vienna')).toBeTruthy();
  let server_id = 823923;
  const localServer = new MockSocketServer()
  const signalSocket = new MockSignalSocket()
  // localServer.listen(9102)
  let client = new MappingClient(server_id, localServer, signalSocket)

  let data = await new Promise((resolve, reject) => {
    client.on('errMsg', err => {
      resolve(err)
    })
    client.on('client_registered', data => {
      client.client_peer.close() // close the peer
      resolve(data)
    })
    signalSocket.emit('client_registered', { client_id:2 })
  })
  console.log('data:', data)
  expect(data).toStrictEqual({"client_id":2})
})

test('connection from local client, will trigger another connection on remote side', async () => {
  // expect(isCity('Vienna')).toBeTruthy();
  let server_id = 823923;
  const localServer = new MockSocketServer()
  const signalSocket = new MockSignalSocket()
  // localServer.listen(9102)
  let client = new MappingClient(server_id, localServer, signalSocket)

  let ret = await new Promise((resolve, reject) => {
    client.on('errMsg', err => {
      resolve(err)
    })
    client.on('client_registered', data => {
      client.on('connection', ({client_id, subClientId}) => {
        client.on('remoteServer_connected', ({client_id, subClientId}) => {
          client.client_peer.close() // close the peer
          resolve(client)
        })
        signalSocket.emit('remoteServer_connected', { subClientId:20 }) // step 3
      })
      client.peer_connected = true // assume the peer connected through webrtc.
      client.g_subClientId = 20
      localServer.listen(9102) // step 2, emit a local connection
    })
    signalSocket.emit('client_registered', { client_id:2 }) // step 1
  })
  // console.log(JSON.stringify(client.subClientDict))
  expect(client.client_id).toBe(2)
  expect(client.g_subClientId).toBe(21)
  expect(client.subClientDict[20].remoteConnected).toBeTruthy()
})