/**
 * Weather Tool for AI Assistant
 *
 * This tool demonstrates how to integrate external APIs (US National Weather Service)
 * to provide real-time weather information through voice calls.
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { ERROR_MESSAGES } from '../constants.js';

// ============================================================================
// Weather Service Implementation
// ============================================================================

/**
 * Fetches weather data using the free US National Weather Service API
 *
 * Flow:
 * 1. Convert city name to coordinates (OpenStreetMap Nominatim)
 * 2. Get weather grid point from coordinates (weather.gov)
 * 3. Fetch detailed forecast for that grid point
 *
 * @param location - US city name (e.g., "New York" or "San Francisco, CA")
 * @returns Voice-friendly weather description
 */
async function fetchWeatherData(location: string): Promise<string> {
  try {
    // Step 1: Geocoding - Convert city name to coordinates
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&countrycodes=us&limit=1`;

    const geocodeResponse = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'SignalWire-OpenAI-Voice-Assistant/1.0.0 (Contact: developer@example.com)'
      }
    });

    if (!geocodeResponse.ok) {
        return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
    }

    const geocodeData = await geocodeResponse.json();

    if (!geocodeData || geocodeData.length === 0) {
      return ERROR_MESSAGES.CITY_NOT_FOUND(location);
    }

    const lat = parseFloat(geocodeData[0].lat);
    const lon = parseFloat(geocodeData[0].lon);

    // Step 2: Get weather grid point from weather.gov
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;

    const pointsResponse = await fetch(pointsUrl);

    if (!pointsResponse.ok) {
      return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
    }

    const pointsData = await pointsResponse.json();

    // Step 3: Get the detailed forecast
    const forecastUrl = pointsData.properties?.forecast;

    if (!forecastUrl) {
      return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
    }

    const forecastResponse = await fetch(forecastUrl);

    if (!forecastResponse.ok) {
      return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
    }

    const forecastData = await forecastResponse.json();

    const currentPeriod = forecastData.properties?.periods?.[0];
    if (!currentPeriod) {
      return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
    }

    // Format the response for voice
    const cityName = geocodeData[0].display_name.split(',')[0];
    const weatherReport = `In ${cityName}, it's currently ${currentPeriod.detailedForecast.toLowerCase()}`;

    return weatherReport;

  } catch (error) {
    return ERROR_MESSAGES.WEATHER_UNAVAILABLE;
  }
}

// ============================================================================
// Tool Definition for OpenAI Realtime API
// ============================================================================

/**
 * Weather tool that the AI assistant can use during conversations
 *
 * Example usage in conversation:
 * User: "What's the weather in New York?"
 * AI: [Uses this tool to fetch weather]
 * AI: "In New York, it's currently partly cloudy with a high of 72 degrees..."
 */
export const weatherTool = realtimeTool({
  name: 'get_weather',
  description: 'Get current weather information for any US city',
  parameters: z.object({
    location: z.string().describe('The US city or location to get weather for (include state if needed for clarity)'),
  }),
  execute: async ({ location }) => {
    const weatherData = await fetchWeatherData(location);
    return weatherData;
  },
});