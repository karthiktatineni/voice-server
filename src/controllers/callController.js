import { getLead, updateLead } from '../firebase/index.js';
import { createOutboundCall } from '../twilio/index.js';
import logger from '../utils/logger.js';

/**
 * POST /api/start-call
 * Triggers an outbound Twilio call to a lead.
 */
export async function startCall(req, res) {
    try {
        const { leadId } = req.body;

        if (!leadId) {
            return res.status(400).json({ error: 'leadId is required' });
        }

        // 1. Load the lead from Firestore
        const lead = await getLead(leadId);

        if (!lead.phone) {
            return res.status(400).json({ error: 'Lead has no phone number' });
        }

        if (!['queued', 'pending'].includes(lead.status)) {
            return res.status(400).json({ error: `Lead status is "${lead.status}", cannot start call` });
        }

        logger.call('CallController', `Starting call to ${lead.name} (${lead.phone}) for lead ${leadId}`);

        // 2. Create the Twilio outbound call
        const call = await createOutboundCall(lead.phone, leadId);

        // 3. Update the lead in Firestore
        await updateLead(leadId, {
            status: 'calling',
            callSid: call.sid,
        });

        logger.success('CallController', `Call initiated: SID ${call.sid}`);

        return res.status(200).json({
            success: true,
            callSid: call.sid,
            leadId,
        });
    } catch (error) {
        logger.error('CallController', 'Failed to start call', error);
        return res.status(500).json({ error: error.message || 'Failed to start call' });
    }
}
