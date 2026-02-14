import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';

type Role = 'a' | 'b';

type SwStartMessage = {
  event: 'start';
  start: {
    streamSid: string;
    callSid?: string;
    customParameters?: Record<string, string>;
  };
};

type SwMediaMessage = {
  event: 'media';
  streamSid: string;
  media: {
    payload: string; // base64 PCMU
  };
};

type SwStopMessage = {
  event: 'stop';
  streamSid: string;
};

type SwAnyMessage = SwStartMessage | SwMediaMessage | SwStopMessage | any;

type Pair = {
  conf: string;
  a?: Leg;
  b?: Leg;
  createdAt: number;
};

type Leg = {
  role: Role;
  swWs: WebSocket;
  streamSid: string;
  conf: string;

  // OpenAI realtime socket
  aiWs?: WebSocket;
  aiReady: boolean;
  aiSpeaking: boolean; // if we're currently emitting audio
  targetRole: Role; // opposite role
};

type StreamingOptions = {
  agentConfig: any;
  openaiApiKey: string;
  model: string;
};

const pairs = new Map<string, Pair>();

function getPair(conf: string): Pair {
  let p = pairs.get(conf);
  if (!p) {
    p = { conf, createdAt: Date.now() };
    pairs.set(conf, p);
  }
  return p;
}

