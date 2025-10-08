/**
 * Health Check Route
 *
 * Provides health status endpoint for monitoring and Docker health checks.
 * This endpoint is used by Docker containers to verify the service is running properly.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SERVICE_NAME } from '../constants.js';
import type { HealthResponse } from '../types/index.js';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply): Promise<HealthResponse> => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      uptime: process.uptime()
    };
  });
}