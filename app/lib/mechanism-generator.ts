import { getAnthropicClient } from "./anthropic";
import type {
  Arrow,
  ArrowSource,
  ArrowTarget,
  MechanismStep,
  MechanismStepInput,
  ReactionMechanism,
} from "./mechanism-types";

// COST AWARENESS
// --------------
// Each call to generateMechanism with Sonnet 4.5 typically uses:
//   * Input: ~800-2000 tokens (system prompt + compounds + per-atom
//             enumeration + description). The system prompt is marked
//             cache_control: ephemeral, so a repeat call within ~5 minutes
//             pays roughly 10% of the input cost on the cached portion.
//   * Output: ~500-1500 tokens of JSON.
//   * Net cost per call: roughly $0.005-$0.020.
// Mechanisms are cached on the extraction document in MongoDB after first
// generation, so each unique reaction step only costs once.

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are an expert organic chemistry mechanism analyst. Given a single reaction step (reactants, products, catalysts, solvents, and a description), produce the curved-arrow mechanism that explains how the step proceeds.

CURVED-ARROW NOTATION
- A double-barbed arrow ("electron_count": 2) represents the flow of an electron pair.
- A single-barbed (fishhook) arrow ("electron_count": 1) represents a single-electron flow (radical mechanism).
- Each arrow has a SOURCE (where the electrons come from) and a TARGET (where they end up).
- SOURCE kinds:
  * "lone-pair"  — a non-bonding electron pair on an atom
  * "bond"       — a sigma bond between two atoms (within ONE molecule)
  * "pi-bond"    — a pi bond between two atoms (component of a double/triple bond)
- TARGET kinds:
  * "atom"           — electrons localize onto a single atom (e.g. a positively charged atom receiving a nucleophile)
  * "bond-formation" — electrons form a new bond between two atoms WITHIN the same molecule
  * "between-atoms"  — electrons form a new bond between atoms on TWO DIFFERENT molecules (intermolecular attack)

ATOM INDEXING — READ CAREFULLY
- Each compound below is presented with an explicit ATOM ENUMERATION listing every heavy atom by 0-based index, element, and chemical-role context.
- When referencing atoms, use ONLY the indices from the atom enumeration provided for each compound. Do NOT invent atom indices, do NOT count atoms in the SMILES yourself, and do NOT renumber atoms.
- Cite SMILES strings VERBATIM as listed in the enumeration. Do not regenerate or normalize them.
- If you cannot confidently identify the correct atom from the enumeration, OMIT that arrow rather than guess.
- If the mechanism requires an atom that isn't in any of the provided molecules (e.g. a proton released into solution, a free electron pair on bulk solvent), use the kind "between-atoms" with one side referencing a real molecule's atom and the other side referencing another real molecule's atom. Do NOT invent placeholder SMILES or atom indices.

MECHANISM STRUCTURE
- Break the mechanism into sub_steps. Each sub_step represents one moment in the mechanism and may contain 1-3 arrows for simultaneous (concerted) electron flows.
- Order sub_steps chronologically (e.g. protonation → nucleophilic attack → tetrahedral intermediate collapse → deprotonation).
- Set confidence:
  * "high"   — well-established textbook mechanism (Fischer esterification, SN2, E1, Friedel-Crafts, etc.)
  * "medium" — plausible but with ambiguity in regiochemistry, stereochemistry, or step ordering
  * "low"    — mechanism is genuinely unclear from the data given. Still attempt the most likely arrows but be sparse.

OUTPUT FORMAT
Return ONLY a single JSON object — no commentary, no markdown fences, no prose before or after. Match this schema EXACTLY:

{
  "reaction_step_number": <number>,
  "mechanism_class": "<short label, e.g. 'Nucleophilic acyl substitution'>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<1-3 sentences on why this mechanism>",
  "sub_steps": [
    {
      "sub_step": 1,
      "caption": "<one-line description>",
      "arrows": [
        {
          "electron_count": 2,
          "source": { "kind": "lone-pair", "molecule_smiles": "<SMILES>", "atom_index": <number> },
          "target": { "kind": "between-atoms", "molecule_a_smiles": "<SMILES>", "atom_a_index": <number>, "molecule_b_smiles": "<SMILES>", "atom_b_index": <number> },
          "curve_direction": "clockwise" | "counterclockwise",
          "description": "<one-line description>"
        }
      ]
    }
  ],
  "unverified_arrows": 0
}

