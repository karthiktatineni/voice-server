/**
 * WebSocket Stream Handler
 * 
 * Manages the bidirectional audio pipeline:
 * Twilio Audio → Deepgram STT → Groq LLM → Deepgram TTS → Twilio Audio
 * 
 * Each active call gets its own CallSession instance.
 */
import { speechService } from '../services/speech/speechService.js';
import { streamChatCompletion, analyzeTranscript } from '../services/groq.js';
import { getLead, appendTranscript, saveCallResult } from '../firebase/index.js';
import { buildVoiceSystemPrompt, buildGreeting } from '../prompts/systemPrompt.js';
import logger from '../utils/logger.js';

/** Active call sessions keyed by Twilio streamSid */
const activeSessions = new Map();

class CallSession {
    constructor(ws, leadId, streamSid) {
        this.ws = ws;
        this.leadId = leadId;
        this.streamSid = streamSid;
        this.lead = null;
        this.systemPrompt = '';
        this.conversationHistory = [];
        this.fullTranscript = '';
        this.currentUtterance = '';
        this.deepgramConnection = null;
        this.callStartTime = Date.now();
        this.isProcessing = false;
        this.hasGreeted = false;
    }

    async initialize() {
        try {
            // Load lead data
            this.lead = await getLead(this.leadId);
            logger.info('Session', `Loaded lead: ${this.lead.name} (${this.leadId})`);

            // Build the system prompt from live portfolio knowledge
            this.systemPrompt = await buildVoiceSystemPrompt(this.lead);
            this.conversationHistory.push({ role: 'system', content: this.systemPrompt });

            // Setup Deepgram STT
            this.setupSTT();

            // Send initial greeting after a short delay
            setTimeout(() => this.sendGreeting(), 1500);

            logger.success('Session', `Session initialized for lead ${this.leadId}`);
        } catch (error) {
            logger.error('Session', `Failed to initialize session for ${this.leadId}`, error);
        }
    }

    setupSTT() {
        this.deepgramConnection = speechService.createLiveTranscription({
            onTranscript: (text, isFinal) => {
                if (isFinal) {
                    this.currentUtterance += ' ' + text;
                    logger.info('STT', `[Final] ${text}`);
                } else {
                    // Interim results for debugging
                }
            },
            onUtteranceEnd: () => {
                const utterance = this.currentUtterance.trim();
                if (utterance) {
                    logger.info('STT', `[Utterance Complete] "${utterance}"`);
                    this.handleUserSpeech(utterance);
                    this.currentUtterance = '';
                }
            },
            onError: (err) => {
                logger.error('STT', 'Deepgram error', err);
            },
            onClose: () => {
                logger.info('STT', 'Deepgram connection closed');
            },
        });
    }

    async sendGreeting() {
        if (this.hasGreeted) return;
        this.hasGreeted = true;

        const greeting = buildGreeting(this.lead);
        logger.call('AI', `Greeting: "${greeting}"`);

        this.conversationHistory.push({ role: 'assistant', content: greeting });
        this.fullTranscript += `[AI]: ${greeting}\n`;

        await this.speakText(greeting);
    }

    async handleUserSpeech(text) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Log the user speech
        this.fullTranscript += `[User]: ${text}\n`;
        this.conversationHistory.push({ role: 'user', content: text });

