import { Router } from 'express';
import { startCall } from '../controllers/callController.js';
import { handleVoiceWebhook, handleStatusWebhook } from '../controllers/webhookController.js';
import { reloadKnowledge } from '../services/knowledge.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const router = Router();

// --- Auth middleware for internal API calls ---
function requireApiKey(req, res, next) {
    // In development, skip auth
    if (!env.isProduction) return next();

    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    if (!authHeader || authHeader !== env.apiSecretKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// --- Health Check ---
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: env.nodeEnv,
    });
});

// --- Call Trigger (called from Vercel frontend or dashboard) ---
router.post('/api/start-call', requireApiKey, startCall);

// --- Twilio Webhooks (called by Twilio, no API key needed) ---
router.all('/api/twilio/voice', handleVoiceWebhook);
router.all('/api/twilio/status', handleStatusWebhook);

// Aliases just in case Twilio is configured directly via console
router.all('/twilio/voice', handleVoiceWebhook);
router.all('/twilio/status', handleStatusWebhook);

// --- Knowledge Reload (manual trigger to refresh portfolio data) ---
router.post('/api/reload-knowledge', requireApiKey, async (req, res) => {
    try {
        const knowledge = await reloadKnowledge();
        logger.success('Routes', `Knowledge reloaded (source: ${knowledge.source})`);
        res.json({ success: true, source: knowledge.source });
    } catch (error) {
        logger.error('Routes', 'Failed to reload knowledge', error);
        res.status(500).json({ error: 'Failed to reload knowledge' });
    }
});

export default router;
