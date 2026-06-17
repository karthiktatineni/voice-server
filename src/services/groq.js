import Groq from 'groq-sdk';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let groqClient = null;

function getGroqClient() {
    if (!groqClient) {
        if (!env.groqApiKey) {
            logger.warn('Groq', 'No API key configured. LLM features disabled.');
            return null;
        }
        groqClient = new Groq({ apiKey: env.groqApiKey });
        logger.success('Groq', 'Client initialized');
    }
    return groqClient;
}

/**
 * Send a chat completion request to Groq.
 * Returns the full response text.
 */
export async function chatCompletion(messages, options = {}) {
    const client = getGroqClient();
    if (!client) throw new Error('Groq client not initialized');

    const completion = await client.chat.completions.create({
        model: options.model || 'llama-3.3-70b-versatile',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 300,
        stream: false,
    });

    return completion.choices[0]?.message?.content || '';
}

/**
 * Stream a chat completion from Groq.
 * Calls onToken for each streamed token.
 * Returns the full accumulated text.
 */
export async function streamChatCompletion(messages, onToken, options = {}) {
    const client = getGroqClient();
    if (!client) throw new Error('Groq client not initialized');

    const stream = await client.chat.completions.create({
        model: options.model || 'llama-3.3-70b-versatile',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 300,
        stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
            fullText += token;
            if (onToken) onToken(token);
        }
    }

    return fullText;
}

/**
 * Analyze a call transcript and extract qualification data.
 */
export async function analyzeTranscript(transcript, leadInfo) {
    const analysisPrompt = `You are an AI analyst. Given the following phone call transcript between an AI assistant and a potential lead/client, extract structured information.

Lead Info:
- Name: ${leadInfo.name}
- Category: ${leadInfo.category}
- Original Message: ${leadInfo.message || 'None'}

Transcript:
${transcript}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "summary": "Brief 2-3 sentence summary of the call",
  "purpose": "What the caller wants (freelance project, internship, collaboration, etc.)",
  "budget": "Any budget mentioned or 'Not discussed'",
  "timeline": "Any timeline mentioned or 'Not discussed'",
  "interestLevel": "high | medium | low",
  "leadScore": <number 0-100 based on lead quality>
}`;

    const result = await chatCompletion([
        { role: 'system', content: 'You are a precise JSON extraction assistant. Output only valid JSON.' },
        { role: 'user', content: analysisPrompt },
    ], { temperature: 0.2, maxTokens: 500 });

    try {
        return JSON.parse(result);
    } catch (err) {
        logger.error('Groq', 'Failed to parse transcript analysis', err);
        return {
            summary: result.substring(0, 200),
            purpose: '',
            budget: 'Not discussed',
            timeline: 'Not discussed',
            interestLevel: 'medium',
            leadScore: 50,
        };
    }
}
