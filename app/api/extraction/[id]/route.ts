import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongo";

const DEMO_USER_ID = "demo-user";

type StoredCompound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
};

type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

type StoredStep = {
  step_number?: number;
  description?: string;
  compounds?: StoredCompound[];
  conditions?: Partial<Conditions>;
};

const EMPTY_CONDITIONS: Conditions = {
  temperature: null,
  pressure: null,
  time: null,
  yield: null,
  notes: null,
};

function withImage(c: StoredCompound) {
  return {
    ...c,
    image_url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
      c.smiles
    )}/PNG`,
  };
}

function normalizeConditions(c: Partial<Conditions> | undefined): Conditions {
  return {
    temperature: c?.temperature ?? null,
    pressure: c?.pressure ?? null,
    time: c?.time ?? null,
    yield: c?.yield ?? null,
    notes: c?.notes ?? null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "bad id" }, { status: 400 });
    }
    const db = await getDb();
    const doc = await db
      .collection("extractions")
      .findOne({ _id: new ObjectId(id), user_id: DEMO_USER_ID });
    if (!doc) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const flatStored = (doc.compounds ?? []) as StoredCompound[];
    const flatCompounds = flatStored.map(withImage);

    const storedSteps = (doc.steps ?? []) as StoredStep[];
    const steps =
      storedSteps.length > 0
        ? storedSteps.map((s, i) => ({
            step_number: s.step_number ?? i + 1,
            description: s.description ?? "",
            compounds: (s.compounds ?? []).map(withImage),
            conditions: normalizeConditions(s.conditions),
          }))
        : [
            {
              step_number: 1,
              description: "",
              compounds: flatCompounds,
              conditions: normalizeConditions(
                doc.conditions as Partial<Conditions> | undefined
              ),
            },
          ];

    return Response.json({
      id: doc._id.toHexString(),
      source_text: doc.source_text ?? "",
      steps,
      compounds: flatCompounds,
      conditions:
        normalizeConditions(doc.conditions as Partial<Conditions> | undefined) ??
        EMPTY_CONDITIONS,
    });
  } catch (e) {
    console.error("get extraction failed", e);
    return Response.json({ error: "fetch failed" }, { status: 500 });
  }
}
