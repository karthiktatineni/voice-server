import { generateStreamTwiML } from '../twilio/index.js';
import { updateLead } from '../firebase/index.js';
import logger from '../utils/logger.js';

/**
 * POST /api/twilio/voice
 * Twilio hits this URL when the call connects.
 * Returns TwiML that connects to our Media Stream WebSocket.
 */
export async function handleVoiceWebhook(req, res) {
    const leadId = req.query.leadId || req.body.leadId;

    if (!leadId) {
        logger.error('Webhook', 'Voice webhook called without leadId');
        res.type('text/xml');
        return res.send('<Response><Say>An error occurred.</Say></Response>');
    }

    logger.call('Webhook', `Voice webhook triggered for lead ${leadId}`);

    const twiml = generateStreamTwiML(leadId);
    res.type('text/xml');
    return res.send(twiml);
}

/**
 * POST /api/twilio/status
 * Twilio calls this on call status changes.
 */
export async function handleStatusWebhook(req, res) {
    const leadId = req.query.leadId || req.body.leadId;
    const callStatus = req.body.CallStatus;
    const callDuration = parseInt(req.body.CallDuration || '0', 10);
    const callSid = req.body.CallSid || '';

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
