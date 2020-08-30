const { Command } = require('commander')
const serviceControl = require('./serviceControl')

const program = new Command()
// program.version('0.0.1')
program.option('-s, --start-service', 'install and start service')
program.option('-t, --stop-service', 'stop and uninstall service')
program.option('-a, --add', 'add mapping out/in')
program.option('-d, --delete', 'add mapping out/in')
program.option('-o, --mapping-out', 'mapping port out')
program.option('-i, --mapping-in', 'mapping port in')
program.option('-l, --list', 'list mapping out/in status')
program.option('-p, --port <port>', 'local port for mapping out/in')
program.option('-k, --server-key <key>', 'serverKey for mapping in')
program.option('-n, --mapping-in-name <name>', 'name it for mapping in')
program.parse(process.argv)

let opts = program.opts()
let wrongParam = false;

(async () => {
  // console.log(`options: ${JSON.stringify(opts)}`)
  if (program.list) {
    await serviceControl.displayList()
  } else if (program.startService) {
    serviceControl.start()
  } else if (program.stopService) {
    serviceControl.stop()
  } else if (program.add) {
    if (opts.mappingOut) {
      serviceControl.addMappingOut({port:opts.port})
    } else if (opts.mappingIn) {
      serviceControl.addMappingIn({port:opts.port, serverKey:opts.serverKey, name:opts.mappingInName})
    } else {
      wrongParam = true
    }
  } else if (program.delete) {
    if (opts.mappingOut) {
      serviceControl.deleteMappingOut({port:opts.port})
    } else if (opts.mappingIn) {
      serviceControl.deleteMappingIn({port:opts.port})
    } else {
      wrongParam = true
    }
  } else {
    wrongParam = true
  }

  if (wrongParam) {
    console.log(`wrong command line parameters`)
    process.exit(1)
  }
})()