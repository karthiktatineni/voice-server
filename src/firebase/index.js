import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import env from '../config/env.js';
import logger from '../utils/logger.js';

if (getApps().length === 0) {
    try {
        if (env.firebaseServiceAccount) {
            const serviceAccount = JSON.parse(env.firebaseServiceAccount);
            initializeApp({ credential: cert(serviceAccount) });
        } else if (env.firebasePrivateKey) {
            initializeApp({
                credential: cert({
                    projectId: env.firebaseProjectId,
                    clientEmail: env.firebaseClientEmail,
                    privateKey: env.firebasePrivateKey,
                }),
            });
        } else {
            logger.warn('Firebase', 'No Firebase credentials found. Firestore operations will fail.');
        }
        logger.success('Firebase', 'Admin SDK initialized');
    } catch (error) {
        logger.error('Firebase', 'Initialization failed', error);
    }
}

const db = getApps().length > 0 ? getFirestore() : null;

/**
 * Get a lead document by ID.
 */
export async function getLead(leadId) {
    if (!db) throw new Error('Firestore not initialized');
    const doc = await db.collection('leads').doc(leadId).get();
    if (!doc.exists) throw new Error(`Lead ${leadId} not found`);
    return { id: doc.id, ...doc.data() };
}

/**
 * Update a lead document.
 */
export async function updateLead(leadId, updates) {
    if (!db) throw new Error('Firestore not initialized');
    updates.updatedAt = FieldValue.serverTimestamp();
    await db.collection('leads').doc(leadId).update(updates);
    logger.info('Firebase', `Lead ${leadId} updated`, Object.keys(updates));
}

/**
 * Append text to the transcript field of a lead.
 */
export async function appendTranscript(leadId, speaker, text) {
    if (!db) throw new Error('Firestore not initialized');
    const lead = await getLead(leadId);
    const existingTranscript = lead.transcript || '';
    const newLine = `[${speaker}]: ${text}\n`;
    await db.collection('leads').doc(leadId).update({
        transcript: existingTranscript + newLine,
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Save the post-call analysis to Firestore.
 */
export async function saveCallResult(leadId, { summary, leadScore, purpose, budget, timeline, interestLevel, callDuration }) {
    await updateLead(leadId, {
        status: 'completed',
        summary: summary || '',
        leadScore: leadScore || 0,
        callDuration: callDuration || 0,
        qualification: {
            purpose: purpose || '',
            budget: budget || '',
            timeline: timeline || '',
            interestLevel: interestLevel || '',
        },
    });
    logger.success('Firebase', `Call result saved for lead ${leadId}`);
}

export { db, FieldValue };
