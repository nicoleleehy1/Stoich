"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import ReactionGraph from "./ReactionGraph";
import RDKitStructure from "./RDKitStructure";

export type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

export type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

export type Step = {
  step_number: number;
  description: string;
  compounds: Compound[];
  conditions: Conditions;
};

const SERIF = { fontFamily: "var(--font-serif)" };
const SANS = { fontFamily: "var(--font-sans)" };
const MONO = { fontFamily: "var(--font-mono)" };
const NARROW_PX = 300;

export default function ReactionPane(props: {
  loading: boolean;
  hasRun: boolean;
  reactionSteps: Step[];
  compoundsCount: number;
  viewMode: "equation" | "graph";
  setViewMode: (m: "equation" | "graph") => void;
  narrateLoading: boolean;
  onNarrate: () => void;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPickCompound: (c: Compound) => void;
}) {
  const {
    loading,
    hasRun,
    reactionSteps,
    compoundsCount,
    viewMode,
    setViewMode,
    narrateLoading,
    onNarrate,
    audioRef,
    onPickCompound,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [paneWidth, setPaneWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setPaneWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isNarrow = paneWidth > 0 && paneWidth < NARROW_PX;
  const isMultiStep = reactionSteps.length > 1;
  const showAnyReaction = reactionSteps.length > 0;

  return (
    <div ref={containerRef} className="flex h-full flex-col p-5">
      <header className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p
            className="text-[10px] tracking-[0.32em] uppercase text-[#A8483B]"
            style={SANS}
          >
            § 02 — Reaction
          </p>
          <h2 className="mt-1 text-xl tracking-tight" style={SERIF}>
            {isMultiStep
              ? `${reactionSteps.length} steps, recovered`
              : "recovered from text"}
            <span className="text-[#A8483B]">.</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#1A1A1A]/60" style={SANS}>
            as Gemma understood it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex overflow-hidden border border-[#1A1A1A] bg-white text-[10px] uppercase tracking-[0.18em]"
            style={SANS}
          >
            <button
              type="button"
              onClick={() => setViewMode("equation")}
              className={
                "px-3 py-1.5 transition-colors " +
                (viewMode === "equation"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#1A1A1A] hover:bg-[#1A1A1A]/5")
              }
            >
              equation
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={
                "border-l border-[#1A1A1A] px-3 py-1.5 transition-colors " +
                (viewMode === "graph"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#1A1A1A] hover:bg-[#1A1A1A]/5")
              }
            >
              graph
            </button>
          </div>
          <button
            type="button"
            onClick={onNarrate}
            disabled={narrateLoading || compoundsCount === 0}
            className="border border-[#1A1A1A] bg-white px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#1A1A1A]"
            aria-label="Narrate the reaction"
            style={SANS}
          >
            {narrateLoading ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#1A1A1A]/20 border-t-[#1A1A1A]/70" />
                generating...
              </span>
            ) : (
              "narrate"
            )}
          </button>
        </div>
      </header>

      <audio ref={audioRef} className="hidden" />

      <div
        className={
          "flex flex-1 overflow-hidden " +
          (viewMode === "graph"
            ? ""
            : isMultiStep
              ? "flex-col items-stretch overflow-y-auto overflow-x-auto"
              : "items-center justify-center overflow-x-auto overflow-y-auto")
        }
      >
        {loading ? (
          <p
            className="m-auto text-sm italic text-[#1A1A1A]/50"
            style={SANS}
          >
            reading paragraph...
          </p>
        ) : !hasRun ? (
          <p
            className="m-auto text-sm italic text-[#1A1A1A]/50"
            style={SANS}
          >
            extract a paragraph to see the reaction
          </p>
        ) : !showAnyReaction ? (
          <p
            className="m-auto text-sm italic text-[#1A1A1A]/50"
            style={SANS}
          >
            no clear reaction detected
          </p>
        ) : viewMode === "graph" ? (
          <ReactionGraph
            steps={reactionSteps}
            onPickCompound={onPickCompound}
          />
        ) : isMultiStep ? (
          <div className="flex flex-col">
            {reactionSteps.map((step, i) => (
              <div key={step.step_number}>
                {i > 0 && (
                  <div className="my-6 border-t border-[#1A1A1A]/10" />
                )}
                <p
                  className="mb-2 flex items-baseline gap-2 text-sm italic text-[#1A1A1A]/70"
                  style={SERIF}
                >
                  <span
                    className="text-[10px] not-italic tracking-[0.32em] uppercase text-[#A8483B]"
                    style={SANS}
                  >
                    step {step.step_number}
                  </span>
                </p>
                <StepEquation
                  step={step}
                  vertical={isNarrow}
                  onPickCompound={onPickCompound}
                />
                {step.description && (
                  <p
                    className="mt-5 text-xs italic text-[#5C5651]"
                    style={SANS}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <StepEquation
            step={reactionSteps[0]}
            vertical={isNarrow}
            onPickCompound={onPickCompound}
          />
        )}
      </div>
    </div>
  );
}

function StepEquation({
  step,
  vertical,
  onPickCompound,
}: {
  step: Step;
  vertical: boolean;
  onPickCompound: (c: Compound) => void;
}) {
  const reactants = step.compounds.filter(
    (c) => c.role?.toLowerCase() === "reactant"
  );
  const products = step.compounds.filter(
    (c) => c.role?.toLowerCase() === "product"
  );
  const catalysts = step.compounds.filter(
    (c) => c.role?.toLowerCase() === "catalyst"
  );
  const solvents = step.compounds.filter(
    (c) => c.role?.toLowerCase() === "solvent"
  );

  return (
    <div
      className={
        "flex items-center justify-center gap-7 px-2 " +
        (vertical ? "flex-col" : "min-w-max")
      }
    >
      {reactants.map((c, i) => (
        <div
          key={`r-${i}`}
          className={
            "flex items-center gap-7 " + (vertical ? "flex-col" : "")
          }
        >
          <Molecule compound={c} onClick={() => onPickCompound(c)} />
          {i < reactants.length - 1 && <PlusSymbol />}
        </div>
      ))}
      <ReactionArrow
        catalysts={catalysts}
        solvents={solvents}
        conditions={step.conditions}
        vertical={vertical}
      />
      {step.conditions.yield && (
        <span
          className="text-xs text-[#5C5651]"
          style={SANS}
        >
          yield: {step.conditions.yield}
        </span>
      )}
      {products.map((c, i) => (
        <div
          key={`p-${i}`}
          className={
            "flex items-center gap-7 " + (vertical ? "flex-col" : "")
          }
        >
          <Molecule compound={c} onClick={() => onPickCompound(c)} />
          {i < products.length - 1 && <PlusSymbol />}
        </div>
      ))}
    </div>
  );
}

function PlusSymbol() {
  return (
    <span className="text-4xl font-light leading-none text-[#5C5651]">
      +
    </span>
  );
}

function ReactionArrow({
  catalysts,
  solvents,
  conditions,
  vertical,
}: {
  catalysts: Compound[];
  solvents: Compound[];
  conditions: Conditions;
  vertical: boolean;
}) {
  const above: string[] = [
    ...catalysts.map((c) => c.name),
    ...(conditions.temperature ? [conditions.temperature] : []),
    ...(conditions.pressure ? [conditions.pressure] : []),
  ];
  const below: string[] = [
    ...solvents.map((s) => s.name),
    ...(conditions.time ? [conditions.time] : []),
  ];

  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div
        className="min-h-[16px] text-center text-xs uppercase leading-tight tracking-[0.18em] text-[#A8483B]"
        style={MONO}
      >
        {above.map((line, i) => (
          <div key={`above-${i}`}>{line}</div>
        ))}
      </div>
      <div className="text-4xl leading-none tracking-tighter text-[#1A1A1A]">
        {vertical ? "↓" : "⟶"}
      </div>
      <div
        className="min-h-[16px] text-center text-xs italic leading-tight text-[#5C5651]"
        style={SANS}
      >
        {below.map((line, i) => (
          <div key={`below-${i}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function Molecule({
  compound,
  onClick,
}: {
  compound: Compound;
  onClick?: () => void;
}) {
  const fallbackUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
    compound.smiles
  )}/PNG`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col items-center bg-transparent text-left"
    >
      <div className="transition-transform duration-150 ease-out group-hover:-translate-y-0.5">
        <RDKitStructure
          smiles={compound.smiles}
          fallbackUrl={fallbackUrl}
          width={180}
          height={180}
        />
      </div>
      <p
        className="mt-2 max-w-[180px] truncate border-b border-transparent text-center text-sm text-[#5C5651] transition-colors group-hover:border-[#A8483B]"
        style={SANS}
      >
        {compound.name}
      </p>
    </button>
  );
}
