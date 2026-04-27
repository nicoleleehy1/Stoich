"use client";

import { useEffect, useRef, useState } from "react";
import RDKitStructure from "./RDKitStructure";

export type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

const SERIF = { fontFamily: "var(--font-serif)" };
const SANS = { fontFamily: "var(--font-sans)" };
const MONO = { fontFamily: "var(--font-mono)" };

export default function CompoundsPane(props: {
  loading: boolean;
  hasRun: boolean;
  compounds: Compound[];
  onPickCompound: (c: Compound) => void;
}) {
  const { loading, hasRun, compounds, onPickCompound } = props;

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

  const cols =
    paneWidth >= 900
      ? "grid-cols-4"
      : paneWidth >= 600
        ? "grid-cols-3"
        : "grid-cols-2";

  return (
    <div ref={containerRef} className="flex h-full flex-col p-5">
      <header className="mb-3 shrink-0">
        <p
          className="text-[10px] tracking-[0.32em] uppercase text-[#A8483B]"
          style={SANS}
        >
          § 03 — Compounds
        </p>
        <h2 className="mt-1 text-xl tracking-tight" style={SERIF}>
          all compounds detected
          <span className="text-[#A8483B]">.</span>
        </h2>
        <p
          className="mt-0.5 text-xs text-[#1A1A1A]/60"
          style={SANS}
        >
          {compounds.length > 0
            ? `${compounds.length} ${compounds.length === 1 ? "molecule" : "molecules"}`
            : "0 molecules"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p
            className="text-sm italic text-[#1A1A1A]/50"
            style={SANS}
          >
            reading paragraph...
          </p>
        ) : compounds.length === 0 ? (
          <p
            className="text-sm italic text-[#1A1A1A]/50"
            style={SANS}
          >
            {hasRun ? "no compounds detected" : "compounds will appear here"}
          </p>
        ) : (
          <div className={`grid gap-3 ${cols}`}>
            {compounds.map((c, i) => (
              <CompoundCard
                key={`${c.name}-${i}`}
                compound={c}
                onOpen={() => onPickCompound(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompoundCard({
  compound,
  onOpen,
}: {
  compound: Compound;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const isProduct = compound.role?.toLowerCase() === "product";

  const fallbackUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
    compound.smiles
  )}/PNG`;

  async function copySmiles(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(compound.smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <article
      onClick={onOpen}
      className="group flex w-full cursor-pointer flex-col rounded-[4px] border border-[#1A1A1A]/[0.10] bg-white p-3 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#1A1A1A]/[0.25]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          className="truncate text-sm font-bold text-[#1A1A1A]"
          title={compound.name}
          style={SANS}
        >
          {compound.name}
        </h3>
        <span
          className={
            "shrink-0 text-[10px] uppercase tracking-[0.18em] " +
            (isProduct
              ? "font-bold text-[#A8483B]"
              : "text-[#5C5651]")
          }
          style={SANS}
        >
          {compound.role}
        </span>
      </div>

      <div className="mt-2 flex justify-center">
        <RDKitStructure
          smiles={compound.smiles}
          fallbackUrl={fallbackUrl}
          width={180}
          height={180}
        />
      </div>

      {compound.iupac && (
        <p
          className="mt-2 truncate text-xs text-[#5C5651]"
          title={compound.iupac}
          style={MONO}
        >
          {compound.iupac}
        </p>
      )}

      <div className="mt-1 flex items-center gap-2">
        <p
          className="truncate text-xs text-[#5C5651]"
          title={compound.smiles}
          style={MONO}
        >
          {compound.smiles}
        </p>
        <button
          type="button"
          onClick={copySmiles}
          className="shrink-0 text-xs text-[#5C5651] transition-colors hover:text-[#A8483B]"
          style={SANS}
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>

      <p
        className="mt-2 line-clamp-2 text-xs italic text-[#5C5651]"
        style={SANS}
      >
        {compound.one_line}
      </p>
    </article>
  );
}
