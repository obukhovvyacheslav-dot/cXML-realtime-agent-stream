import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AUDIO_FORMAT, SIGNALWIRE_CODECS } from '../constants.js';
import { AGENT_CONFIG } from '../config.js';

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.all('/incoming-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host || 'localhost';
    const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';

    const q = (request.query as any) || {};
    const to = (q.to || '').toString();     // номер собеседника
    const conf = (q.conf || '').toString(); // имя конференции

    // 1) как только ты ответил — запускаем второй звонок в ту же конференцию
    if (to && conf) {
      try {
        const space = process.env.SIGNALWIRE_SPACE!;
        const project = process.env.SIGNALWIRE_PROJECT_ID!;
        const token = process.env.SIGNALWIRE_API_TOKEN!;
        const from = process.env.SIGNALWIRE_FROM_NUMBER!;
        const baseUrl = process.env.APP_BASE_URL!;

        const auth = Buffer.from(`${project}:${token}`).toString('base64');

        const joinUrl = `${baseUrl}/join?conf=${encodeURIComponent(conf)}&role=callee`;

        await fetch(`https://${space}/api/laml/2010-04-01/Accounts/${project}/Calls.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: from,
            Url: joinUrl,
          }),
        });
      } catch (e) {
        // ничего не отвечаем, просто продолжаем формировать cXML
      }
    }

    // 2) твой leg: включаем bidirectional stream и заводим тебя в конференцию
    const websocketUrl = `${protocol}://${host}/media-stream?conf=${encodeURIComponent(conf)}&role=caller`;

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
