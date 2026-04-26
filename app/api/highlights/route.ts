import { ObjectId } from "mongodb";
import { getDb } from "../../lib/mongo";

const DEMO_USER_ID = "demo-user";

type StoredHighlight = {
  _id: ObjectId;
  user_id: string;
  extraction_id: ObjectId | string;
  text: string;
  start_offset: number;
  end_offset: number;
  color: string;
  note: string | null;
  created_at: Date;
};

function extractionRefFor(id: string): ObjectId | string {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

function serialize(d: StoredHighlight) {
  const ext =
    typeof d.extraction_id === "string"
      ? d.extraction_id
      : d.extraction_id?.toHexString?.() ?? null;
  return {
    id: d._id.toHexString(),
    extraction_id: ext,
    text: d.text,
    start_offset: d.start_offset,
    end_offset: d.end_offset,
    color: d.color,
    note: d.note ?? null,
    created_at:
      d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const extractionId = url.searchParams.get("extraction_id");
    if (!extractionId) {
      return Response.json({ items: [] });
    }
    const db = await getDb();
    const docs = (await db
      .collection("highlights")
      .find({
        user_id: DEMO_USER_ID,
        extraction_id: extractionRefFor(extractionId),
      })
      .sort({ start_offset: 1 })
      .toArray()) as unknown as StoredHighlight[];
    return Response.json({ items: docs.map(serialize) });
  } catch (e) {
    console.error("highlights GET failed", e);
    return Response.json({ items: [], error: "unavailable" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { extraction_id, text, start_offset, end_offset, color, note } = body;
    if (
      typeof extraction_id !== "string" ||
      typeof text !== "string" ||
      typeof start_offset !== "number" ||
      typeof end_offset !== "number" ||
      typeof color !== "string"
    ) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    if (start_offset >= end_offset) {
      return Response.json({ error: "empty range" }, { status: 400 });
    }

    const db = await getDb();
    const id = new ObjectId();
    const now = new Date();
    await db.collection("highlights").insertOne({
      _id: id,
      user_id: DEMO_USER_ID,
      extraction_id: extractionRefFor(extraction_id),
      text,
      start_offset,
      end_offset,
      color,
      note: typeof note === "string" ? note : null,
      created_at: now,
    });

    return Response.json(
      serialize({
        _id: id,
        user_id: DEMO_USER_ID,
        extraction_id,
        text,
        start_offset,
        end_offset,
        color,
        note: typeof note === "string" ? note : null,
        created_at: now,
      })
    );
  } catch (e) {
    console.error("highlights POST failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) {
      return Response.json({ error: "bad id" }, { status: 400 });
    }
    const db = await getDb();
    await db
      .collection("highlights")
      .deleteOne({ _id: new ObjectId(id), user_id: DEMO_USER_ID });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("highlights DELETE failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, note, color } = body;
    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return Response.json({ error: "bad id" }, { status: 400 });
    }
    const update: Record<string, unknown> = {};
    if (note !== undefined) update.note = note;
    if (color !== undefined) update.color = color;
    if (Object.keys(update).length === 0) {
      return Response.json({ ok: true });
    }
    const db = await getDb();
    await db
      .collection("highlights")
      .updateOne(
        { _id: new ObjectId(id), user_id: DEMO_USER_ID },
        { $set: update }
      );
    return Response.json({ ok: true });
  } catch (e) {
    console.error("highlights PATCH failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
