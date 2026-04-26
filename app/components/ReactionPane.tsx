"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import ReactionGraph from "./ReactionGraph";

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
    <div ref={containerRef} className="flex h-full flex-col p-4">
      <header className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl tracking-tight" style={SERIF}>
            The Reaction
          </h2>
          <p className="text-xs text-[#1A1A1A]/60">
            {isMultiStep
              ? `${reactionSteps.length} steps · as Gemma understood it`
              : "as Gemma understood it"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-[#1A1A1A]/20 bg-white text-xs">
            <button
              type="button"
              onClick={() => setViewMode("equation")}
              className={
                "px-2.5 py-1 transition-colors " +
                (viewMode === "equation"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#1A1A1A] hover:bg-[#1A1A1A]/5")
              }
            >
              Equation
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={
                "px-2.5 py-1 transition-colors " +
                (viewMode === "graph"
                  ? "bg-[#1A1A1A] text-white"
                  : "text-[#1A1A1A] hover:bg-[#1A1A1A]/5")
              }
            >
              Graph
            </button>
          </div>
          <button
            type="button"
            onClick={onNarrate}
            disabled={narrateLoading || compoundsCount === 0}
            className="rounded-full border border-[#1A1A1A]/20 bg-white px-2.5 py-1 text-xs text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Narrate the reaction"
          >
            {narrateLoading ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#1A1A1A]/20 border-t-[#1A1A1A]/70" />
                Generating...
              </span>
            ) : (
              "🔊 Narrate"
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
          <p className="m-auto text-sm text-[#1A1A1A]/50">
            Reading paragraph...
          </p>
        ) : !hasRun ? (
          <p className="m-auto text-sm text-[#1A1A1A]/50">
            Extract a paragraph to see the reaction
          </p>
        ) : !showAnyReaction ? (
          <p className="m-auto text-sm text-[#1A1A1A]/50">
            No clear reaction detected
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
                {i > 0 && <div className="my-2 border-t border-stone-200" />}
                <p
                  className="mb-2 text-sm italic text-[#1A1A1A]/60"
                  style={SERIF}
                >
                  Step {step.step_number}
                </p>
                <StepEquation
                  step={step}
                  vertical={isNarrow}
                  onPickCompound={onPickCompound}
                />
                {step.description && (
                  <p className="mt-2 text-xs text-[#1A1A1A]/60">
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
        "flex items-center justify-center gap-3 px-2 " +
        (vertical ? "flex-col" : "min-w-max")
      }
    >
      {reactants.map((c, i) => (
        <div
          key={`r-${i}`}
          className={
            "flex items-center gap-3 " + (vertical ? "flex-col" : "")
          }
        >
          <MiniCard compound={c} onClick={() => onPickCompound(c)} />
          {i < reactants.length - 1 && (
            <span className="text-2xl text-[#1A1A1A]/40">+</span>
          )}
        </div>
      ))}
      <ReactionArrow
        catalysts={catalysts}
        solvents={solvents}
        conditions={step.conditions}
        vertical={vertical}
      />
      {step.conditions.yield && (
        <span className="rounded-full bg-[#1A1A1A]/10 px-2.5 py-1 font-mono text-[10px] text-[#1A1A1A]/70">
          yield: {step.conditions.yield}
        </span>
      )}
      {products.map((c, i) => (
        <div
          key={`p-${i}`}
          className={
            "flex items-center gap-3 " + (vertical ? "flex-col" : "")
          }
        >
          <MiniCard compound={c} onClick={() => onPickCompound(c)} />
          {i < products.length - 1 && (
            <span className="text-2xl text-[#1A1A1A]/40">+</span>
          )}
        </div>
      ))}
    </div>
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
      <div className="min-h-[16px] text-center font-mono text-[10px] leading-tight text-[#1A1A1A]/60">
        {above.map((line, i) => (
          <div key={`above-${i}`}>{line}</div>
        ))}
      </div>
      <div className="text-4xl leading-none tracking-tighter text-[#CFFF00] drop-shadow-[0_0_1px_rgba(26,26,26,0.4)]">
        {vertical ? "↓" : "⟶"}
      </div>
      <div className="min-h-[16px] text-center text-[10px] italic leading-tight text-[#1A1A1A]/60">
        {below.map((line, i) => (
          <div key={`below-${i}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  compound,
  onClick,
}: {
  compound: Compound;
  onClick?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-28 flex-col items-center rounded-xl border border-stone-200 bg-white p-3 text-left transition-colors hover:bg-stone-50"
    >
      {imageFailed ? (
        <div className="flex h-20 w-full items-center justify-center rounded-lg bg-[#1A1A1A]/5 text-base text-[#1A1A1A]/40">
          ?
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={compound.image_url}
          alt={compound.name}
          className="h-20 max-h-20 w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
      <p className="mt-2 w-full truncate text-center text-xs text-[#1A1A1A]">
        {compound.name}
      </p>
    </button>
  );
}
