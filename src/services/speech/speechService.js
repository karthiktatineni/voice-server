/**
 * Unified Speech Service Abstraction
 * 
 * Exposes generic STT and TTS methods, currently backed by Deepgram.
 * Can be swapped to other providers in the future without changing the caller.
 */
import { createDeepgramSTT } from './deepgramSTT.js';
import { deepgramTextToSpeechREST } from './deepgramTTS.js';

export const speechService = {
    /**
     * Create a live transcription stream (WebSocket).
     * @param {object} callbacks - { onTranscript, onUtteranceEnd, onError, onClose }
     * @returns {{ send: Function, close: Function }}
     */
    createLiveTranscription(callbacks) {
        return createDeepgramSTT(callbacks);
    },

    /**
     * Convert text to speech.
     * @param {string} text - The text to synthesize
     * @returns {Promise<Buffer>} - Audio buffer (mulaw 8000Hz)
     */
    async textToSpeech(text) {
        return await deepgramTextToSpeechREST(text);
    }
};
