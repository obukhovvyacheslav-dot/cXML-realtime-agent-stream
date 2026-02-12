/**
 * Application Configuration
 *
 * Consolidated configuration for the SignalWire + OpenAI Voice Assistant.
 * All settings and environment variables are managed here.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import type { OpenAIRealtimeModels } from '@openai/agents/realtime';
import { AUDIO_FORMAT, ERROR_MESSAGES } from './constants.js';
import { logger } from './utils/logger.js';
import type { AudioFormat } from './types/index.js';

// Load environment variables from .env file
dotenv.config();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read OpenAI API key from Docker secret or environment variable
 * Priority: Docker secret -> Environment variable
 */
function getOpenAIApiKey(): string {
  // First try to read from Docker secret (for containerized deployments)
  const secretPath = '/run/secrets/openai_api_key';
  try {
    if (fs.existsSync(secretPath)) {
      const apiKey = fs.readFileSync(secretPath, 'utf8').trim();
      if (apiKey) {
        return apiKey;
      }
    }
  } catch (error) {
    // Fall back to environment variable if secret reading fails
    logger.debug('Could not read Docker secret, falling back to environment variable');
  }

  // Fallback to environment variable
  const envApiKey = process.env.OPENAI_API_KEY;
  if (envApiKey) {
    return envApiKey;
  }

  return '';
}

// ============================================================================
// Environment Variables
// ============================================================================

// The only required configuration
export const OPENAI_API_KEY = getOpenAIApiKey();

// Validate that the API key is present
if (!OPENAI_API_KEY) {
  logger.section('❌ Configuration Error', [
    'Missing OPENAI_API_KEY configuration',
    '',
    'For local development:',
    '1. Copy .env.example to .env',
    '2. Add your OpenAI API key to the .env file',
    '3. Get an API key at: https://platform.openai.com/api-keys',
    '',
    'For Docker deployment:',
    '1. Create secrets directory: mkdir -p secrets',
    '2. Create API key file: echo "sk-your-key" > secrets/openai_api_key.txt',
    '3. Run with: docker-compose up signalwire-assistant'
  ]);
  throw new Error(ERROR_MESSAGES.API_KEY_MISSING);
}

// ============================================================================
// Server Configuration
// ============================================================================

export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '5050', 10),
  host: '0.0.0.0'
} as const;

// ============================================================================
// AI Agent Configuration
// ============================================================================

export const AGENT_CONFIG = {
  name: 'SignalWire Voice Assistant',
  voice: 'alloy' as const,
  model: 'gpt-4o-realtime-preview' as OpenAIRealtimeModels,
  audioFormat: (process.env.AUDIO_FORMAT || AUDIO_FORMAT.G711_ULAW) as AudioFormat,
  instructions: `
    You are a real-time voice translator for a phone call.

The caller speaks Russian. Translate EVERYTHING the caller says into natural Hungarian.

Rules:
- Output ONLY Hungarian.
- Do NOT answer as an assistant.
- Do NOT add explanations.
- Do NOT ask questions.
- If the caller speaks something that is not Russian, respond with Hungarian only: "Kérem, beszéljen oroszul."

Only translate what you hear.
  `
} as const;

// Validate audio format configuration after AGENT_CONFIG is defined
const validAudioFormats = Object.values(AUDIO_FORMAT);
if (!validAudioFormats.includes(AGENT_CONFIG.audioFormat as any)) {
  logger.section('❌ Configuration Error', [
    `Invalid AUDIO_FORMAT: "${process.env.AUDIO_FORMAT || 'undefined'}"`,
    '',
    `Valid options: ${validAudioFormats.join(', ')}`,
    '',
    'Examples:',
    '- AUDIO_FORMAT="g711_ulaw" (default, standard telephony quality)',
    '- AUDIO_FORMAT="pcm16" (high quality, 24kHz)',
    '',
    'Leave unset to use default (g711_ulaw)'
  ]);
  throw new Error(`Invalid audio format: ${AGENT_CONFIG.audioFormat}`);
}