Always emit "unverified_arrows": 0 — the post-processing validator will adjust the count if any arrows are filtered out.

EXAMPLE — Acid-catalyzed Fischer esterification (methanol + acetic acid → methyl acetate + water).

Suppose the user message provides this enumeration:
  methanol (CO):
    atom 0: C (sp3 C)
    atom 1: O (hydroxyl O of -OH)
  acetic acid (CC(=O)O):
    atom 0: C (sp3 C)
    atom 1: C (carbonyl C of carboxyl)
    atom 2: O (carbonyl O =O)
    atom 3: O (hydroxyl O of -COOH)
  proton ([H+]):
    atom 0: H

A reasonable output:

{
  "reaction_step_number": 1,
  "mechanism_class": "Acid-catalyzed Fischer esterification",
  "confidence": "high",
  "reasoning": "Acid protonation of the carbonyl activates it for nucleophilic attack by the alcohol oxygen; the tetrahedral intermediate collapses with loss of water to form the ester.",
  "sub_steps": [
    {
      "sub_step": 1,
      "caption": "Protonation of the carbonyl oxygen of acetic acid by H+",
      "arrows": [
        {
          "electron_count": 2,
          "source": { "kind": "lone-pair", "molecule_smiles": "CC(=O)O", "atom_index": 2 },
          "target": { "kind": "between-atoms", "molecule_a_smiles": "CC(=O)O", "atom_a_index": 2, "molecule_b_smiles": "[H+]", "atom_b_index": 0 },
          "curve_direction": "counterclockwise",
          "description": "Carbonyl O lone pair captures H+"
        }
      ]
    },
    {
      "sub_step": 2,
      "caption": "Methanol oxygen attacks the activated carbonyl carbon",
      "arrows": [
        {
          "electron_count": 2,
          "source": { "kind": "lone-pair", "molecule_smiles": "CO", "atom_index": 1 },
          "target": { "kind": "between-atoms", "molecule_a_smiles": "CO", "atom_a_index": 1, "molecule_b_smiles": "CC(=O)O", "atom_b_index": 1 },
          "curve_direction": "clockwise",
          "description": "Methanol O lone pair attacks carbonyl C of protonated acetic acid"
        }
      ]
    }
  ],
  "unverified_arrows": 0
}

