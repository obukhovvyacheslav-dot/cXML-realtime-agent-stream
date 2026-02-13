import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';

    const q = (request.query as any) || {};
    const to = (q.to || '').toString(); // номер собеседника
    if (!to || !to.startsWith('+')) {
      return reply.code(400).type('text/plain').send('Missing ?to=+E164');
    }

    const websocketUrl = `${protocol}://${host}/media-stream`;

    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    // ВАЖНО: Start/Stream НЕ блокирует, потом Dial соединяет звонок
    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting.</Say>

  <Start>
    <Stream url="${websocketUrl}"${codecAttribute} bidirectional="true" />
  </Start>

  <Dial answerOnBridge="true">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}
