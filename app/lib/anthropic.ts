import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client. The SDK is HTTP-based so the underlying state
// is just an apiKey + fetch — but allocating one instance keeps the API
// surface tidy and matches how we hold the Mongo client.

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before calling Claude."
    );
  }

  cached = new Anthropic({ apiKey });
  return cached;
}
