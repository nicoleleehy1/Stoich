type Compound = {
  name: string;
  role: string;
  one_line?: string;
};

type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildScript(
  compounds: Compound[],
  conditions: Conditions
): string {
  const reactants = compounds
    .filter((c) => c.role?.toLowerCase() === "reactant")
    .map((c) => c.name);
  const products = compounds
    .filter((c) => c.role?.toLowerCase() === "product")
    .map((c) => c.name);
  const catalysts = compounds
    .filter((c) => c.role?.toLowerCase() === "catalyst")
    .map((c) => c.name);
  const solvents = compounds
    .filter((c) => c.role?.toLowerCase() === "solvent")
    .map((c) => c.name);

  const parts: string[] = [];

  if (reactants.length > 0) {
    parts.push(`In this reaction, ${joinList(reactants)} react`);
  } else {
    parts.push("In this reaction");
  }

  if (catalysts.length > 0) {
    parts.push(`in the presence of ${joinList(catalysts)} as catalyst`);
  }
  if (solvents.length > 0) {
    parts.push(`in ${joinList(solvents)}`);
  }
  if (conditions.temperature) {
    parts.push(`at ${conditions.temperature}`);
  }
  if (conditions.pressure) {
    parts.push(`under ${conditions.pressure}`);
  }
  if (conditions.time) {
    parts.push(`for ${conditions.time}`);
  }

  let intro = parts.join(", ");

  if (products.length > 0) {
    intro += `, yielding ${joinList(products)}`;
  }
  if (conditions.yield) {
    intro += ` at ${conditions.yield} yield`;
  }
  intro += ".";

  if (products.length === 0 && reactants.length === 0 && compounds.length > 0) {
    intro = `The compounds mentioned include ${joinList(
      compounds.map((c) => c.name)
    )}.`;
  }

  if (conditions.notes) {
    intro += ` Note: ${conditions.notes}.`;
  }

  return intro;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "ELEVENLABS_API_KEY not set" },
        { status: 500 }
      );
    }

    const { compounds, conditions } = (await request.json()) as {
      compounds?: Compound[];
      conditions?: Conditions;
    };

    const script = buildScript(
      compounds ?? [],
      conditions ?? {
        temperature: null,
        pressure: null,
        time: null,
        yield: null,
        notes: null,
      }
    );

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("elevenlabs error", res.status, detail);
      return Response.json(
        { error: "narration failed" },
        { status: 500 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Narration-Script": encodeURIComponent(script),
      },
    });
  } catch (e) {
    console.error("narrate failed", e);
    return Response.json({ error: "narration failed" }, { status: 500 });
  }
}
