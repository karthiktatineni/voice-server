import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import env from './config/env.js';
import router from './routes/index.js';
import { handleMediaStream } from './websocket/streamHandler.js';
import { getKnowledge } from './services/knowledge.js';
import logger from './utils/logger.js';

// --- Express App ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Vercel frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Request logging
app.use((req, res, next) => {
    if (req.path !== '/health') {
        logger.info('HTTP', `${req.method} ${req.path}`);
    }
    next();
});

// Routes
app.use(router);

// --- HTTP Server ---
const server = createServer(app);

// --- WebSocket Server for Twilio Media Streams ---
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/media-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            logger.call('WebSocket', 'New Twilio Media Stream connection');
            handleMediaStream(ws);
        });
    } else {
        socket.destroy();
    }
});

// --- Startup ---
async function start() {
    // Pre-load knowledge base
    try {
        const knowledge = await getKnowledge();
        logger.success('Startup', `Knowledge loaded (source: ${knowledge.source})`);
    } catch (err) {
        logger.warn('Startup', 'Knowledge pre-load failed, will retry on first call');
    }

    server.listen(env.port, () => {
        logger.success('Server', `Voice Agent Server running on port ${env.port}`);
        logger.info('Server', `Environment: ${env.nodeEnv}`);
        logger.info('Server', `Health check: http://localhost:${env.port}/health`);
        logger.info('Server', `WebSocket endpoint: ws://localhost:${env.port}/media-stream`);
    });
}

start();
