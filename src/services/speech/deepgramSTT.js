/**
 * Deepgram STT Service
 * Handles live transcription from Twilio audio via WebSocket.
 */
import deepgramSdk from '@deepgram/sdk';
const { createClient } = deepgramSdk;
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

export function createDeepgramSTT(callbacks = {}) {
    if (!env.deepgramApiKey) {
        logger.warn('DeepgramSTT', 'No API key. STT disabled.');
        return { send: () => {}, close: () => {} };
    }

    const deepgram = createClient(env.deepgramApiKey);

    const connection = deepgram.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        utterance_end_ms: 1500,
        vad_events: true,
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
    });

    connection.on('open', () => {
        logger.info('DeepgramSTT', 'Live transcription connection opened');
    });

    connection.on('Results', (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript.trim()) {
            const isFinal = data.is_final;
            if (callbacks.onTranscript) {
                callbacks.onTranscript(transcript, isFinal);
            }
        }
    });

    connection.on('UtteranceEnd', () => {
        if (callbacks.onUtteranceEnd) {
            callbacks.onUtteranceEnd();
        }
    });

    connection.on('error', (err) => {
        logger.error('DeepgramSTT', 'Transcription error', err);
        if (callbacks.onError) callbacks.onError(err);
    });

    connection.on('close', () => {
        logger.info('DeepgramSTT', 'Live transcription connection closed');
        if (callbacks.onClose) callbacks.onClose();
    });

    return {
        send(audioBuffer) {
            if (connection.getReadyState() === 1) {
                connection.send(audioBuffer);
            }
        },
        close() {
            connection.requestClose();
        },
    };
}
