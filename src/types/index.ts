/**
 * Shared Type Definitions
 *
 * Common interfaces and types used across the application.
 */

import type { RealtimeAgentConfiguration } from '@openai/agents/realtime';

/**
 * Options for streaming route initialization
 */
export interface StreamingOptions {
  agentConfig: RealtimeAgentConfiguration;
  openaiApiKey: string;
  model: string;
}

/**
 * Health check response format
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  uptime: number;
}

/**
 * Audio format options
 */
export type AudioFormat = 'pcm16' | 'g711_ulaw';

/**
 * Server configuration
 */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

/**
 * Agent configuration with audio format
 */
export interface AgentConfig {
  readonly name: string;
  readonly voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  readonly model: string;
  readonly instructions: string;
  readonly audioFormat?: AudioFormat;
}