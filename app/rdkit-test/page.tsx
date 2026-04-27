"use client";

import { useState } from "react";
import RDKitStructure, {
  type AtomMap,
} from "../components/RDKitStructure";

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
          Phase 1 sanity check + Phase 2 atom-map extraction. The first render
          loads ~2.5MB of WASM from the CDN; subsequent structures should
          appear instantly. Atom positions are reported in viewBox coordinates.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <SampleCard key={s.label} label={s.label} smiles={s.smiles} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SampleCard({ label, smiles }: { label: string; smiles: string }) {
  const [atomMap, setAtomMap] = useState<AtomMap | null>(null);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-medium text-[#1A1A1A]">{label}</div>
        <div className="font-mono text-xs text-[#1A1A1A]/50">{smiles}</div>
      </div>
      <div className="flex justify-center">
        <RDKitStructure
          smiles={smiles}
          width={240}
          height={240}
          onAtomMap={setAtomMap}
        />
      </div>
      <AtomList atomMap={atomMap} />
    </div>
  );
}

function AtomList({ atomMap }: { atomMap: AtomMap | null }) {
  if (!atomMap) {
    return (
      <p className="mt-3 text-[11px] italic text-[#1A1A1A]/40">
        no atoms extracted yet
      </p>
    );
  }
  if (atomMap.atoms.length === 0) {
    return (
      <p className="mt-3 text-[11px] italic text-[#1A1A1A]/40">
        0 atoms detected (viewBox {atomMap.svgWidth.toFixed(0)}×
        {atomMap.svgHeight.toFixed(0)})
      </p>
    );
  }

  const summary = atomMap.atoms
    .map(
      (a) =>
        `${a.element}#${a.index}@(${a.x.toFixed(0)},${a.y.toFixed(0)})`
    )
    .join(", ");

  return (
    <div className="mt-3 text-[11px] text-[#1A1A1A]/70">
      <p className="font-mono">
        {atomMap.atoms.length} atoms detected (viewBox{" "}
        {atomMap.svgWidth.toFixed(0)}×{atomMap.svgHeight.toFixed(0)})
      </p>
      <p className="mt-1 break-words font-mono text-[10px] text-[#1A1A1A]/50">
        {summary}
      </p>
    </div>
  );
}
