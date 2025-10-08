/**
 * Application Constants
 *
 * Centralized constants used throughout the application.
 */

// Service identification
export const SERVICE_NAME = 'signalwire-openai-voice-assistant';
export const SERVICE_DISPLAY_NAME = 'SignalWire + OpenAI Voice Assistant';

// Audio formats
export const AUDIO_FORMAT = {
  PCM16: 'pcm16' as const,       // High quality (24kHz) - opt-in
  G711_ULAW: 'g711_ulaw' as const // Standard telephony (8kHz) - default
};

// SignalWire codec mappings for audio formats
export const SIGNALWIRE_CODECS = {
  PCM16: 'L16@24000h',     // 24kHz Linear PCM
  G711_ULAW: undefined      // No codec = default G.711 μ-law (8kHz)
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WEATHER_UNAVAILABLE: 'I\'m unable to fetch the weather at the moment. Please try again later.',
  CITY_NOT_FOUND: (location: string) => `I couldn't find ${location}. Please try a different US city or include the state name.`,
  TIME_UNAVAILABLE: 'I was unable to get the current time. Please try again.',
  API_KEY_MISSING: 'Missing required OPENAI_API_KEY configuration',
  TOOL_APPROVAL_FAILED: 'Failed to approve tool call',
  SESSION_ERROR: 'Session error',
  TRANSPORT_INIT_FAILED: 'Failed to initialize SignalWire transport',
  CONNECTION_ERROR: 'SignalWire client connection error'
};

// Transport event types for basic logging
export const EVENT_TYPES = {
  RESPONSE_DONE: 'response.done',
  TRANSCRIPTION_COMPLETED: 'conversation.item.input_audio_transcription.completed'
};

// Connection messages
export const CONNECTION_MESSAGES = {
  CLIENT_CONNECTED: '📞 SignalWire client connected to media stream',
  CLIENT_DISCONNECTED: '📞 SignalWire client disconnected from media stream',
  SERVER_STARTED: '🚀 SignalWire + OpenAI Voice Assistant Started',
  SERVER_READY: '📞 Ready to receive SignalWire webhooks',
  SHUTTING_DOWN: '👋 Shutting down gracefully...',
  SERVER_CLOSED: '✅ Server closed'
};

// Webhook responses
export const WEBHOOK_MESSAGES = {
  CONNECTING: 'Now connecting to the voice agent!'
};