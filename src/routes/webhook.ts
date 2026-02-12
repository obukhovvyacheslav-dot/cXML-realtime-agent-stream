/**
 * SignalWire Webhook Route
 *
 * When SignalWire receives an incoming call, it hits this endpoint.
 * We respond with cXML instructions that tell SignalWire to stream
 * the call audio to our WebSocket endpoint.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WEBHOOK_MESSAGES, AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    // Dynamically construct WebSocket URL from request headers
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${protocol}://${host}/media-stream`;

    // Get codec attribute based on configured audio format
    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    // Log codec selection for debugging
    console.log(`📞 Incoming call - Audio format: ${AGENT_CONFIG.audioFormat}, SignalWire codec: ${codec || 'default (G.711 μ-law)'}`);

    // Generate cXML response to stream audio to our WebSocket
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
   <Response>
  <Say>Connecting translator.</Say>

  <Connect>
    <Stream url="${websocketUrl}"${codecAttribute} />
  </Connect>

  <Dial>
    <Number>+36701474688</Number>
  </Dial>

</Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}
