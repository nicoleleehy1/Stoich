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
  const [debug, setDebug] = useState(true);

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">
            RDKit-JS Test Page
          </h1>
          <button
            type="button"
            onClick={() => setDebug((d) => !d)}
            className="border border-[#1A1A1A]/30 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          >
            {debug ? "hide atom indices" : "show atom indices"}
          </button>
        </div>
        <p className="mb-8 text-sm text-[#1A1A1A]/60">
          Phase 1 sanity check + Phase 2A atom-map extraction + Phase 2B debug
          overlay. The first render loads ~2.5MB of WASM from the CDN;
          subsequent structures should appear instantly. Atom positions are
          reported in viewBox coordinates.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <SampleCard
              key={s.label}
              label={s.label}
              smiles={s.smiles}
              debug={debug}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SampleCard({
  label,
  smiles,
  debug,
}: {
  label: string;
  smiles: string;
  debug: boolean;
}) {
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
          debug={debug}
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
