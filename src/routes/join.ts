import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function joinRoute(fastify: FastifyInstance) {
  fastify.all('/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';

    const q = (request.query as any) || {};
    const conf = (q.conf || '').toString();
    const role = (q.role || '').toString(); // caller | callee

    const websocketUrl = `${protocol}://${host}/media-stream?conf=${encodeURIComponent(conf)}&role=${encodeURIComponent(role)}`;

    const codec = AGENT_CONFIG.audioFormat === AUDIO_FORMAT.PCM16
      ? SIGNALWIRE_CODECS.PCM16
      : SIGNALWIRE_CODECS.G711_ULAW;
    const codecAttribute = codec ? ` codec="${codec}"` : '';

    const cXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}"${codecAttribute} bidirectional="true" />
  </Connect>

  <Dial>
    <Conference>${conf}</Conference>
  </Dial>
</Response>`;

    reply.type('text/xml').send(cXMLResponse);
  });
}
