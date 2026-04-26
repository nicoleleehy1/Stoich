import { ObjectId } from "mongodb";
import { getDb } from "../../lib/mongo";
import { embed } from "../../lib/embed";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent";

const SYSTEM_PROMPT = `You are a chemistry information extraction tool. Read this paragraph and identify every reaction step described.

For each compound mentioned in a step, return:
- name: common name
- iupac: IUPAC name if you know it (else null)
- smiles: canonical SMILES string (REQUIRED — your best guess if uncertain)
- role: 'reactant', 'product', 'catalyst', 'solvent', or 'mentioned'
- one_line: a 12-word-or-less plain-English description of what this compound is

For each step, also extract reaction conditions: temperature, pressure, reaction time, yield. Return null for any field not mentioned in the paragraph. Only fill these if explicitly stated — don't guess.

If the paragraph describes a SINGLE reaction, return one step. If it describes MULTIPLE sequential reactions (e.g. "step 1: ... then step 2: ..." or "first... afterwards..."), return one entry per step. Each step's compounds and conditions should ONLY include what's relevant to THAT step. A compound that appears as product in step 1 may appear as reactant in step 2 — list it in both.

Return ONLY a JSON object with this exact shape:
{
  "steps": [
    {
      "step_number": 1,
      "description": "<one sentence summary of what happens in this step>",
      "compounds": [{"name": "...", "iupac": "...", "smiles": "...", "role": "...", "one_line": "..."}],
      "conditions": {
        "temperature": "<e.g. '80°C' or null>",
        "pressure": "<e.g. '1 atm' or null>",
        "time": "<e.g. '2 h' or null>",
        "yield": "<e.g. '87%' or null>",
        "notes": "<one short string for anything else relevant, or null>"
      }
    }
  ]
}

No markdown, no commentary, no code fences. Just JSON.`;

const DEMO_USER_ID = "demo-user";

type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
};

type CompoundWithImage = Compound & { image_url: string };

type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

type Step = {
  step_number: number;
  description: string;
  compounds: Compound[];
  conditions: Conditions;
};

type StepWithImages = Omit<Step, "compounds"> & { compounds: CompoundWithImage[] };

const EMPTY_CONDITIONS: Conditions = {
  temperature: null,
  pressure: null,
  time: null,
  yield: null,
  notes: null,
};

function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json)?\s*/i, "");
    out = out.replace(/```\s*$/, "");
  }
  return out.trim();
}

function attachImage(c: Compound): CompoundWithImage {
  return {
    ...c,
    image_url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
      c.smiles
    )}/PNG`,
  };
}

function flattenCompounds(steps: Step[]): Compound[] {
  // Dedupe by lowercased name; later occurrences override earlier (so the
  // "last step's role" wins).
  const map = new Map<string, Compound>();
  for (const step of steps) {
    for (const c of step.compounds ?? []) {
      const key = (c.name ?? "").trim().toLowerCase();
      if (!key) continue;
      map.set(key, c);
    }
  }
  return Array.from(map.values());
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

async function persistExtraction(
  sourceText: string,
  steps: Step[],
  flatCompounds: Compound[],
  primaryConditions: Conditions
): Promise<string | null> {
  try {
    const db = await getDb();
    const now = new Date();

    const extractionId = new ObjectId();
    await db.collection("extractions").insertOne({
      _id: extractionId,
      user_id: DEMO_USER_ID,
      source_text: sourceText,
      steps,
      compounds: flatCompounds,
      conditions: primaryConditions,
      created_at: now,
    });

    const compoundDocs = await Promise.all(
      flatCompounds.map(async (c) => {
        let embedding: number[] | null = null;
        try {
          embedding = await embed(`${c.name}: ${c.one_line}`);
        } catch (e) {
          console.error("embed failed for compound", c.name, e);
        }
        return {
          _id: new ObjectId(),
          extraction_id: extractionId,
          user_id: DEMO_USER_ID,
          name: c.name,
          smiles: c.smiles,
          iupac: c.iupac,
          role: c.role,
          one_line: c.one_line,
          embedding,
          created_at: now,
        };
      })
    );

    if (compoundDocs.length > 0) {
      await db.collection("compounds").insertMany(compoundDocs);
    }

    return extractionId.toHexString();
  } catch (e) {
    console.error("persist failed (mongo unreachable?)", e);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "missing text" }, { status: 400 });
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMMA_API_KEY ?? "",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nParagraph:\n${text}` }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("gemma error", res.status, detail);
      return Response.json({ error: "extraction failed" }, { status: 500 });
    }

    const data = await res.json();
    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    const cleaned = stripFences(raw);

    let parsed: {
      steps?: Array<{
        step_number?: number;
        description?: string;
        compounds?: Compound[];
        conditions?: Partial<Conditions>;
      }>;
      // Fallback in case Gemma returns the old shape
      compounds?: Compound[];
      conditions?: Partial<Conditions>;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("json parse failed", e, raw);
      return Response.json({ error: "extraction failed" }, { status: 500 });
    }

    let steps: Step[];
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      steps = parsed.steps.map((s, i) => ({
        step_number: s.step_number ?? i + 1,
        description: s.description ?? "",
        compounds: s.compounds ?? [],
        conditions: normalizeConditions(s.conditions),
      }));
    } else {
      steps = [
        {
          step_number: 1,
          description: "",
          compounds: parsed.compounds ?? [],
          conditions: normalizeConditions(parsed.conditions),
        },
      ];
    }

    const flat = flattenCompounds(steps);
    const primaryConditions = steps[0]?.conditions ?? EMPTY_CONDITIONS;

    const extraction_id = await persistExtraction(
      text,
      steps,
      flat,
      primaryConditions
    );

    const stepsWithImages: StepWithImages[] = steps.map((s) => ({
      ...s,
      compounds: s.compounds.map(attachImage),
    }));
    const flatWithImages: CompoundWithImage[] = flat.map(attachImage);

    return Response.json({
      steps: stepsWithImages,
      compounds: flatWithImages,
      conditions: primaryConditions,
      extraction_id,
    });
  } catch (err) {
    console.error("extract failed", err);
    return Response.json({ error: "extraction failed" }, { status: 500 });
  }
}
