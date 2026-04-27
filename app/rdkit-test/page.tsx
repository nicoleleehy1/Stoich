"use client";

import RDKitStructure from "../components/RDKitStructure";

const SAMPLES: { label: string; smiles: string }[] = [
  { label: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { label: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
  { label: "Glucose", smiles: "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O" },
  { label: "Invalid (should error)", smiles: "NotASmiles123" },
];

export default function RDKitTestPage() {
  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-[#1A1A1A]">
          RDKit-JS Test Page
        </h1>
        <p className="mb-8 text-sm text-[#1A1A1A]/60">
          Phase 1 sanity check. The first render loads ~2.5MB of WASM from the
          CDN; subsequent structures should appear instantly.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3">
                <div className="text-sm font-medium text-[#1A1A1A]">
                  {s.label}
                </div>
                <div className="font-mono text-xs text-[#1A1A1A]/50">
                  {s.smiles}
                </div>
              </div>
              <div className="flex justify-center">
                <RDKitStructure smiles={s.smiles} width={240} height={240} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
