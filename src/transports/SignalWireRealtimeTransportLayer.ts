import {
  OpenAIRealtimeWebSocket,
  utils,
} from '@openai/agents/realtime';
import type {
  OpenAIRealtimeWebSocketOptions,
  RealtimeTransportLayerConnectOptions,
  TransportLayerAudio,
  RealtimeSessionConfig,
} from '@openai/agents/realtime';
import { getLogger } from '@openai/agents';
import type {
  WebSocket as NodeWebSocket,
  MessageEvent as NodeMessageEvent,
  ErrorEvent as NodeErrorEvent,
} from 'ws';

import type { ErrorEvent } from 'undici-types';

/**
 * Message format received from SignalWire via WebSocket
 */
interface SignalWireMessage {
  event: string;
  sequenceNumber?: string;     // Message ordering number
  streamSid?: string;

  media?: {
    track?: 'inbound' | 'outbound';  // Audio direction
    chunk?: string;                   // Chunk number
    timestamp?: string;               // Presentation timestamp in ms
    payload: string;                  // Base64 encoded audio
  };

  start?: {
    streamSid: string;
    accountSid?: string;              // Account identifier
    callSid?: string;                 // Call identifier
    tracks?: ('inbound' | 'outbound')[]; // Array of track types
    customParameters?: Record<string, any>;
    mediaFormat?: {
      encoding: string;         // e.g., 'audio/x-mulaw'
      sampleRate: number;       // e.g., 8000
      channels: number;         // e.g., 1 (mono)
    };
  };

  dtmf?: {
    duration?: number;          // Duration in milliseconds
    digit?: string;             // The detected digit
  };

  mark?: {
    name: string;               // Mark identifier (e.g., "itemId:chunkCount" or "done:itemId")
  };
}

/**
 * The options for the SignalWire Realtime Transport Layer.
 */
export type SignalWireRealtimeTransportLayerOptions =
  OpenAIRealtimeWebSocketOptions & {
    /**
     * The websocket that is receiving messages from SignalWire's Media Streams API. Typically the
     * connection gets passed into your request handler when running your WebSocket server.
     */
    signalWireWebSocket: WebSocket | NodeWebSocket;
    /**
     * The audio format to use for input and output audio.
     * - 'g711_ulaw': Standard telephony quality (8kHz) - matches SignalWire default
     * - 'pcm16': High quality uncompressed (24kHz) - for L16 codec
     * @default 'g711_ulaw'
     */
    audioFormat?: 'pcm16' | 'g711_ulaw';
  };

/**
 * An adapter to connect a websocket that is receiving messages from SignalWire's Media Streams API to
 * the OpenAI Realtime API via WebSocket.
 *
 * It automatically handles setting the right audio format for the input and output audio, passing
 * the data along and handling the timing for interruptions using SignalWire's `clear` events.
 *
 * It does require you to run your own WebSocket server that is receiving connection requests from
 * SignalWire.
 *
 * It will emit all SignalWire received messages as `signalwire_message` type messages on the `*` handler.
 * If you are using a `RealtimeSession` you can listen to the `transport_event`.
 *
 * @example
 * ```ts
 * const transport = new SignalWireRealtimeTransportLayer({
 *   signalWireWebSocket: signalWireWebSocket,
 * });
 *
 * transport.on('*', (event) => {
 *   if (event.type === 'signalwire_message') {
 *     // Handle SignalWire message
 *   }
 * });
 * ```
 */
export class SignalWireRealtimeTransportLayer extends OpenAIRealtimeWebSocket {
  #signalWireWebSocket: WebSocket | NodeWebSocket;
  #streamSid: string | null = null;
  #audioChunkCount: number = 0;
  #lastPlayedChunkCount: number = 0;
  #previousItemId: string | null = null;
  #logger = getLogger('openai-agents:extensions:signalwire');
  #audioFormat: 'pcm16' | 'g711_ulaw';



  constructor(options: SignalWireRealtimeTransportLayerOptions) {
    super(options);
    this.#signalWireWebSocket = options.signalWireWebSocket;
    // Default to g711_ulaw (SignalWire's default) if not specified
    this.#audioFormat = options.audioFormat || 'g711_ulaw';
    this.#logger.debug(`SignalWire transport initialized with audio format: ${this.#audioFormat}`);

    // Log configuration details for debugging
    if (this.#audioFormat === 'pcm16') {
      this.#logger.debug('🔊 Using PCM16 (L16@24000h) - High quality 24kHz audio');
    } else {
      this.#logger.debug('🔊 Using G.711 μ-law - Standard telephony 8kHz audio');
    }
  }

  _setInputAndOutputAudioFormat(
    partialConfig?: Partial<RealtimeSessionConfig>,
  ) {
    let newConfig: Partial<RealtimeSessionConfig> = {};
    if (!partialConfig) {
      // Use the audio format specified in constructor
      // @ts-expect-error - this is a valid config
      newConfig.inputAudioFormat = this.#audioFormat;
      // @ts-expect-error - this is a valid config
      newConfig.outputAudioFormat = this.#audioFormat;
    } else {
      newConfig = {
        ...partialConfig,
        // @ts-expect-error - this is a valid config
        inputAudioFormat: partialConfig.inputAudioFormat ?? this.#audioFormat,
        // @ts-expect-error - this is a valid config
        outputAudioFormat: partialConfig.outputAudioFormat ?? this.#audioFormat,
      };
    }
    return newConfig;
  }

