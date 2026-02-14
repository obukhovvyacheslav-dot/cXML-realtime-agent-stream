import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function statusRoute(fastify: FastifyInstance) {
  fastify.post('/call-status', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({ ok: true });
  });
}
