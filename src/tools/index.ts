/**
 * Tool Registry for AI Assistant
 *
 * This file exports all available tools that the AI assistant can use.
 * To add a new tool:
 * 1. Create a new file in this directory (e.g., translation.tool.ts)
 * 2. Import it below
 * 3. Add it to the allTools array
 */

import { weatherTool } from './weather.tool.js';
import { timeTool } from './time.tool.js';

// Export individual tools
export { weatherTool, timeTool };

/**
 * All available tools for the AI assistant
 * Add new tools to this array to make them available
 */
export const allTools = [
  weatherTool,
  timeTool,
  // Add more tools here as you create them
];