function opposite(role: Role): Role {
  return role === 'a' ? 'b' : 'a';
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function sendToSignalWire(ws: WebSocket, obj: any) {
  if (ws.readyState === (ws as any).OPEN) ws.send(JSON.stringify(obj));
}

function swClear(ws: WebSocket, streamSid: string) {
  // Clear any buffered audio on SignalWire side (supported by Twilio-style streams; SignalWire compatibility layer accepts it)
  sendToSignalWire(ws, { event: 'clear', streamSid });
}

function swSendAudio(ws: WebSocket, streamSid: string, base64Pcmu: string) {
  const msg = {
    event: 'media',
    streamSid,
    media: { payload: base64Pcmu },
  };
  sendToSignalWire(ws, msg);
}

function log(...args: any[]) {
  // keep minimal
  console.log(...args);
}

/**
 * Create OpenAI Realtime WS and configure it for streaming translation.
 * We keep one AI session per leg so that STT/VAD happens independently.
 */
async function connectOpenAI(leg: Leg, opts: { apiKey: string; model: string; srcLang: string; dstLang: string }) {
  // dynamic import to avoid type conflicts
  const WS = (await import('ws')).default;

  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(opts.model)}`;

  const aiWs = new WS(url, {
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  leg.aiWs = aiWs;
  leg.aiReady = false;
  leg.aiSpeaking = false;

  aiWs.on('open', () => {
    // Configure session: input/output are PCMU for telephony streams.
    // Turn on server VAD so we can trigger responses when speech ends.
    const instructions =
      `You are a real-time phone call translator.\n` +
      `Rules:\n` +
      `- The caller speaks ${opts.srcLang}. The other party needs ${opts.dstLang}.\n` +
      `- Translate ONLY what the caller said into ${opts.dstLang}.\n` +
      `- Do not add explanations, do not answer questions, do not chat.\n` +
      `- Output must be ONLY the translated text, as natural spoken language.\n` +
      `- Keep it short and immediate.\n`;

    aiWs.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          instructions,
          input_audio_format: { type: 'audio/pcmu' },
          output_audio_format: { type: 'audio/pcmu' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 150,
            silence_duration_ms: 350,
          },
          // Voice must exist in the model; alloy is safe in most examples.
          voice: 'alloy',
          // We want audio only
          modalities: ['audio'],
        },
      })
    );

    leg.aiReady = true;
    log(`✅ OpenAI realtime connected for role=${leg.role} (${opts.srcLang}→${opts.dstLang})`);
  });

  aiWs.on('message', (buf: Buffer) => {
    const msg = safeJsonParse(buf.toString('utf8'));
    if (!msg || !msg.type) return;

    // When AI emits audio, we forward it to the opposite SignalWire leg
    if (msg.type === 'response.output_audio.delta' && typeof msg.delta === 'string') {
      const pair = pairs.get(leg.conf);
      if (!pair) return;

      const target = leg.targetRole === 'a' ? pair.a : pair.b;
      if (!target) return;

      // If we start speaking, clear target buffer once to avoid overlap
      if (!leg.aiSpeaking) {
        leg.aiSpeaking = true;
        swClear(target.swWs, target.streamSid);
      }

      swSendAudio(target.swWs, target.streamSid, msg.delta);
      return;
    }

    // Done speaking
    if (msg.type === 'response.output_audio.done') {
      leg.aiSpeaking = false;
      return;
    }

    // When server VAD says user stopped talking, request response
    if (msg.type === 'input_audio_buffer.speech_stopped') {
      if (leg.aiWs && leg.aiReady) {
        leg.aiWs.send(JSON.stringify({ type: 'response.create' }));
      }
      return;
    }

    // Optional: ignore everything else
  });

  aiWs.on('close', () => {
    leg.aiReady = false;
    leg.aiSpeaking = false;
    log(`🔌 OpenAI realtime closed for role=${leg.role}`);
  });

  aiWs.on('error', (e: any) => {
    log(`❌ OpenAI realtime error role=${leg.role}:`, e?.message || e);
  });
}

/**
 * Main route: /media-stream (SignalWire WS)
 */
export async function streamingRoute(fastify: FastifyInstance, options: StreamingOptions) {
  fastify.get(
    '/media-stream',
    { websocket: true },
    async (connection /* FastifyWebsocket */, req /* FastifyRequest */) => {
      const swWs = connection.socket as unknown as WebSocket;

      // We'll set these after we receive "start"
      let leg: Leg | null = null;

      swWs.on('message', async (raw: Buffer) => {
        const msg = safeJsonParse(raw.toString('utf8')) as SwAnyMessage;
        if (!msg || !msg.event) return;

        if (msg.event === 'start') {
          const start = (msg as SwStartMessage).start;
          const streamSid = start.streamSid;

          const conf = start.customParameters?.conf || '';
          const roleRaw = (start.customParameters?.role || 'a') as Role;

          if (!conf || (roleRaw !== 'a' && roleRaw !== 'b')) {
            log('❌ Missing conf/role in start.customParameters. Got:', start.customParameters);
            // Close: cannot route without pairing key
            try {
              swWs.close();
            } catch {}
            return;
          }

          leg = {
            role: roleRaw,
            swWs,
            streamSid,
            conf,
            aiReady: false,
            aiSpeaking: false,
            targetRole: opposite(roleRaw),
          };

          const pair = getPair(conf);
          if (roleRaw === 'a') pair.a = leg;
          else pair.b = leg;

          log(`📞 SignalWire stream connected conf=${conf} role=${roleRaw} streamSid=${streamSid}`);

          // Create OpenAI sessions:
          // a: RU→HU, b: HU→RU (поменяй если у тебя другое)
          const srcLang = roleRaw === 'a' ? 'Russian' : 'Hungarian';
          const dstLang = roleRaw === 'a' ? 'Hungarian' : 'Russian';

          await connectOpenAI(leg, {
            apiKey: options.openaiApiKey,
            model: options.model,
            srcLang,
            dstLang,
          });

          return;
        }

        if (msg.event === 'media') {
          if (!leg || !leg.aiWs || !leg.aiReady) return;

          const media = msg as SwMediaMessage;
          if (!media?.media?.payload) return;

          // Forward inbound audio to OpenAI input buffer
          // payload is base64 audio/pcmu
          leg.aiWs.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: media.media.payload,
            })
          );

          return;
        }

        if (msg.event === 'stop') {
          // call ended
          if (leg?.aiWs) {
            try {
              leg.aiWs.close();
            } catch {}
          }
          return;
        }
      });

      swWs.on('close', () => {
        if (leg) {
          const p = pairs.get(leg.conf);
          if (p) {
            if (leg.role === 'a') p.a = undefined;
            else p.b = undefined;

            // cleanup if both gone
            if (!p.a && !p.b) pairs.delete(leg.conf);
          }

          if (leg.aiWs) {
            try {
              leg.aiWs.close();
            } catch {}
          }
        }
      });

      swWs.on('error', (e: any) => {
        log('❌ SignalWire WS error:', e?.message || e);
      });
    }
  );
}