  async connect(options: RealtimeTransportLayerConnectOptions) {
    // Set the audio format based on constructor option
    options.initialSessionConfig = this._setInputAndOutputAudioFormat(
      options.initialSessionConfig,
    );

    // Listen to SignalWire messages as quickly as possible
    this.#signalWireWebSocket.addEventListener(
      'message',
      (message: MessageEvent | NodeMessageEvent) => {
        try {
          const data: SignalWireMessage = JSON.parse(message.data.toString());
          if (this.#logger.dontLogModelData) {
            this.#logger.debug('SignalWire message:', data.event);
          } else {
            this.#logger.debug('SignalWire message:', data);
          }
          this.emit('*', {
            type: 'signalwire_message',
            message: data,
          });

          switch (data.event) {
            case 'media':
              if (this.status === 'connected' && data.media?.payload) {
                // Forward audio from SignalWire to OpenAI
                this.sendAudio(utils.base64ToArrayBuffer(data.media.payload));
              }
              break;

            case 'mark':
              if (data.mark?.name) {
                if (!data.mark.name.startsWith('done:') && data.mark.name.includes(':')) {
                  // Track the last chunk that was fully played to the caller
                  const count = Number(data.mark.name.split(':')[1]);
                  if (Number.isFinite(count)) {
                    this.#lastPlayedChunkCount = count;
                    this.#logger.debug(`Mark received: ${data.mark.name}, last played chunk: ${count}`);
                  } else {
                    this.#logger.warn('Invalid mark name received:', data.mark.name);
                  }
                } else if (data.mark.name.startsWith('done:')) {
                  // Audio response completed playing
                  this.#lastPlayedChunkCount = 0;
                  this.#logger.debug(`Mark done received: ${data.mark.name}`);
                }
              }
              break;

            case 'start':
              this.#streamSid = data.start?.streamSid || null;
              break;
            default:
              break;
          }
        } catch (error) {
          this.#logger.error(
            'Error parsing SignalWire message:',
            error,
            'Message:',
            message,
          );
          this.emit('error', {
            type: 'error',
            error,
          });
        }
      },
    );

    // Handle SignalWire WebSocket close
    this.#signalWireWebSocket.addEventListener('close', () => {
      this.#logger.debug('SignalWire WebSocket closed');
      if (this.status !== 'disconnected') {
        this.close();
      }
    });

    // Handle SignalWire WebSocket errors
    this.#signalWireWebSocket.addEventListener(
      'error',
      ((error: ErrorEvent | NodeErrorEvent) => {
        this.emit('error', {
          type: 'error',
          error,
        });
        this.close();
      }) as any,
    );

    // Send completion mark when audio response is done
    this.on('audio_done', () => {
      this.#signalWireWebSocket.send(
        JSON.stringify({
          event: 'mark',
          mark: {
            name: `done:${this.currentItemId}`,
          },
          streamSid: this.#streamSid,
        }),
      );
      this.#logger.debug(`Sent completion mark: done:${this.currentItemId}`);
    });

    // Connect to OpenAI immediately with the specified audio format
    await super.connect(options);
  }

  updateSessionConfig(config: Partial<RealtimeSessionConfig>): void {
    const newConfig = this._setInputAndOutputAudioFormat(config);
    super.updateSessionConfig(newConfig);
  }

  _interrupt(_elapsedTime: number, cancelOngoingResponse: boolean = true) {
    const elapsedTime = this.#lastPlayedChunkCount + 50; /* 50ms buffer */
    this.#logger.debug(
      `Interruption detected, clearing SignalWire audio and truncating OpenAI audio after ${elapsedTime}ms`,
    );
    this.#signalWireWebSocket.send(
      JSON.stringify({
        event: 'clear',
        streamSid: this.#streamSid,
      }),
    );
    super._interrupt(elapsedTime, cancelOngoingResponse);
  }

  protected _onAudio(audioEvent: TransportLayerAudio) {
    this.#logger.debug(
      `Sending audio to SignalWire ${audioEvent.responseId}: (${audioEvent.data.byteLength} bytes)`,
    );
    const audioDelta = {
      event: 'media',
      streamSid: this.#streamSid,
      media: {
        payload: utils.arrayBufferToBase64(audioEvent.data),
      },
    };
    if (this.#previousItemId !== this.currentItemId && this.currentItemId) {
      this.#previousItemId = this.currentItemId;
      this.#audioChunkCount = 0;
    }
    this.#audioChunkCount += audioEvent.data.byteLength / 8;

    // Send the audio chunk
    this.#signalWireWebSocket.send(JSON.stringify(audioDelta));

    // Send a mark event to track when this chunk is played
    this.#signalWireWebSocket.send(
      JSON.stringify({
        event: 'mark',
        streamSid: this.#streamSid,
        mark: {
          name: `${this.currentItemId}:${this.#audioChunkCount}`,
        },
      }),
    );

    this.emit('audio', audioEvent);
  }
}