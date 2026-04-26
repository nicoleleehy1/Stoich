import OpenAI from "openai";

let cached: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
  }
  return cached;
}

export async function embed(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}
