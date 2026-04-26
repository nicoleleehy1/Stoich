import { getDb } from "../../lib/mongo";

const DEMO_USER_ID = "demo-user";

type StoredCompound = {
  name: string;
  role: string;
};

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db
      .collection("extractions")
      .find({ user_id: DEMO_USER_ID })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    const items = docs.map((d) => {
      const compounds = (d.compounds ?? []) as StoredCompound[];
      const product = compounds.find(
        (c) => c.role?.toLowerCase() === "product"
      );
      const primary = product?.name ?? compounds[0]?.name ?? "(no compounds)";
      const source = (d.source_text ?? "") as string;
      return {
        id: d._id.toHexString(),
        source_text_preview:
          source.length > 120 ? `${source.slice(0, 120)}…` : source,
        compound_count: compounds.length,
        primary_product_name: primary,
        created_at: d.created_at,
      };
    });

    return Response.json({ items });
  } catch (e) {
    console.error("history failed", e);
    return Response.json({ items: [], error: "history unavailable" });
  }
}
