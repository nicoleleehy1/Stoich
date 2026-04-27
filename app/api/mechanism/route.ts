import { ObjectId } from "mongodb";
import { getDb } from "../../lib/mongo";
import { generateMechanism } from "../../lib/mechanism-generator";
import type {
  MechanismCompoundInput,
  MechanismStepInput,
  ReactionMechanism,
} from "../../lib/mechanism-types";

const DEMO_USER_ID = "demo-user";

type StoredCompound = {
  name: string;
  smiles: string;
  role?: string;
};

type StoredStep = {
  step_number: number;
  description: string;
  compounds: StoredCompound[];
  conditions: unknown;
  mechanism?: ReactionMechanism | null;
};

type StoredExtraction = {
  _id: ObjectId;
  user_id: string;
  source_text: string;
  steps: StoredStep[];
  created_at: Date;
};

function bucketByRole(
  compounds: StoredCompound[]
): Pick<MechanismStepInput, "reactants" | "products" | "catalysts" | "solvents"> {
  const reactants: MechanismCompoundInput[] = [];
  const products: MechanismCompoundInput[] = [];
  const catalysts: MechanismCompoundInput[] = [];
  const solvents: MechanismCompoundInput[] = [];
  for (const c of compounds) {
    if (!c.smiles) continue;
    const entry: MechanismCompoundInput = { name: c.name, smiles: c.smiles };
    const role = (c.role ?? "").toLowerCase();
    if (role === "reactant") reactants.push(entry);
    else if (role === "product") products.push(entry);
    else if (role === "catalyst") catalysts.push(entry);
    else if (role === "solvent") solvents.push(entry);
    // "mentioned" and other roles are intentionally dropped — they aren't
    // part of the mechanism's electron flow.
  }
  return { reactants, products, catalysts, solvents };
}

export async function POST(request: Request) {
  let body: { extraction_id?: unknown; step_number?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  const extractionId =
    typeof body.extraction_id === "string" ? body.extraction_id : null;
  const stepNumber =
    typeof body.step_number === "number" ? body.step_number : null;

  if (!extractionId || !ObjectId.isValid(extractionId) || stepNumber == null) {
    return Response.json(
      { error: "extraction_id (ObjectId hex) and step_number are required" },
      { status: 400 }
    );
  }

  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error("mongo unavailable", err);
    return Response.json({ error: "database unavailable" }, { status: 500 });
  }

  const extraction = (await db
    .collection("extractions")
    .findOne({ _id: new ObjectId(extractionId) })) as StoredExtraction | null;

  if (!extraction) {
    return Response.json({ error: "extraction not found" }, { status: 404 });
  }

  if (extraction.user_id !== DEMO_USER_ID) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const stepIndex = extraction.steps.findIndex(
    (s) => s.step_number === stepNumber
  );
  if (stepIndex < 0) {
    return Response.json({ error: "step not found" }, { status: 404 });
  }

  const step = extraction.steps[stepIndex];

  if (step.mechanism) {
    return Response.json({ mechanism: step.mechanism, cached: true });
  }

  const buckets = bucketByRole(step.compounds ?? []);
  const stepInput: MechanismStepInput = {
    reaction_step_number: step.step_number,
    description: step.description ?? "",
    ...buckets,
  };

  let mechanism: ReactionMechanism | null;
  try {
    mechanism = await generateMechanism(stepInput);
  } catch (err) {
    console.error("generateMechanism threw", err);
    return Response.json(
      { error: "mechanism generation failed" },
      { status: 500 }
    );
  }

  try {
    await db.collection("extractions").updateOne(
      { _id: new ObjectId(extractionId) },
      { $set: { [`steps.${stepIndex}.mechanism`]: mechanism } }
    );
  } catch (err) {
    // Persistence failure shouldn't block returning the result — caller
    // still gets the mechanism, it just won't be cached for the next call.
    console.error("mechanism cache write failed", err);
  }

  return Response.json({ mechanism, cached: false });
}
