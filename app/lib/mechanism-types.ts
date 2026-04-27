// Curved-arrow mechanism schema. Atom indices are 0-based against the
// canonical SMILES order — index 0 is the first heavy atom in the SMILES
// string, index 1 the next, and so on. Brackets count as one atom.

export type ArrowSource =
  | { kind: "lone-pair"; molecule_smiles: string; atom_index: number }
  | {
      kind: "bond";
      molecule_smiles: string;
      atom_index: number;
      atom_b_index?: number;
    }
  | {
      kind: "pi-bond";
      molecule_smiles: string;
      atom_index: number;
      atom_b_index?: number;
    };

export type ArrowTarget =
  | { kind: "atom"; molecule_smiles: string; atom_index: number }
  | {
      kind: "bond-formation";
      molecule_smiles: string;
      atom_a_index: number;
      atom_b_index: number;
    }
  | {
      kind: "between-atoms";
      molecule_a_smiles: string;
      atom_a_index: number;
      molecule_b_smiles: string;
      atom_b_index: number;
    };

export type Arrow = {
  electron_count: 2 | 1; // 2 = full curved arrow, 1 = fishhook
  source: ArrowSource;
  target: ArrowTarget;
  curve_direction: "clockwise" | "counterclockwise";
  description: string;
};

export type MechanismStep = {
  sub_step: number;
  caption: string;
  arrows: Arrow[];
};

export type ReactionMechanism = {
  reaction_step_number: number;
  mechanism_class: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  sub_steps: MechanismStep[];
  unverified_arrows: number;
};

export type MechanismCompoundInput = {
  name: string;
  smiles: string;
};

export type MechanismStepInput = {
  reaction_step_number?: number;
  reactants: MechanismCompoundInput[];
  products: MechanismCompoundInput[];
  catalysts: MechanismCompoundInput[];
  solvents: MechanismCompoundInput[];
  description: string;
};
