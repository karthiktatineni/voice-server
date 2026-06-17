/**
 * Deepgram Aura TTS Service
 * Converts text to speech using Deepgram's Aura models.
 * Outputs mulaw 8000Hz format for Twilio.
 */
import deepgramSdk from '@deepgram/sdk';
const { createClient } = deepgramSdk;
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

export async function deepgramTextToSpeechREST(text) {
    if (!env.deepgramApiKey) {
        logger.warn('DeepgramTTS', 'No API key. TTS disabled.');
        return null;
    }

    try {
        const deepgram = createClient(env.deepgramApiKey);
        
        // Use aura-orion-en (male) or aura-asteria-en (female)
        const response = await deepgram.speak.request(
            { text },
            {
                model: 'aura-orion-en',
                encoding: 'mulaw',
                sample_rate: 8000,
                container: 'none',
            }
        );

        const stream = await response.getStream();
        if (!stream) {
            throw new Error('Deepgram TTS returned no stream');
        }

        const reader = stream.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        // Concatenate Uint8Array chunks into a single Buffer
        const audioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
        return audioBuffer;

    } catch (error) {
        logger.error('DeepgramTTS', 'Failed to generate speech', error);
        throw error;
    }
}