Remember: JSON ONLY. No prose, no markdown fences. Use ONLY the indices from the atom enumeration.`;

// =====================================================================
// SMILES parser + atom enumeration (Option 3 — hand-rolled).
// =====================================================================
//
// Approach: tokenize the SMILES, then walk tokens maintaining a stack of
// "previous atom" indices for branches and a map of open ring-closure
// digits. For each new atom token, emit an atom and (if there's a previous
// atom) a bond to it. This gives us:
//   * canonical 0-based atom indices in appearance order (the indexing
//     RDKit also uses on the client, since both sides walk the same SMILES)
//   * a full bond list, which is enough to infer common chemical roles
//     (carbonyl, hydroxyl, ester O, aromatic C, halogen attachment, etc.)
//
// For complex SMILES with stereo descriptors (@, @@), bond directions
// (/, \), or unusual bracket atoms (e.g. bare Si without brackets), this
// parser may mislabel some bonds — but appearance-order indexing remains
// correct, and that's what Claude actually needs.

export type AtomEnumEntry = {
  index: number;
  element: string;
  context: string;
};

type ParsedAtom = {
  index: number;
  element: string;
  isAromatic: boolean;
};

type ParsedBond = {
  a: number;
  b: number;
  order: number; // 1, 1.5 (aromatic), 2, 3
};

type Token =
  | { type: "atom"; element: string; isAromatic: boolean }
  | { type: "bond"; order: number }
  | { type: "branch_open" }
  | { type: "branch_close" }
  | { type: "ring"; digit: number }
  | { type: "disconnect" };

function parseBracketAtom(inner: string): {
  element: string;
  isAromatic: boolean;
} {
  // Skip leading isotope digits.
  let i = 0;
  while (i < inner.length && inner[i] >= "0" && inner[i] <= "9") i++;
  if (i >= inner.length) return { element: "?", isAromatic: false };
  const first = inner[i];
  if ("bcnops".includes(first)) {
    return { element: first.toUpperCase(), isAromatic: true };
  }
  if (first >= "A" && first <= "Z") {
    if (
      i + 1 < inner.length &&
      inner[i + 1] >= "a" &&
      inner[i + 1] <= "z" &&
      // Two-letter elements: He, Li, Be, Na, Mg, Al, Si, Cl, etc.
      // We accept any A-Z followed by a-z as a two-letter element.
      true
    ) {
      return { element: first + inner[i + 1], isAromatic: false };
    }
    return { element: first, isAromatic: false };
  }
  return { element: "?", isAromatic: false };
}

function tokenize(smiles: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < smiles.length) {
    const c = smiles[i];
    if (c === "(") {
      out.push({ type: "branch_open" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ type: "branch_close" });
      i++;
      continue;
    }
    if (c === "-") {
      out.push({ type: "bond", order: 1 });
      i++;
      continue;
    }
    if (c === "=") {
      out.push({ type: "bond", order: 2 });
      i++;
      continue;
    }
    if (c === "#") {
      out.push({ type: "bond", order: 3 });
      i++;
      continue;
    }
    if (c === ":") {
      out.push({ type: "bond", order: 1.5 });
      i++;
      continue;
    }
    if (c === "/" || c === "\\") {
      out.push({ type: "bond", order: 1 });
      i++;
      continue;
    }
    if (c === ".") {
      out.push({ type: "disconnect" });
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      out.push({ type: "ring", digit: parseInt(c, 10) });
      i++;
      continue;
    }
    if (c === "%") {
      const d = smiles.slice(i + 1, i + 3);
      const digit = parseInt(d, 10);
      if (Number.isFinite(digit)) {
        out.push({ type: "ring", digit });
        i += 3;
        continue;
      }
      i++;
      continue;
    }
    if (c === "[") {
      const close = smiles.indexOf("]", i);
      if (close === -1) break;
      const inner = smiles.slice(i + 1, close);
      const { element, isAromatic } = parseBracketAtom(inner);
      out.push({ type: "atom", element, isAromatic });
      i = close + 1;
      continue;
    }
    if (c === "C" && smiles[i + 1] === "l") {
      out.push({ type: "atom", element: "Cl", isAromatic: false });
      i += 2;
      continue;
    }
    if (c === "B" && smiles[i + 1] === "r") {
      out.push({ type: "atom", element: "Br", isAromatic: false });
      i += 2;
      continue;
    }
    if ("BCNOPSFI".includes(c)) {
      out.push({ type: "atom", element: c, isAromatic: false });
      i++;
      continue;
    }
    if ("bcnops".includes(c)) {
      out.push({
        type: "atom",
        element: c.toUpperCase(),
        isAromatic: true,
      });
      i++;
      continue;
    }
    // Anything else (stereo @, @@, charges that escaped brackets, etc) — skip.
    i++;
  }
  return out;
}

function parseSmiles(smiles: string): {
  atoms: ParsedAtom[];
  bonds: ParsedBond[];
} {
  const tokens = tokenize(smiles);
  const atoms: ParsedAtom[] = [];
  const bonds: ParsedBond[] = [];
  const branchStack: number[] = [];
  const ringMap = new Map<number, { atomIndex: number; bondOrder: number }>();
  let prevAtom: number | null = null;
  let pendingBondOrder: number | null = null;

  for (const tok of tokens) {
    if (tok.type === "atom") {
      const atomIndex = atoms.length;
      atoms.push({
        index: atomIndex,
        element: tok.element,
        isAromatic: tok.isAromatic,
      });
      if (prevAtom !== null) {
        let order = pendingBondOrder ?? 1;
        if (
          pendingBondOrder === null &&
          tok.isAromatic &&
          atoms[prevAtom].isAromatic
        ) {
          order = 1.5;
        }
        bonds.push({ a: prevAtom, b: atomIndex, order });
      }
      prevAtom = atomIndex;
      pendingBondOrder = null;
    } else if (tok.type === "bond") {
      pendingBondOrder = tok.order;
    } else if (tok.type === "branch_open") {
      if (prevAtom !== null) branchStack.push(prevAtom);
    } else if (tok.type === "branch_close") {
      const popped = branchStack.pop();
      if (popped !== undefined) prevAtom = popped;
      pendingBondOrder = null;
    } else if (tok.type === "ring") {
      const existing = ringMap.get(tok.digit);
      if (existing && prevAtom !== null) {
        let order = pendingBondOrder ?? existing.bondOrder;
        if (
          pendingBondOrder === null &&
          existing.bondOrder === 1 &&
          atoms[existing.atomIndex].isAromatic &&
          atoms[prevAtom].isAromatic
        ) {
          order = 1.5;
        }
        bonds.push({ a: existing.atomIndex, b: prevAtom, order });
        ringMap.delete(tok.digit);
        pendingBondOrder = null;
      } else if (prevAtom !== null) {
        ringMap.set(tok.digit, {
          atomIndex: prevAtom,
          bondOrder: pendingBondOrder ?? 1,
        });
        pendingBondOrder = null;
      }
    } else if (tok.type === "disconnect") {
      prevAtom = null;
      pendingBondOrder = null;
    }
  }
  return { atoms, bonds };
}

function buildNeighborMap(
  atoms: ParsedAtom[],
  bonds: ParsedBond[]
): Map<number, { other: ParsedAtom; bond: ParsedBond }[]> {
  const m = new Map<number, { other: ParsedAtom; bond: ParsedBond }[]>();
  for (const a of atoms) m.set(a.index, []);
  for (const b of bonds) {
    m.get(b.a)?.push({ other: atoms[b.b], bond: b });
    m.get(b.b)?.push({ other: atoms[b.a], bond: b });
  }
  return m;
}

function inferContext(
  atom: ParsedAtom,
  neighborMap: Map<number, { other: ParsedAtom; bond: ParsedBond }[]>
): string {
  const sym = atom.element;
  const neighbors = neighborMap.get(atom.index) ?? [];

  if (sym === "O") {
    if (neighbors.length === 0) return "O (free)";
    if (neighbors.length === 1) {
      const n = neighbors[0];
      if (n.bond.order === 2) return "carbonyl O (=O)";
      if (n.other.element === "C") {
        const cNeigh = neighborMap.get(n.other.index) ?? [];
        const cHasDoubleO = cNeigh.some(
          (x) =>
            x.other.element === "O" &&
            x.bond.order === 2 &&
            x.other.index !== atom.index
        );
        if (cHasDoubleO) return "hydroxyl O of -COOH";
        return "hydroxyl O (-OH)";
      }
      return "hydroxyl-like O";
    }
    if (neighbors.length === 2) {
      // Bridging O. If either neighbor C is also part of a C=O, this is an ester O.
      const isEster = neighbors.some((n) => {
        if (n.other.element !== "C") return false;
        const cn = neighborMap.get(n.other.index) ?? [];
        return cn.some(
          (x) =>
            x.other.element === "O" &&
            x.bond.order === 2 &&
            x.other.index !== atom.index
        );
      });
      if (isEster) return "ester O (bridges -O-C=O)";
      return "ether O (-O-)";
    }
    return "O";
  }

  if (sym === "C") {
    const dblO = neighbors.find(
      (n) => n.other.element === "O" && n.bond.order === 2
    );
    const singleO = neighbors.filter(
      (n) => n.other.element === "O" && n.bond.order === 1
    );
    if (dblO) {
      if (singleO.length >= 1) {
        const isEster = singleO.some((o) => {
          const oNeigh = neighborMap.get(o.other.index) ?? [];
          // If the single-bonded O bridges to ANOTHER carbon, this is an ester.
          return oNeigh.some(
            (x) => x.other.element === "C" && x.other.index !== atom.index
          );
        });
        if (isEster) return "carbonyl C of ester (-C(=O)O-)";
        return "carbonyl C of carboxyl (-COOH)";
      }
      // Just C=O with no -O neighbor: aldehyde or ketone.
      return "carbonyl C (C=O)";
    }
    const halogen = neighbors.find((n) =>
      ["F", "Cl", "Br", "I"].includes(n.other.element)
    );
    if (halogen) {
      return atom.isAromatic
        ? `aromatic C bound to ${halogen.other.element}`
        : `sp3 C bound to ${halogen.other.element}`;
    }
    if (atom.isAromatic) return "aromatic C";
    return "sp3 C";
  }

  if (sym === "N") {
    if (atom.isAromatic) return "aromatic N";
    if (neighbors.length === 0) return "N";
    return "amine N";
  }

  if (sym === "S") {
    return atom.isAromatic ? "aromatic S" : "S";
  }

  if (["F", "Cl", "Br", "I"].includes(sym)) {
    return `${sym} (halogen)`;
  }

  if (sym === "H") {
    return neighbors.length === 0 ? "H (free, e.g. H+)" : "H";
  }

  return atom.isAromatic ? `aromatic ${sym}` : sym;
}

export async function enumerateAtoms(
  smiles: string
): Promise<AtomEnumEntry[]> {
  const { atoms, bonds } = parseSmiles(smiles);
  const neighborMap = buildNeighborMap(atoms, bonds);
  return atoms.map((a) => ({
    index: a.index,
    element: a.element,
    context: inferContext(a, neighborMap),
  }));
}

// =====================================================================
// Prompt assembly + Claude call.
// =====================================================================

function formatEnumerationBlock(
  name: string,
  smiles: string,
  enumeration: AtomEnumEntry[]
): string {
  const header = `${name} (SMILES: ${smiles})`;
  if (enumeration.length === 0) {
    return `${header}\n  (no heavy atoms parsed)`;
  }
  const lines = enumeration
    .map((a) => `  atom ${a.index}: ${a.element} (${a.context})`)
    .join("\n");
  return `${header}\n${lines}`;
}

async function buildUserMessage(
  input: MechanismStepInput,
  enumByCompound: Map<string, AtomEnumEntry[]>
): Promise<string> {
  const fmtSection = (
    label: string,
    list: { name: string; smiles: string }[]
  ) => {
    if (list.length === 0) return `${label}: (none)`;
    const blocks = list
      .map((c) =>
        formatEnumerationBlock(
          c.name,
          c.smiles,
          enumByCompound.get(c.smiles) ?? []
        )
      )
      .join("\n\n");
    return `${label}:\n\n${blocks}`;
  };

  const stepNumber = input.reaction_step_number ?? 1;

  return `Reaction step ${stepNumber}.

