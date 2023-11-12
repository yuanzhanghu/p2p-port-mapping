#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import startServer from './startServer.js';
import { idGenerate } from './tool.js';

const configFilePath = './config.json';

const readServerKey = (port) => {
  try {
    const config = fs.existsSync(configFilePath) ? JSON.parse(fs.readFileSync(configFilePath, 'utf8')) : {};
    if (config[port] && config[port].serverKey) {
      return config[port].serverKey;
    }
  } catch (error) {
    console.error('Error reading config.json:', error);
  }
  return null;
};

const saveServerKey = (port, serverKey) => {
  try {
    const config = fs.existsSync(configFilePath) ? JSON.parse(fs.readFileSync(configFilePath, 'utf8')) : {};
    config[port] = { serverKey };
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to config.json:', error);
  }
};

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --port [num] [--logLevel [str]] [--regenerate-key]')
  .help('help')
  .alias('help', 'h')
  .options({
    port: {
      alias: 'p',
      describe: 'Server port to bind',
      type: 'number',
      demandOption: true,
    },
    ip: {
      alias: 'i',
      describe: 'The IP address to bind to (default is 0.0.0.0)',
      type: 'string',
      default: '0.0.0.0',
    },
    logLevel: {
      alias: 'l',
      describe: 'Logging level (e.g., info, debug, error)',
      type: 'string',
      default: 'info',
    },
    regenerateKey: {
      alias: 'r',
      describe: 'Regenerate a new server key',
      type: 'boolean',
      default: false,
    },
  })
  .parse();

const { port, logLevel, ip, regenerateKey } = argv;

let serverKey = readServerKey(port);
if (!serverKey || regenerateKey) {
  serverKey = idGenerate();
  saveServerKey(port, serverKey);
}

startServer({ server_port: port, serverKey, logLevel }).then((server) => {
  console.log(`Server is running on ${ip}:${port} with key ${serverKey}`);
}).catch((error) => {
  console.error('Failed to start the server:', error);
});
