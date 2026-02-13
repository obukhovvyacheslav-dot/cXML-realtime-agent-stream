import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function statusRoute(fastify: FastifyInstance) {
  fastify.post('/call-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = (request.query as any) || {};
    const to = (q.to || '').toString();
    const conf = (q.conf || '').toString();

    const body: any = request.body || {};
    const callStatus = (body.CallStatus || body.call_status || '').toString(); // answered / completed / etc.

    // Запускаем собеседника только когда ТЫ ответил
    if (callStatus !== 'answered') {
      return reply.send({ ok: true, status: callStatus });
    }

    const space = process.env.SIGNALWIRE_SPACE!;
    const project = process.env.SIGNALWIRE_PROJECT_ID!;
    const token = process.env.SIGNALWIRE_API_TOKEN!;
    const from = process.env.SIGNALWIRE_FROM_NUMBER!;
    const baseUrl = process.env.APP_BASE_URL!;

    const auth = Buffer.from(`${project}:${token}`).toString('base64');
    const joinUrl = `${baseUrl}/incoming-call?conf=${encodeURIComponent(conf)}&role=callee`;

    const r = await fetch(`https://${space}/api/laml/2010-04-01/Accounts/${project}/Calls.json`, {
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

    const text = await r.text();
    return reply.code(r.status).send(text);
  });
}