${fmtSection("REACTANTS", input.reactants)}

${fmtSection("PRODUCTS", input.products)}

${fmtSection("CATALYSTS", input.catalysts)}

${fmtSection("SOLVENTS", input.solvents)}

DESCRIPTION:
${input.description || "(no description provided)"}

Generate the curved-arrow mechanism JSON for this step. Cite SMILES strings VERBATIM as shown above and use ONLY the atom indices from the enumerations.`;
}

function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json)?\s*/i, "");
    out = out.replace(/```\s*$/, "");
  }
  return out.trim();
}

function isValidArrow(
  arrow: Arrow,
  validSet: Set<string>,
  atomCounts: Map<string, number>
): boolean {
  function refOk(smiles: string, atomIndex: number): boolean {
    if (!validSet.has(smiles)) return false;
    const count = atomCounts.get(smiles) ?? 0;
    return Number.isInteger(atomIndex) && atomIndex >= 0 && atomIndex < count;
  }

  const src: ArrowSource = arrow.source;
  if (src.kind === "lone-pair") {
    if (!refOk(src.molecule_smiles, src.atom_index)) return false;
  } else {
    if (!refOk(src.molecule_smiles, src.atom_a_index)) return false;
    if (!refOk(src.molecule_smiles, src.atom_b_index)) return false;
  }

  const tgt: ArrowTarget = arrow.target;
  if (tgt.kind === "atom") {
    if (!refOk(tgt.molecule_smiles, tgt.atom_index)) return false;
  } else if (tgt.kind === "bond-formation") {
    if (!refOk(tgt.molecule_smiles, tgt.atom_a_index)) return false;
    if (!refOk(tgt.molecule_smiles, tgt.atom_b_index)) return false;
  } else {
    if (!refOk(tgt.molecule_a_smiles, tgt.atom_a_index)) return false;
    if (!refOk(tgt.molecule_b_smiles, tgt.atom_b_index)) return false;
  }

  if (arrow.electron_count !== 1 && arrow.electron_count !== 2) return false;

  return true;
}

