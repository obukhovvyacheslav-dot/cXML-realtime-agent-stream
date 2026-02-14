import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { RealtimeClient } from '@openai/agents/realtime';
import { logger } from '../utils/logger.js';

type Leg = {
  ws: SocketStream['socket'];
  conf: string;
  role: 'a' | 'b';
  sendToSignalWire: (msg: any) => void;
};

type ConfState = {
  a?: Leg;
  b?: Leg;
  clientAB?: RealtimeClient; // A -> B
  clientBA?: RealtimeClient; // B -> A
};

const CONFS = new Map<string, ConfState>();

function getParam(startMsg: any, name: string): string {
  const p = startMsg?.start?.customParameters || startMsg?.start?.custom_parameters || {};
  return (p?.[name] || '').toString();
}

function makeTranslatorClient(openaiApiKey: string, model: string, fromLang: string, toLang: string) {
  const c = new RealtimeClient({ apiKey: openaiApiKey, model });

  c.updateSession({
    modalities: ['audio', 'text'],
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    turn_detection: { type: 'server_vad' },
    instructions:
      `You are a real-time telephone interpreter.
Rules:
- Always translate from ${fromLang} to ${toLang}.
- Output ONLY the translated content.
- No greetings, no extra phrases, no commentary.
- Keep it short and natural.
`,
  });

  return c;
}

export async function streamingRoute(
  fastify: FastifyInstance,
  opts: { agentConfig: any; openaiApiKey: string; model: string }
) {
  fastify.get('/media-stream', { websocket: true }, (connection: SocketStream) => {
    const ws = connection.socket;

    let leg: Leg | undefined;

    const sendToSignalWire = (msg: any) => {
      try {
        ws.send(JSON.stringify(msg));
      } catch {}
    };

    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Twilio-compatible envelope in your logs: { event: 'start'|'media'|'stop', ... }
      const event = msg?.event;

      if (event === 'start') {
        const conf = getParam(msg, 'conf');
        const role = getParam(msg, 'role') as 'a' | 'b';

        if (!conf || (role !== 'a' && role !== 'b')) {
          ws.close();
          return;
        }

        leg = { ws, conf, role, sendToSignalWire };

        const st = CONFS.get(conf) || {};
        st[role] = leg;
        CONFS.set(conf, st);

        // create clients once
        if (!st.clientAB) st.clientAB = makeTranslatorClient(opts.openaiApiKey, opts.model, 'Russian', 'Hungarian');
        if (!st.clientBA) st.clientBA = makeTranslatorClient(opts.openaiApiKey, opts.model, 'Hungarian', 'Russian');

        // connect clients once
        if (!st.clientAB.isConnected()) await st.clientAB.connect();
        if (!st.clientBA.isConnected()) await st.clientBA.connect();

        // wire output audio to opposite leg
        st.clientAB.on('response.output_audio.delta', (e: any) => {
          const bLeg = CONFS.get(conf)?.b;
          if (!bLeg) return;
          bLeg.sendToSignalWire({
            event: 'media',
            media: { payload: e.delta },
          });
        });

        st.clientBA.on('response.output_audio.delta', (e: any) => {
          const aLeg = CONFS.get(conf)?.a;
          if (!aLeg) return;
          aLeg.sendToSignalWire({
            event: 'media',
            media: { payload: e.delta },
          });
        });

        return;
      }

      if (event === 'media') {
        if (!leg) return;

        const st = CONFS.get(leg.conf);
        if (!st) return;

        const payload = msg?.media?.payload;
        if (!payload) return;

        // A audio -> clientAB, B audio -> clientBA
        if (leg.role === 'a') {
          st.clientAB?.send({
            type: 'input_audio_buffer.append',
            audio: payload,
          });
        } else {
          st.clientBA?.send({
            type: 'input_audio_buffer.append',
            audio: payload,
          });
        }

        return;
      }

      if (event === 'stop') {
        ws.close();
      }
    });

    ws.on('close', async () => {
      try {
        if (!leg) return;
        const st = CONFS.get(leg.conf);
        if (!st) return;

        if (leg.role === 'a') st.a = undefined;
        if (leg.role === 'b') st.b = undefined;

        if (!st.a && !st.b) {
          try { await st.clientAB?.disconnect(); } catch {}
          try { await st.clientBA?.disconnect(); } catch {}
          CONFS.delete(leg.conf);
        }
      } catch (e) {
        logger.error('ws close handler error', e);
      }
    });
  });
}
