import { generateStreamTwiML } from '../twilio/index.js';
import { updateLead } from '../firebase/index.js';
import logger from '../utils/logger.js';

/**
 * ALL /twilio/voice and /api/twilio/voice
 * 
 * Twilio hits this URL when the call connects.
 * MUST always return valid TwiML XML — never crash, never return JSON.
 * leadId comes from query string: ?leadId=xxx
 */
export async function handleVoiceWebhook(req, res) {
    // Debug: log everything Twilio sends
    console.log("🔥 VOICE WEBHOOK HIT:", req.method, req.url);
    console.log("QUERY:", req.query);
    console.log("BODY:", req.body || "no body");

    // leadId is in query string (set by createOutboundCall url param)
    const leadId = req.query?.leadId || req.body?.leadId;

    // Always set content type to XML first — Twilio expects this
    res.type('text/xml');

    if (!leadId) {
        logger.warn('Webhook', 'Voice webhook called without leadId — returning fallback TwiML');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Sorry, there was a configuration error. Please try again later.</Say>
</Response>`);
    }

    logger.call('Webhook', `Voice webhook triggered for lead ${leadId}`);

    try {
        const twiml = generateStreamTwiML(leadId);
        return res.send(twiml);
    } catch (error) {
        logger.error('Webhook', 'Failed to generate TwiML', error);
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Sorry, an internal error occurred. Please try again later.</Say>
</Response>`);
    }
}

/**
 * ALL /twilio/status and /api/twilio/status
 * 
 * Twilio calls this on call status changes (ringing, answered, completed, failed).
 * Data arrives as application/x-www-form-urlencoded.
 */
export async function handleStatusWebhook(req, res) {
    // Debug: log everything Twilio sends
    console.log("📞 STATUS WEBHOOK HIT:", req.method, req.url);
    console.log("QUERY:", req.query);
    console.log("BODY:", req.body || "no body");

    const leadId = req.query?.leadId || req.body?.leadId;
    const callStatus = req.body?.CallStatus;
    const callDuration = parseInt(req.body?.CallDuration || '0', 10);
    const callSid = req.body?.CallSid || '';

    logger.call('Webhook', `Status update: ${callStatus} for lead ${leadId} (SID: ${callSid})`);

    if (!leadId) {
        return res.status(200).send('OK');
    }

    try {
        const statusMap = {
            'queued': 'queued',
            'ringing': 'calling',
            'in-progress': 'calling',
            'completed': 'completed',
            'busy': 'failed',
            'no-answer': 'failed',
            'canceled': 'cancelled',
            'failed': 'failed',
        };

        const newStatus = statusMap[callStatus];

        if (newStatus) {
            const updates = { status: newStatus };

            if (callDuration > 0) {
                updates.callDuration = callDuration;
            }

            await updateLead(leadId, updates);
        }
    } catch (error) {
        logger.error('Webhook', 'Failed to update lead status', error);
    }

    return res.status(200).send('OK');
}