function validateMechanism(
  raw: ReactionMechanism,
  enumByCompound: Map<string, AtomEnumEntry[]>
): { mechanism: ReactionMechanism | null; rawArrowCount: number } {
  const validSet = new Set(enumByCompound.keys());
  const atomCounts = new Map<string, number>();
  for (const [smiles, enumeration] of enumByCompound) {
    atomCounts.set(smiles, enumeration.length);
  }

  let unverified = 0;
  let rawArrowCount = 0;
  const filteredSubSteps: MechanismStep[] = [];

  for (const sub of raw.sub_steps ?? []) {
    const validArrows: Arrow[] = [];
    for (const arrow of sub.arrows ?? []) {
      rawArrowCount += 1;
      if (isValidArrow(arrow, validSet, atomCounts)) {
        validArrows.push(arrow);
      } else {
        unverified += 1;
      }
    }
    if (validArrows.length > 0) {
      filteredSubSteps.push({
        sub_step: sub.sub_step,
        caption: sub.caption ?? "",
        arrows: validArrows,
      });
    }
  }

  if (filteredSubSteps.length === 0) {
    return { mechanism: null, rawArrowCount };
  }

  return {
    mechanism: {
      reaction_step_number: raw.reaction_step_number,
      mechanism_class: raw.mechanism_class ?? "Unclassified",
      confidence: raw.confidence ?? "low",
      reasoning: raw.reasoning ?? "",
      sub_steps: filteredSubSteps,
      unverified_arrows: unverified,
    },
    rawArrowCount,
  };
}

