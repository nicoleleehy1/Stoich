"use client";

import { useState } from "react";
import type { ReactionMechanism } from "../lib/mechanism-types";

const ASPIRIN_PAYLOAD = {
  reaction_step_number: 1,
  reactants: [
    { name: "salicylic acid", smiles: "O=C(O)c1ccccc1O" },
    { name: "acetic anhydride", smiles: "CC(=O)OC(C)=O" },
  ],
  products: [
    { name: "aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
    { name: "acetic acid", smiles: "CC(=O)O" },
  ],
  catalysts: [{ name: "sulfuric acid", smiles: "OS(=O)(=O)O" }],
  solvents: [{ name: "ethanol", smiles: "CCO" }],
  description:
    "Acid-catalyzed esterification of salicylic acid with acetic anhydride to form aspirin.",
};

type Result = {
  loading: boolean;
  error: string | null;
  mechanism: ReactionMechanism | null;
  elapsedMs: number | null;
};

export default function MechanismTestPage() {
  const [result, setResult] = useState<Result>({
    loading: false,
    error: null,
    mechanism: null,
    elapsedMs: null,
  });

  async function run() {
    setResult({ loading: true, error: null, mechanism: null, elapsedMs: null });
    const started = performance.now();
    try {
      const res = await fetch("/api/mechanism-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ASPIRIN_PAYLOAD),
      });
      const elapsedMs = performance.now() - started;
      const data = (await res.json()) as {
        mechanism?: ReactionMechanism | null;
        error?: string;
      };
      if (!res.ok) {
        setResult({
          loading: false,
          error: data.error ?? `status ${res.status}`,
          mechanism: null,
          elapsedMs,
        });
        return;
      }
      setResult({
        loading: false,
        error: null,
        mechanism: data.mechanism ?? null,
        elapsedMs,
      });
    } catch (err) {
      setResult({
        loading: false,
        error: err instanceof Error ? err.message : "request failed",
        mechanism: null,
        elapsedMs: performance.now() - started,
      });
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-semibold text-[#1A1A1A]">
          Mechanism Generator Test
        </h1>
        <p className="mb-6 text-sm text-[#1A1A1A]/60">
          Calls <code>/api/mechanism-test</code> with a hardcoded aspirin
          synthesis step. Hits Claude Sonnet 4.5 (~5-15s, $0.005-0.015 per
          call). Mechanism JSON is post-validated against the input SMILES so
          arrows referencing missing molecules or out-of-bounds atom indices
          are stripped.
        </p>

        <button
          type="button"
          onClick={run}
          disabled={result.loading}
          className="mb-6 border border-[#1A1A1A] bg-[#1A1A1A] px-4 py-2 text-[12px] uppercase tracking-[0.18em] text-white hover:bg-white hover:text-[#1A1A1A] disabled:cursor-wait disabled:opacity-50"
        >
          {result.loading ? "generating..." : "generate aspirin mechanism"}
        </button>

        {result.elapsedMs != null && (
          <p className="mb-4 text-xs text-[#1A1A1A]/50">
            request took {(result.elapsedMs / 1000).toFixed(2)}s
          </p>
        )}

        {result.error && (
          <p className="mb-4 text-sm text-[#A8483B]">error: {result.error}</p>
        )}

        {result.mechanism === null && !result.loading && !result.error && (
          <p className="text-sm italic text-[#1A1A1A]/50">
            Click the button to generate.
          </p>
        )}

        {result.mechanism === null &&
          !result.loading &&
          result.elapsedMs != null &&
          !result.error && (
            <p className="text-sm italic text-[#A8483B]">
              Generator returned null (validation stripped all arrows or
              parsing failed). Check the server logs.
            </p>
          )}

        {result.mechanism && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <Field
                label="class"
                value={result.mechanism.mechanism_class}
              />
              <Field label="confidence" value={result.mechanism.confidence} />
              <Field
                label="sub-steps"
                value={String(result.mechanism.sub_steps.length)}
              />
              <Field
                label="unverified arrows"
                value={String(result.mechanism.unverified_arrows)}
              />
            </div>
            <p className="mb-4 text-sm italic text-[#1A1A1A]/70">
              {result.mechanism.reasoning}
            </p>
            <pre className="overflow-x-auto rounded-md border border-stone-200 bg-white p-4 text-[11px] leading-relaxed text-[#1A1A1A]">
              {JSON.stringify(result.mechanism, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#A8483B]">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-[#1A1A1A]">{value}</p>
    </div>
  );
}
