import { tool } from 'ai';
import { z } from 'zod';

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export const getCurrentWeather = tool({
  description:
    'Look up an approximate weather report for a location. Useful for travel planning or casual questions.',
  inputSchema: z.object({
    location: z
      .string({ description: 'City, region, or coordinates describing the location to inspect.' })
      .min(2),
    unit: z
      .enum(['celsius', 'fahrenheit'], {
        description: 'Unit to use when reporting the temperature.',
      })
      .default('celsius'),
  }),
  execute: async ({ location, unit }) => {
    const fakeTemperatureCelsius = 18 + Math.random() * 10;
    const temperatureCelsius = roundTo(fakeTemperatureCelsius, 1);
    const temperatureFahrenheit = roundTo((temperatureCelsius * 9) / 5 + 32, 1);

    return {
      location,
      unit,
      report: `Skies are mostly clear over ${location}. A gentle breeze keeps the humidity comfortable.`,
      temperature: unit === 'celsius' ? temperatureCelsius : temperatureFahrenheit,
      feelsLike: unit === 'celsius'
        ? roundTo(temperatureCelsius - 1.1, 1)
        : roundTo(temperatureFahrenheit - 1.8, 1),
      humidity: roundTo(52 + Math.random() * 8, 1),
      windKph: roundTo(8 + Math.random() * 6, 1),
      source: 'open-meteorology.example',
    };
  },
});

export const getCurrentTime = tool({
  description:
    'Return the current local time for a requested IANA timezone or city description. '
    + 'Helpful for scheduling and calendar coordination tasks.',
  inputSchema: z.object({
    timezone: z
      .string({ description: 'An IANA timezone such as "Europe/Paris" or "America/New_York".' })
      .default('UTC'),
    locale: z
      .string({ description: 'BCP47 locale string used when formatting the timestamp.' })
      .default('en-US'),
  }),
  execute: async ({ timezone, locale }) => {
    const now = new Date();
    let formatted: string;
    try {
      formatted = now.toLocaleString(locale, { timeZone: timezone, hour12: false });
    } catch (_error) {
      formatted = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
      return {
        timezone,
        locale,
        iso: now.toISOString(),
        formatted,
        note: `Unable to format for timezone "${timezone}". Falling back to UTC.`,
      };
    }

    return {
      timezone,
      locale,
      iso: now.toISOString(),
      formatted,
    };
  },
});

export const BASIC_TOOLS = {
  getCurrentWeather,
  getCurrentTime,
};
