import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { createServer } from 'http';
import pkg from 'ws';
const { Server: WebSocketServer } = pkg;
import fs from 'fs';
import { parse, serialize } from 'cookie';
import winston from 'winston';

const config = JSON.parse(fs.readFileSync('./config.json', { encoding: 'utf8' }));

let prefix = config.prefix;

if (!prefix.startsWith('/')) {
  prefix = `/${prefix}`;
}

if (!prefix.endsWith('/')) {
  prefix = `${prefix}/`;
}

const btoa = (str) => {
  return Buffer.from(str).toString('base64');
};

const atob = (str) => {
  return Buffer.from(str, 'base64').toString('utf-8');
};

const staticFileCacheDuration = 3600; // Cache duration in seconds

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

const errorHandler = (err, req, res) => {
  logger.error('An error occurred:', err);
  res.statusCode = 500; // Internal Server Error
  res.end('Internal Server Error');
};

export default (server) => {
  const wss = new WebSocketServer({ server: server });

  wss.on('connection', (cli, req) => {
    try {
      const svr = new WebSocket(atob(req.url.toString().replace(`${prefix}ws/`, '')));

      svr.on('message', (data) => {
        try {
          cli.send(data);
        } catch (err) {
          logger.error('Error sending message to client:', err);
        }
      });

      svr.on('open', () => {
        cli.on('message', (data) => {
          svr.send(data);
        });
      });

      cli.on('close', (code) => {
        try {
          svr.close(code);
        } catch (err) {
          svr.close(1006);
        }
      });

      svr.on('close', (code) => {
        try {
          cli.close(code);
        } catch (err) {
          cli.close(1006);
        }
      });

      cli.on('error', (err) => {
        logger.error('Client error:', err);
        try {
          svr.close(1001);
        } catch (err) {
          svr.close(1006);
        }
      });

      svr.on('error', (err) => {
        logger.error('Server error:', err);
        try {
          cli.close(1001);
        } catch (err) {
          cli.close(1006);
        }
      });
    } catch (err) {
      cli.close(1001);
    }
  });
};

const server = createServer((req, res) => {
  try {
    if (req.url.startsWith('/static/')) {
      res.setHeader('Cache-Control', `public, max-age=${staticFileCacheDuration}`);
      return;
    }

    const cookies = parse(req.headers.cookie || '');
    const myCookie = cookies.myCookie;

    const cookieOptions = {
      httpOnly: true,
      maxAge: 3600,
    };
    res.setHeader('Set-Cookie', serialize('myCookie', 'cookieValue', cookieOptions));

  } catch (err) {
    errorHandler(err, req, res);
  }
});

export { server };