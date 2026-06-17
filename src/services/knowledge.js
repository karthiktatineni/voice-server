/**
 * Knowledge Service
 * 
 * Imports the portfolio knowledge base directly from the parent frontend project.
 * This ensures the voice agent always uses the same data as the website chatbot.
 * 
 * For Render deployment (where the parent files won't exist), we fall back to
 * a generated knowledge.json snapshot.
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the parent portfolio data files
const PORTFOLIO_DATA_DIR = resolve(__dirname, '../../../src/data');
const KNOWLEDGE_SNAPSHOT = resolve(__dirname, '../../knowledge.json');

let knowledgeCache = null;

/**
 * Attempt to dynamically import portfolio source files.
 * Falls back to knowledge.json if the source files aren't available.
 */
async function loadFromSource() {
    const userInfoPath = resolve(PORTFOLIO_DATA_DIR, 'userInfo.js');
    const projectsPath = resolve(PORTFOLIO_DATA_DIR, 'projects.js');
    const skillsPath = resolve(PORTFOLIO_DATA_DIR, 'skills.js');

    if (existsSync(userInfoPath) && existsSync(projectsPath) && existsSync(skillsPath)) {
        try {
            const { userInfo, buildSystemPrompt } = await import(`file://${userInfoPath.replace(/\\/g, '/')}`);
            logger.success('Knowledge', 'Loaded directly from portfolio source files');
            return {
                userInfo,
                chatbotPrompt: buildSystemPrompt(),
                source: 'live',
            };
        } catch (err) {
            logger.warn('Knowledge', 'Failed to import source files, falling back to snapshot', err.message);
        }
    }

    return null;
}

/**
 * Load from the pre-generated knowledge.json snapshot.
 */
function loadFromSnapshot() {
    if (existsSync(KNOWLEDGE_SNAPSHOT)) {
        try {
            const raw = readFileSync(KNOWLEDGE_SNAPSHOT, 'utf-8');
            const data = JSON.parse(raw);
            logger.success('Knowledge', 'Loaded from knowledge.json snapshot');
            return { ...data, source: 'snapshot' };
        } catch (err) {
            logger.error('Knowledge', 'Failed to parse knowledge.json', err);
        }
    }
    return null;
}

/**
 * Fallback hardcoded minimal knowledge.
 */
function loadFallback() {
    logger.warn('Knowledge', 'Using hardcoded fallback knowledge');
    return {
        userInfo: {
            name: 'Karthik Tatineni',
            title: 'Student | ECE | Full-Stack Developer | IoT & AI Enthusiast',
            college: 'Institute of Aeronautical Engineering (IARE), Hyderabad',
            branch: 'Electronics and Communication Engineering (ECE)',
            bio: 'Independent Software Developer and ECE student specializing in scalable web apps, distributed systems, and AI-driven platforms.',
            skills: [],
            projects: [],
            certifications: [],
            contact: {
                github: 'https://github.com/karthiktatineni',
                linkedin: 'https://linkedin.com/in/karthik-tatineni',
            },
        },
        source: 'fallback',
    };
}

/**
 * Get the portfolio knowledge base. Cached after first load.
 */
export async function getKnowledge() {
    if (knowledgeCache) return knowledgeCache;

    // Try sources in order: live source → snapshot → fallback
    knowledgeCache = await loadFromSource() || loadFromSnapshot() || loadFallback();
    return knowledgeCache;
}

/**
 * Force reload the knowledge (useful after portfolio updates).
 */
export async function reloadKnowledge() {
    knowledgeCache = null;
    return getKnowledge();
}

/**
 * Generate a knowledge.json snapshot from the live source files.
 * Run this script manually: node src/services/knowledge.js --generate
 */
async function generateSnapshot() {
    const data = await loadFromSource();
    if (!data) {
        console.error('Cannot generate snapshot: portfolio source files not found.');
        process.exit(1);
    }

    const { writeFileSync } = await import('fs');
    const snapshot = {
        userInfo: data.userInfo,
        generatedAt: new Date().toISOString(),
    };
    writeFileSync(KNOWLEDGE_SNAPSHOT, JSON.stringify(snapshot, null, 2));
    console.log(`Knowledge snapshot written to ${KNOWLEDGE_SNAPSHOT}`);
}

// Allow running as CLI: node src/services/knowledge.js --generate
if (process.argv.includes('--generate')) {
    generateSnapshot();
}
