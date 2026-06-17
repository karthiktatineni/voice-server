import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
config({ path: resolve(__dirname, '../../.env') });

const env = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Groq
    groqApiKey: process.env.GROQ_API_KEY || '',

    // Twilio
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    serverBaseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3001',

    // Deepgram (STT & TTS)
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',

    // Firebase
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',

    // Security
    apiSecretKey: process.env.API_SECRET_KEY || '',
};

export default env;
