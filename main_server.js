#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import startServer from './startServer.js';
import { idGenerate } from './tool.js';

// Define the path to the config file
const configFilePath = './config.json';

// Function to read the server key from config.json
const readServerKey = () => {
  try {
    const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    return config.serverKey;
  } catch (error) {
    // If reading the file fails, generate a new key
    console.error('Error reading config.json, generating a new server key.');
    return idGenerate();
  }
};

// Function to save the server key to config.json
const saveServerKey = (serverKey) => {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify({ serverKey }), 'utf8');
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

// Destructure the options
const { port, logLevel, ip, regenerateKey } = argv;

// Determine the server key to use
let serverKey = regenerateKey ? idGenerate() : readServerKey();

// Save the server key if it was regenerated
saveServerKey(serverKey);

// Start the server with the determined key
startServer({ server_port:port, serverKey, logLevel }).then((server) => {
  console.log(`Server is running on ${ip}:${port} with key ${serverKey}`);
}).catch((error) => {
  console.error('Failed to start the server:', error);
});
