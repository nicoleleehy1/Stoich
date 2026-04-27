// DEV ONLY — remove before production.
//
// Accepts a raw step payload directly (no extraction lookup, no auth, no
// MongoDB persistence) and runs generateMechanism. Used by the
// /mechanism-test page to iterate on the prompt + validation without having
// to round-trip through the full /api/extract → save → /api/mechanism flow.

import { generateMechanism } from "../../lib/mechanism-generator";
import type {
  MechanismCompoundInput,
  MechanismStepInput,
} from "../../lib/mechanism-types";

function isCompoundList(v: unknown): v is MechanismCompoundInput[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { name?: unknown }).name === "string" &&
      typeof (c as { smiles?: unknown }).smiles === "string"
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  const reactants = isCompoundList(body.reactants) ? body.reactants : null;
  const products = isCompoundList(body.products) ? body.products : null;
  const catalysts = isCompoundList(body.catalysts) ? body.catalysts : [];
  const solvents = isCompoundList(body.solvents) ? body.solvents : [];
  const description =
    typeof body.description === "string" ? body.description : "";
  const stepNumber =
    typeof body.reaction_step_number === "number"
      ? body.reaction_step_number
      : 1;

  if (!reactants || !products) {
    return Response.json(
      {
        error:
          "reactants and products are required arrays of { name, smiles }",
      },
      { status: 400 }
    );
  }

  const input: MechanismStepInput = {
    reaction_step_number: stepNumber,
    reactants,
    products,
    catalysts,
    solvents,
    description,
  };

  try {
    const mechanism = await generateMechanism(input);
    return Response.json({ mechanism });
  } catch (err) {
    console.error("mechanism-test generation failed", err);
    return Response.json(
      { error: "mechanism generation failed" },
      { status: 500 }
    );
  }
}
