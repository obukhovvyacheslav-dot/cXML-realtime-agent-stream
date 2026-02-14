import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AUDIO_FORMAT, SIGNALWIRE_CODECS, WEBHOOK_MESSAGES } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host || 'localhost';
    const proto = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${proto}://${host}/media-stream`;

    const q = (request.query as any) || {};
    const conf = (q.conf || '').toString();
    const role = (q.role || '').toString(); // 'a' | 'b'

    if (!conf || (role !== 'a' && role !== 'b')) {
      return reply.code(400).type('text/plain').send('Missing ?conf=...&role=a|b');
    }

    const codec =
      AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
        ? SIGNALWIRE_CODECS.PCM16
        : SIGNALWIRE_CODECS.G711_ULAW;

    const codecAttribute = codec ? ` codec="${codec}"` : '';

    const cXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${WEBHOOK_MESSAGES?.CONNECTING || 'Connecting.'}</Say>
  <Connect>
    <Stream url="${websocketUrl}"${codecAttribute}>
      <Parameter name="conf" value="${conf}"/>
      <Parameter name="role" value="${role}"/>
    </Stream>
  </Connect>
</Response>`;

    reply.type('text/xml').send(cXML);
  });
}