        try {
            // Save transcript incrementally
            appendTranscript(this.leadId, 'User', text).catch(() => {});

            // Get AI response via Groq streaming
            let aiResponse = '';

            // For voice, we accumulate the full response then TTS it
            // (Sentence-level streaming to TTS would be more advanced)
            aiResponse = await streamChatCompletion(
                this.conversationHistory,
                null, // We'll TTS the full response for now
                { maxTokens: 150 } // Keep voice responses short
            );

            logger.call('AI', `Response: "${aiResponse}"`);

            this.conversationHistory.push({ role: 'assistant', content: aiResponse });
            this.fullTranscript += `[AI]: ${aiResponse}\n`;

            // Save AI response to transcript
            appendTranscript(this.leadId, 'AI', aiResponse).catch(() => {});

            // Speak the response
            await this.speakText(aiResponse);
        } catch (error) {
            logger.error('Session', 'Error handling user speech', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Convert text to speech and send audio to Twilio.
     */
    async speakText(text) {
        try {
            // Use Deepgram Aura TTS
            const audioBuffer = await speechService.textToSpeech(text);

            if (audioBuffer && this.ws.readyState === 1) {
                // Convert to base64 and send to Twilio Media Stream
                const base64Audio = audioBuffer.toString('base64');

                // Twilio expects audio in chunks. Send it as one media message.
                const mediaMessage = {
                    event: 'media',
                    streamSid: this.streamSid,
                    media: {
                        payload: base64Audio,
                    },
                };

                this.ws.send(JSON.stringify(mediaMessage));
                logger.info('TTS', `Sent ${audioBuffer.length} bytes of audio to Twilio`);
            }
        } catch (error) {
            logger.error('TTS', 'Failed to speak text', error);
        }
    }

    /**
     * Process incoming audio from Twilio and forward to Deepgram.
     */
    handleMediaMessage(msg) {
        if (msg.event === 'media' && msg.media?.payload) {
            const audioBuffer = Buffer.from(msg.media.payload, 'base64');
            if (this.deepgramConnection) {
                this.deepgramConnection.send(audioBuffer);
            }
        }
    }

    /**
     * Clean up when the call ends.
     */
    async cleanup() {
        const callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
        logger.info('Session', `Call ended for lead ${this.leadId}. Duration: ${callDuration}s`);

        // Close STT
        if (this.deepgramConnection) {
            this.deepgramConnection.close();
        }

        // Post-call analysis
        if (this.fullTranscript.trim()) {
            try {
                logger.info('Session', 'Running post-call analysis...');
                const analysis = await analyzeTranscript(this.fullTranscript, this.lead);

                await saveCallResult(this.leadId, {
                    ...analysis,
                    callDuration,
                });

                logger.success('Session', `Post-call analysis saved for lead ${this.leadId}`, analysis);
            } catch (error) {
                logger.error('Session', 'Post-call analysis failed', error);
            }
        }

        activeSessions.delete(this.streamSid);
    }
}

/**
 * Handle a new WebSocket connection from Twilio Media Streams.
 */
export function handleMediaStream(ws) {
    let session = null;

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());

            switch (msg.event) {
                case 'connected':
                    logger.info('WebSocket', 'Twilio Media Stream connected');
                    break;

                case 'start':
                    const leadId = msg.start?.customParameters?.leadId;
                    const streamSid = msg.start?.streamSid;

                    if (!leadId || !streamSid) {
                        logger.error('WebSocket', 'Missing leadId or streamSid in start event');
                        return;
                    }

                    logger.call('WebSocket', `Stream started: ${streamSid} for lead ${leadId}`);

                    session = new CallSession(ws, leadId, streamSid);
                    activeSessions.set(streamSid, session);
                    await session.initialize();
                    break;

                case 'media':
                    if (session) {
                        session.handleMediaMessage(msg);
                    }
                    break;

                case 'stop':
                    logger.info('WebSocket', 'Twilio Media Stream stopped');
                    if (session) {
                        await session.cleanup();
                        session = null;
                    }
                    break;

                default:
                    break;
            }
        } catch (error) {
            logger.error('WebSocket', 'Error processing message', error);
        }
    });

    ws.on('close', async () => {
        logger.info('WebSocket', 'WebSocket connection closed');
        if (session) {
            await session.cleanup();
            session = null;
        }
    });

    ws.on('error', (error) => {
        logger.error('WebSocket', 'WebSocket error', error);
    });
}

export { activeSessions };
