const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent";

const SYSTEM_PROMPT = `You are a chemistry information extraction tool. Read this paragraph and identify every chemical compound mentioned. For each, return:
- name: common name
- iupac: IUPAC name if you know it (else null)
- smiles: canonical SMILES string (REQUIRED — your best guess if uncertain)
- role: 'reactant', 'product', 'catalyst', 'solvent', or 'mentioned'
- one_line: a 12-word-or-less plain-English description of what this compound is

Also extract reaction conditions: temperature, pressure, reaction time, yield. Return null for any field not mentioned in the paragraph. Only fill these if explicitly stated — don't guess.

Return ONLY a JSON object with this exact shape:
{
  "compounds": [{"name": "...", "iupac": "...", "smiles": "...", "role": "...", "one_line": "..."}],
  "conditions": {
    "temperature": "<e.g. '80°C' or null>",
    "pressure": "<e.g. '1 atm' or null>",
    "time": "<e.g. '2 h' or null>",
    "yield": "<e.g. '87%' or null>",
    "notes": "<one short string for anything else relevant, or null>"
  }
}

No markdown, no commentary, no code fences. Just JSON.`;

type Compound = {
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

function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json)?\s*/i, "");
    out = out.replace(/```\s*$/, "");
  }
  return out.trim();
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

    let parsed: { compounds?: Compound[]; conditions?: Partial<Conditions> };
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("json parse failed", e, raw);
      return Response.json({ error: "extraction failed" }, { status: 500 });
    }

    const compounds = (parsed.compounds ?? []).map((c) => ({
      ...c,
      image_url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
        c.smiles
      )}/PNG`,
    }));

    const c = parsed.conditions ?? {};
    const conditions: Conditions = {
      temperature: c.temperature ?? null,
      pressure: c.pressure ?? null,
      time: c.time ?? null,
      yield: c.yield ?? null,
      notes: c.notes ?? null,
    };

    return Response.json({ compounds, conditions });
  } catch (err) {
    console.error("extract failed", err);
    return Response.json({ error: "extraction failed" }, { status: 500 });
  }
}
