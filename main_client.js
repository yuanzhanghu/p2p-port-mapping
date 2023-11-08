#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import startClient from './startClient.js';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --port <port> --key <serverKey> [options]')
  .help('help').alias('help', 'h')
  .options({
    port: {
      alias: 'p',
      describe: 'Local listening port',
      type: 'number',
      demandOption: true,
    },
    key: {
      alias: 'k',
      describe: 'Server key to connect',
      type: 'string',
      demandOption: true,
    },
    logLevel: {
      alias: 'l',
      describe: 'Logging level',
      choices: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
      default: 'info',
    },
  })
  .example('$0 --port 8080 --key myServerKey', 'Connects the local port 8080 to the remote server represented by myServerKey')
  .argv;

// This will start the client with the provided arguments
startClient({
  localListenPort: argv.port,
  serverKey: argv.key,
  logLevel: argv.logLevel,
}).then((client) => {
  if (client) {
    console.log('Client started successfully');
  } else {
    console.error('Failed to start client');
  }
}).catch((error) => {
  console.error('An error occurred:', error);
});
