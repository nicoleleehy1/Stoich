import { getDb } from "../../lib/mongo";
import { embed } from "../../lib/embed";

const DEMO_USER_ID = "demo-user";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ results: [] });
    }

    const vector = await embed(query);
    const db = await getDb();

    const cursor = db.collection("compounds").aggregate([
      {
        $vectorSearch: {
          index: "compound_vector_index",
          path: "embedding",
          queryVector: vector,
          numCandidates: 100,
          limit: 8,
          filter: { user_id: DEMO_USER_ID },
        },
      },
      {
        $project: {
          compound_name: "$name",
          one_line: 1,
          extraction_id: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
      {
        $lookup: {
          from: "extractions",
          localField: "extraction_id",
          foreignField: "_id",
          as: "extraction",
        },
      },
      { $unwind: "$extraction" },
      {
        $project: {
          _id: 0,
          extraction_id: { $toString: "$extraction_id" },
          compound_name: 1,
          one_line: 1,
          score: 1,
          source_text_preview: {
            $substrCP: ["$extraction.source_text", 0, 120],
          },
        },
      },
    ]);

    const results = await cursor.toArray();
    return Response.json({ results });
  } catch (e) {
    console.error("search failed", e);
    return Response.json({ results: [], error: "search unavailable" });
  }
}
