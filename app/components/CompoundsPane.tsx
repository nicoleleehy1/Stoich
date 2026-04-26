"use client";

import { useEffect, useRef, useState } from "react";

export type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

const SERIF = { fontFamily: "var(--font-serif)" };

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
    <div ref={containerRef} className="flex h-full flex-col p-4">
      <header className="mb-3 shrink-0">
        <h2 className="text-xl tracking-tight" style={SERIF}>
          All compounds detected
        </h2>
        <p className="text-xs text-[#1A1A1A]/60">
          {compounds.length > 0
            ? `${compounds.length} ${compounds.length === 1 ? "molecule" : "molecules"}`
            : "0 molecules"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-[#1A1A1A]/50">Reading paragraph...</p>
        ) : compounds.length === 0 ? (
          <p className="text-sm text-[#1A1A1A]/50">
            {hasRun ? "No compounds detected" : "Compounds will appear here"}
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
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isProduct = compound.role?.toLowerCase() === "product";

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
      className="flex w-full cursor-pointer flex-col rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:bg-stone-50"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="truncate text-sm font-bold text-[#1A1A1A]"
          title={compound.name}
        >
          {compound.name}
        </h3>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider " +
            (isProduct
              ? "bg-[#CFFF00] text-[#1A1A1A]"
              : "bg-[#1A1A1A]/10 text-[#1A1A1A]/70")
          }
        >
          {compound.role?.toUpperCase()}
        </span>
      </div>

      <div className="mt-2 flex justify-center rounded-lg bg-white">
        {imageFailed ? (
          <div className="flex h-24 w-full items-center justify-center rounded-lg bg-[#1A1A1A]/5 text-xs text-[#1A1A1A]/50">
            not in PubChem
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={compound.image_url}
            alt={compound.name}
            className="max-h-24 w-full rounded-lg bg-white object-contain"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      {compound.iupac && (
        <p
          className="mt-2 truncate font-mono text-[10px] text-[#1A1A1A]/60"
          title={compound.iupac}
        >
          {compound.iupac}
        </p>
      )}

      <div className="mt-1 flex items-center gap-1">
        <p
          className="truncate font-mono text-[10px] text-[#1A1A1A]/60"
          title={compound.smiles}
        >
          {compound.smiles}
        </p>
        <button
          type="button"
          onClick={copySmiles}
          className="shrink-0 rounded-full border border-[#1A1A1A]/15 bg-white px-1.5 py-0.5 text-[9px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>

      <p className="mt-2 line-clamp-2 italic text-[11px] text-[#1A1A1A]/80">
        {compound.one_line}
      </p>
    </article>
  );
}
