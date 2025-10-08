/**
 * Time Tool for AI Assistant
 *
 * A simple tool that provides the current time in Eastern Time.
 * This is a focused example that always returns consistent timezone information.
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { ERROR_MESSAGES } from '../constants.js';

// ============================================================================
// Time Tool Definition
// ============================================================================

/**
 * Time tool that provides current time in Eastern Time
 *
 * This is a simple example of a tool that doesn't require external APIs.
 * It always returns the time in Eastern Time for consistency.
 *
 * Example usage in conversation:
 * User: "What time is it?"
 * AI: [Uses this tool]
 * AI: "The current time in Eastern Time is Wednesday, September 25, 2025 at 3:45 PM EDT."
 */
export const timeTool = realtimeTool({
  name: 'get_time',
  description: 'Get the current time in Eastern Time',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      const now = new Date();

      // Always format for Eastern Time
      const easternTime = now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      return `The current time in Eastern Time is ${easternTime}.`;
    } catch (error) {
      // Fallback for any errors
      return ERROR_MESSAGES.TIME_UNAVAILABLE;
    }
  },
});