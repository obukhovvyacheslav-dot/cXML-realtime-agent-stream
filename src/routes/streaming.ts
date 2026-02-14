import type { FastifyInstance } from 'fastify';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';

type StreamingOpts = {
  agentConfig: any;          // из твоего index.ts (RealtimeAgentConfiguration)
  openaiApiKey: string;
  model: string;
};

export async function streamingRoute(fastify: FastifyInstance, opts: StreamingOpts) {
  fastify.register(async (scoped) => {
    scoped.get('/media-stream', { websocket: true }, async (connection: any) => {
      const agent = new RealtimeAgent({
        name: opts.agentConfig?.name ?? 'Agent',
        instructions: opts.agentConfig?.instructions ?? '',
        tools: opts.agentConfig?.tools ?? [],
        voice: opts.agentConfig?.voice,
      });

      const transport = new TwilioRealtimeTransportLayer({
        twilioWebSocket: connection, // SignalWire stream совместим по событиям (у тебя в логах "twilio_message")
      });

      const session = new RealtimeSession(agent, {
        transport,
        model: opts.model || 'gpt-realtime',
        config: {
          audio: {
            output: {
              voice: opts.agentConfig?.voice,
            },
          },
        },
      });

      session.on('transport_event', (raw: any) => {
        // оставляем, чтобы не падало по типам
        void raw;
      });

      await session.connect({ apiKey: opts.openaiApiKey });
    });
  });
}
