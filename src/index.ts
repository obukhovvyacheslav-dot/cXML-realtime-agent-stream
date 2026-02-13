/**
 * SignalWire + OpenAI Realtime Voice Assistant Demo
 *
 * This example demonstrates how to integrate SignalWire's media streaming
 * with OpenAI's Realtime API to create an AI-powered voice assistant.
 *
 * Flow:
 * 1. Phone call comes in → SignalWire webhook
 * 2. We return cXML instructions to stream audio
 * 3. SignalWire connects to our WebSocket
 * 4. We forward audio to OpenAI Realtime API
 * 5. AI responses stream back to the caller
 */

import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import formbody from '@fastify/formbody';
import type { RealtimeAgentConfiguration } from '@openai/agents/realtime';
import { OPENAI_API_KEY, SERVER_CONFIG, AGENT_CONFIG } from './config.js';
import { allTools } from './tools/index.js';
import { webhookRoute } from './routes/webhook.js';
import { streamingRoute } from './routes/streaming.js';
import { healthRoute } from './routes/health.js';
import { logger } from './utils/logger.js';
import { startCallRoute } from './routes/startcall.js';
import { statusRoute } from './routes/status.js';
import { joinRoute } from './routes/join.js';
import { CONNECTION_MESSAGES } from './constants.js';

// ============================================================================
// AI Agent Configuration
// ============================================================================

/**
 * Configure the AI assistant with instructions and available tools
 */
const agentConfig: RealtimeAgentConfiguration = {
  name: AGENT_CONFIG.name,
  instructions: AGENT_CONFIG.instructions,
  tools: allTools, // All tools from the tools directory
  voice: AGENT_CONFIG.voice, // Voice configured on agent (SDK best practice)
};

// ============================================================================
// Server Setup & Initialization
// ============================================================================

/**
 * Initialize and configure the Fastify server
 */
async function createServer() {
  // Create and configure Fastify instance
  const fastify = Fastify({
    logger: false // We use custom logging
  });

  // Register plugins
  await fastify.register(formbody);
  await fastify.register(websocket);

  // Register all routes
  await fastify.register(healthRoute);
  await fastify.register(webhookRoute);
  await fastify.register(joinRoute);
  await fastify.register(statusRoute);
  await fastify.register(startCallRoute);
  await fastify.register(async (scopedFastify) => {
    await streamingRoute(scopedFastify, {
      agentConfig,
      openaiApiKey: OPENAI_API_KEY,
      model: AGENT_CONFIG.model
    });
  });

  return fastify;
}

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the server and set up graceful shutdown
 */
async function startServer() {
  let fastify: FastifyInstance | undefined;

  try {
    // Create the server
    fastify = await createServer();

    // Start Fastify server
    await fastify.listen({
      port: SERVER_CONFIG.port,
      host: SERVER_CONFIG.host
    });

    logger.section(CONNECTION_MESSAGES.SERVER_STARTED, [
      `📡 Server running on http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`,
      `🏥 Health check: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/health`,
      `🔊 Audio format: ${AGENT_CONFIG.audioFormat} (${AGENT_CONFIG.audioFormat === 'pcm16' ? '24kHz HD' : '8kHz telephony'})`,
      `🎙️  Voice: ${AGENT_CONFIG.voice}`,
      CONNECTION_MESSAGES.SERVER_READY
    ]);

    // Graceful shutdown handler
    process.on('SIGINT', async () => {
      logger.info(`\n${CONNECTION_MESSAGES.SHUTTING_DOWN}`);
      try {
        if (fastify) {
          await fastify.close();
        }
        logger.info(CONNECTION_MESSAGES.SERVER_CLOSED);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();
