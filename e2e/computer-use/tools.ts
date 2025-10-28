import { tool } from 'ai';
import { z } from 'zod/v4';

export const openWebBrowserTool = tool({
  description: 'Opens the web browser.',
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: 'Web browser opened successfully',
    };
  },
});

export const wait5SecondsTool = tool({
  description:
    'Pauses execution for 5 seconds to allow dynamic content to load or animations to complete.',
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: 'Waited 5 seconds',
    };
  },
});

export const goBackTool = tool({
  description: "Navigates to the previous page in the browser's history.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: 'Navigated back successfully',
    };
  },
});

export const goForwardTool = tool({
  description: "Navigates to the next page in the browser's history.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: 'Navigated forward successfully',
    };
  },
});

export const searchTool = tool({
  description:
    "Navigates to the default search engine's homepage (e.g., Google). Useful for starting a new search task.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      success: true,
      message: 'Navigated to search engine',
    };
  },
});

export const navigateTool = tool({
  description: 'Navigates the browser directly to the specified URL.',
  inputSchema: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  execute: async ({ url }) => {
    return {
      success: true,
      message: `Navigated to ${url}`,
      url,
    };
  },
});

export const clickAtTool = tool({
  description:
    'Clicks at a specific coordinate on the webpage. The x and y values are based on a 1000x1000 grid and are scaled to the screen dimensions.',
  inputSchema: z.object({
    x: z.number().min(0).max(999).describe('X coordinate (0-999)'),
    y: z.number().min(0).max(999).describe('Y coordinate (0-999)'),
  }),
  execute: async ({ x, y }) => {
    return {
      success: true,
      message: `Clicked at coordinates (${x}, ${y})`,
      x,
      y,
    };
  },
});

export const hoverAtTool = tool({
  description:
    'Hovers the mouse at a specific coordinate on the webpage. Useful for revealing sub-menus. x and y are based on a 1000x1000 grid.',
  inputSchema: z.object({
    x: z.number().min(0).max(999).describe('X coordinate (0-999)'),
    y: z.number().min(0).max(999).describe('Y coordinate (0-999)'),
  }),
  execute: async ({ x, y }) => {
    return {
      success: true,
      message: `Hovered at coordinates (${x}, ${y})`,
      x,
      y,
    };
  },
});

export const typeTextAtTool = tool({
  description:
    'Types text at a specific coordinate, defaults to clearing the field first and pressing ENTER after typing, but these can be disabled. x and y are based on a 1000x1000 grid.',
  inputSchema: z.object({
    x: z.number().min(0).max(999).describe('X coordinate (0-999)'),
    y: z.number().min(0).max(999).describe('Y coordinate (0-999)'),
    text: z.string().describe('The text to type'),
    press_enter: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to press ENTER after typing'),
    clear_before_typing: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to clear the field before typing'),
  }),
  execute: async ({ x, y, text, press_enter, clear_before_typing }) => {
    return {
      success: true,
      message: `Typed "${text}" at coordinates (${x}, ${y})`,
      x,
      y,
      text,
      press_enter,
      clear_before_typing,
    };
  },
});

export const keyCombinationTool = tool({
  description:
    'Press keyboard keys or combinations, such as "Control+C" or "Enter". Useful for triggering actions (like submitting a form with "Enter") or clipboard operations.',
  inputSchema: z.object({
    keys: z
      .string()
      .describe('The keys to press (e.g., "enter", "control+c")'),
  }),
  execute: async ({ keys }) => {
    return {
      success: true,
      message: `Pressed key combination: ${keys}`,
      keys,
    };
  },
});

export const scrollDocumentTool = tool({
  description: 'Scrolls the entire webpage "up", "down", "left", or "right".',
  inputSchema: z.object({
    direction: z
      .enum(['up', 'down', 'left', 'right'])
      .describe('The direction to scroll'),
  }),
  execute: async ({ direction }) => {
    return {
      success: true,
      message: `Scrolled document ${direction}`,
      direction,
    };
  },
});

export const scrollAtTool = tool({
  description:
    'Scrolls a specific element or area at coordinate (x, y) in the specified direction by a certain magnitude. Coordinates and magnitude (default 800) are based on a 1000x1000 grid.',
  inputSchema: z.object({
    x: z.number().min(0).max(999).describe('X coordinate (0-999)'),
    y: z.number().min(0).max(999).describe('Y coordinate (0-999)'),
    direction: z
      .enum(['up', 'down', 'left', 'right'])
      .describe('The direction to scroll'),
    magnitude: z
      .number()
      .min(0)
      .max(999)
      .optional()
      .default(800)
      .describe('The scroll magnitude (0-999, default 800)'),
  }),
  execute: async ({ x, y, direction, magnitude }) => {
    return {
      success: true,
      message: `Scrolled ${direction} at coordinates (${x}, ${y}) with magnitude ${magnitude}`,
      x,
      y,
      direction,
      magnitude,
    };
  },
});

export const dragAndDropTool = tool({
  description:
    'Drags an element from a starting coordinate (x, y) and drops it at a destination coordinate (destination_x, destination_y). All coordinates are based on a 1000x1000 grid.',
  inputSchema: z.object({
    x: z.number().min(0).max(999).describe('Starting X coordinate (0-999)'),
    y: z.number().min(0).max(999).describe('Starting Y coordinate (0-999)'),
    destination_x: z
      .number()
      .min(0)
      .max(999)
      .describe('Destination X coordinate (0-999)'),
    destination_y: z
      .number()
      .min(0)
      .max(999)
      .describe('Destination Y coordinate (0-999)'),
  }),
  execute: async ({ x, y, destination_x, destination_y }) => {
    return {
      success: true,
      message: `Dragged from (${x}, ${y}) to (${destination_x}, ${destination_y})`,
      x,
      y,
      destination_x,
      destination_y,
    };
  },
});
