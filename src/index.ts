/**
 * SignalWire + OpenAI Realtime Voice Assistant Demo
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
import { startCallRoute } from './routes/startcall.js';

import { logger } from './utils/logger.js';
import { CONNECTION_MESSAGES } from './constants.js';

const agentConfig: RealtimeAgentConfiguration = {
  name: AGENT_CONFIG.name,
  instructions: AGENT_CONFIG.instructions,
  tools: allTools,
  voice: AGENT_CONFIG.voice,
};

async function createServer() {
  const fastify = Fastify({ logger: false });

  await fastify.register(formbody);
  await fastify.register(websocket);

  await fastify.register(healthRoute);
  await fastify.register(startCallRoute);  // ✅
  await fastify.register(webhookRoute);    // ✅

  await fastify.register(async (scopedFastify) => {
    await streamingRoute(scopedFastify, {
      agentConfig,
      openaiApiKey: OPENAI_API_KEY,
      model: AGENT_CONFIG.model,
    });
  });

  return fastify;
}

async function startServer() {
  let fastify: FastifyInstance | undefined;

  try {
    fastify = await createServer();

    await fastify.listen({
      port: SERVER_CONFIG.port,
      host: SERVER_CONFIG.host,
    });

    logger.section(CONNECTION_MESSAGES.SERVER_STARTED, [
      `📡 Server running on http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`,
      `🏥 Health check: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/health`,
      `🔊 Audio format: ${AGENT_CONFIG.audioFormat} (${AGENT_CONFIG.audioFormat === 'pcm16' ? '24kHz HD' : '8kHz telephony'})`,
      `🎙️  Voice: ${AGENT_CONFIG.voice}`,
      CONNECTION_MESSAGES.SERVER_READY,
    ]);

    process.on('SIGINT', async () => {
      logger.info(`\n${CONNECTION_MESSAGES.SHUTTING_DOWN}`);
      try {
        if (fastify) await fastify.close();
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

startServer();
