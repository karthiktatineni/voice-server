import twilio from 'twilio';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let client = null;

function getClient() {
    if (!client) {
        if (!env.twilioAccountSid || !env.twilioAuthToken) {
            logger.warn('Twilio', 'Missing Twilio credentials. Call features disabled.');
            return null;
        }
        client = twilio(env.twilioAccountSid, env.twilioAuthToken);
        logger.success('Twilio', 'Client initialized');
    }
    return client;
}

/**
 * Create an outbound call to the lead's phone number.
 * The TwiML URL tells Twilio to connect to our Media Stream WebSocket.
 */
export async function createOutboundCall(phoneNumber, leadId) {
    const twilioClient = getClient();
    if (!twilioClient) throw new Error('Twilio client not initialized');

    const call = await twilioClient.calls.create({
        to: phoneNumber,
        from: env.twilioPhoneNumber,
        url: `${env.serverBaseUrl}/api/twilio/voice?leadId=${leadId}`,
        statusCallback: `${env.serverBaseUrl}/api/twilio/status?leadId=${leadId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
    });

    logger.call('Twilio', `Outbound call created: ${call.sid} → ${phoneNumber}`);
    return call;
}

/**
 * Generate TwiML that connects the call to a Media Stream WebSocket.
 */
export function generateStreamTwiML(leadId) {
    const wsUrl = `wss://${new URL(env.serverBaseUrl).host}/media-stream`;
    // We pass the leadId as a parameter inside the stream URL or rely on the start message.
    // Twilio <Stream> allows custom parameters natively:
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${wsUrl}">
            <Parameter name="leadId" value="${leadId}" />
        </Stream>
    </Connect>
</Response>`;
}

export { getClient };
