import { streamText } from "ai";
import { createOpenRouter } from "openrouter-ai-provider";
import { z } from "zod";

export const getLasagnaRecipe = async (modelName: string) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const result = await streamText({
    model: openrouter(modelName),
    prompt: "Write a vegetarian lasagna recipe for 4 people.",
    tools: {
      celsiusToFahrenheit: {
        description: "Converts celsius to fahrenheit",
        parameters: z.object({
          value: z.string().describe("The value in celsius"),
        }),
        execute: async ({ value }) => {
          const celsius = parseFloat(value);
          const fahrenheit = celsius * (9 / 5) + 32;
          return `${celsius}°C is ${fahrenheit.toFixed(2)}°F`;
        },
      },
    },
  });
  return result.toAIStreamResponse();
};
