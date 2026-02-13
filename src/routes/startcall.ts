import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type Body = { to: string };

export async function startCallRoute(fastify: FastifyInstance) {
  fastify.post('/start-call', async (request: FastifyRequest, reply: FastifyReply) => {
    const { to } = (request.body || {}) as Body;

    if (!to || !to.startsWith('+')) {
      return reply.code(400).send({ error: 'Provide "to" in E.164 format, e.g. +36123456789' });
    }

    const space = process.env.SIGNALWIRE_SPACE!;
    const project = process.env.SIGNALWIRE_PROJECT_ID!;
    const token = process.env.SIGNALWIRE_API_TOKEN!;
    const from = process.env.SIGNALWIRE_FROM_NUMBER!;
    const me = process.env.MY_PHONE!;
    const baseUrl = process.env.APP_BASE_URL!;

    const auth = Buffer.from(`${project}:${token}`).toString('base64');

    const conf = `c_${Date.now()}`;

    // 1) Звоним тебе
    const urlMe = `${baseUrl}/incoming-call?conf=${encodeURIComponent(conf)}&role=caller`;

    // 2) Когда ты ответил → /call-status запустит 2-й звонок на "to"
    const statusCb = `${baseUrl}/call-status?conf=${encodeURIComponent(conf)}&to=${encodeURIComponent(to)}`;

    const r = await fetch(`https://${space}/api/laml/2010-04-01/Accounts/${project}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: me,
        From: from,
        Url: urlMe,
        StatusCallback: statusCb,
        StatusCallbackEvent: 'answered',
        StatusCallbackMethod: 'POST',
      }),
    });

    const text = await r.text();
    return reply.code(r.status).send(text);
  });
}
