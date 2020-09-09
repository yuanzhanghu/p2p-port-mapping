const fs = require('fs')
const path = require('path')
const jayson = require('jayson')
var os = require('os');
const { idGenerate, } = require('./tool')
var config = require('./config.json') // config.mappingOutList=[{port:xxx, serverKey:xxx}]

var Service
var platform = os.platform()
if (platform === 'darwin' || platform == 'linux') {
  Service = require('node-linux').Service
} else if (platform === 'win32') {
  Service = require('node-windows').Service
}

const saveConfig = (data) => {
  fs.writeFileSync('./config.json', data)
}

const displayList = () => {
  return new Promise((resolve, reject) => {
    const client = jayson.client.http({
      port: 7002
    });
    client.request('displayList', [], function(err, response) {
      if(err) throw err
      console.log(response.result)
      resolve(response.result)
    })
  })
}

const serviceConfig = {
  name:'p2pmapping',
  description: 'p2pmapping service',
  script: path.join(__dirname, 'serviceMain.js'),
  maxRetries:10000,   // to avoid windows service not started
  maxRestarts:10000,  // to avoid windows service not started
}

var start = () => {
  // Create a new service object
  var svc = new Service(serviceConfig)
  // Listen for the "install" event, which indicates the
  // process is available as a service.
  svc.on('install',function(){
    console.log(`service installed`)
    svc.start()
    if (platform == 'linux') {
      svc.enable()
    }
  })
  svc.on('alreadyinstalled',function(){
    console.log(`service already installed`)
    svc.start()
    if (platform == 'linux') {
      svc.enable()
    }
  })
  svc.on('start',function(){
    console.log(`p2pmapping service started`)
  })
  svc.install()
}

var stop = () => {
  // Create a new service object
  var svc = new Service(serviceConfig)
  // Listen for the "uninstall" event so we know when it's done.
  svc.on('uninstall',function() {
    console.log('service uninstall complete.')
  })
  svc.on('stop',function() {
    console.log('p2pmapping service stopped.')
  })
  if (platform === 'linux') {
    svc.disable()
  }
  svc.uninstall()
}

var addMappingOut = ({port}) => {
  const serverKey = idGenerate()
  let found = false
  config.mappingOutList.forEach(item => {
    if (item.port === port) {
      found = true
      console.log(`port ${port} exists, serverKey:${item.serverKey}`)
    }
  })
  if (found) {
    return
  }
  console.log(`added mapping: port ${port} ====> serverKey:${serverKey}`)
  config.mappingOutList.push({serverKey, port})
  saveConfig(JSON.stringify(config))
}

var addMappingIn = ({serverKey, port, name}) => {
  let found = false
  config.mappingInList.forEach(item => {
    if (item.port === port) {
      found = true
    }
  })
  if (found) {
    console.log(`port ${port} exists`)
    return
  }
  config.mappingInList.push({serverKey, port, name})
  saveConfig(JSON.stringify(config))
}

var deleteMappingOut = ({port}) => {
  for (let i = 0; i < config.mappingOutList.length; i++) {
    if (config.mappingOutList[i].port === port) {
      config.mappingOutList.splice(i, 1)
      break
    }
  }
  saveConfig(JSON.stringify(config))
}

var deleteMappingIn = ({port}) => {
  for (let i = 0; i < config.mappingInList.length; i++) {
    if (config.mappingInList[i].port === port) {
      config.mappingInList.splice(i, 1)
      break
    }
  }
  saveConfig(JSON.stringify(config))
}

module.exports = {start, stop, addMappingIn, addMappingOut, deleteMappingIn, deleteMappingOut, displayList}