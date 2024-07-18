import { getWeather } from "../stream-example";
import type { NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelName = searchParams.get("modelName") || "openai/gpt-4o";
    return getWeather(modelName);
  } catch (e: unknown) {
    console.error(e);
    return new Response("Error", { status: 500 });
  }
}