export async function generateMechanism(
  input: MechanismStepInput
): Promise<ReactionMechanism | null> {
  // Enumerate every unique compound's atoms once. Mapping by SMILES dedupes
  // compounds that appear in multiple roles (rare but possible).
  const enumByCompound = new Map<string, AtomEnumEntry[]>();
  const allCompounds = [
    ...input.reactants,
    ...input.products,
    ...input.catalysts,
    ...input.solvents,
  ];
  for (const c of allCompounds) {
    if (!c.smiles || enumByCompound.has(c.smiles)) continue;
    enumByCompound.set(c.smiles, await enumerateAtoms(c.smiles));
  }

  const userMessage = await buildUserMessage(input, enumByCompound);

  const perCompound = Array.from(enumByCompound.entries())
    .map(([smiles, enumeration]) => `${smiles}=${enumeration.length}`)
    .join(" ");
  console.log(
    "[mechanism] sending to Claude:",
    `~${Math.ceil(userMessage.length / 4)} tokens (${userMessage.length} chars),`,
    `atoms per compound: ${perCompound}`
  );

  let response;
  try {
    const client = getAnthropicClient();
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // The system prompt is large and stable; cache it so repeat calls
      // within the cache TTL pay the discounted input rate on the prompt.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    console.error("[mechanism] anthropic call failed", err);
    return null;
  }

  const block = response.content[0];
  if (!block || block.type !== "text") {
    console.error("[mechanism] no text block in response", response.content);
    return null;
  }
  const cleaned = stripFences(block.text);

  let parsed: ReactionMechanism;
  try {
    parsed = JSON.parse(cleaned) as ReactionMechanism;
  } catch (err) {
    console.error(
      "[mechanism] JSON parse failed:",
      err,
      "raw:",
      block.text
    );
    return null;
  }

  const { mechanism, rawArrowCount } = validateMechanism(
    parsed,
    enumByCompound
  );

  console.log(
    "[mechanism] Claude returned",
    `${block.text.length} chars,`,
    `${rawArrowCount} arrows parsed,`,
    `${mechanism ? rawArrowCount - mechanism.unverified_arrows : 0} valid,`,
    `unverified_arrows=${mechanism?.unverified_arrows ?? rawArrowCount}`
  );

  return mechanism;
}
