"use client";

import { useState } from "react";

type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

const EXAMPLE_TEXT =
  "We synthesized aspirin (acetylsalicylic acid) by reacting salicylic acid with acetic anhydride in the presence of a sulfuric acid catalyst. The product was purified by recrystallization from ethanol, yielding white crystalline needles characteristic of pure acetylsalicylic acid.";

const SERIF = { fontFamily: "var(--font-serif)" };

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [errored, setErrored] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  async function handleSubmit() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setErrored(false);
    setCompounds([]);
    setHasRun(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { compounds: Compound[] };
      setCompounds(data.compounds ?? []);
    } catch (err) {
      console.error(err);
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }

  const reactants = compounds.filter((c) => c.role?.toLowerCase() === "reactant");
  const products = compounds.filter((c) => c.role?.toLowerCase() === "product");
  const catalysts = compounds.filter((c) => c.role?.toLowerCase() === "catalyst");
  const solvents = compounds.filter((c) => c.role?.toLowerCase() === "solvent");
  const showReaction =
    compounds.length > 1 && reactants.length > 0 && products.length > 0;

  return (
    <main className="bg-[#FAF7F2] lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <section className="flex flex-col border-stone-200 p-6 lg:h-screen lg:border-r lg:overflow-y-auto">
        <header className="mb-4">
          <h1 className="text-4xl tracking-tight" style={SERIF}>
            Mol Lens
          </h1>
          <p className="mt-1 text-sm text-[#1A1A1A]/60">
            Paste a chemistry paragraph. See the molecules and the reaction.
          </p>
        </header>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a paragraph from a chemistry paper, an organic chem textbook, a Wikipedia article on a drug..."
          className="min-h-[240px] w-full flex-1 resize-none rounded-2xl border border-stone-200 bg-white p-5 text-base leading-relaxed text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A]/40 focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setText(EXAMPLE_TEXT)}
            className="rounded-full border border-[#1A1A1A]/20 bg-white px-4 py-2 text-sm text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
          >
            Try an example
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="rounded-full bg-[#CFFF00] px-6 py-3 text-base font-medium text-[#1A1A1A] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Reading paragraph..." : "Extract molecules"}
          </button>
        </div>

        {errored && (
          <p className="mt-3 text-sm text-[#1A1A1A]/70">
            extraction failed, try again
          </p>
        )}
      </section>

      <div className="flex flex-col lg:h-screen lg:overflow-hidden">
        <section className="flex flex-col border-stone-200 p-6 lg:h-1/2 lg:border-b lg:overflow-y-auto">
          <header className="mb-4 shrink-0">
            <h2 className="text-2xl tracking-tight" style={SERIF}>
              The Reaction
            </h2>
            <p className="text-sm text-[#1A1A1A]/60">as Gemma understood it</p>
          </header>

          <div className="flex flex-1 items-center justify-center overflow-x-auto">
            {loading ? (
              <p className="text-sm text-[#1A1A1A]/50">Reading paragraph...</p>
            ) : !hasRun ? (
              <p className="text-sm text-[#1A1A1A]/50">
                Extract a paragraph to see the reaction
              </p>
            ) : !showReaction ? (
              <p className="text-sm text-[#1A1A1A]/50">No clear reaction detected</p>
            ) : (
              <div className="flex min-w-max items-center justify-center gap-3 px-2">
                {reactants.map((c, i) => (
                  <div key={`r-${i}`} className="flex items-center gap-3">
                    <MiniCard compound={c} />
                    {i < reactants.length - 1 && (
                      <span className="text-2xl text-[#1A1A1A]/40">+</span>
                    )}
                  </div>
                ))}
                <ReactionArrow catalysts={catalysts} solvents={solvents} />
                {products.map((c, i) => (
                  <div key={`p-${i}`} className="flex items-center gap-3">
                    <MiniCard compound={c} />
                    {i < products.length - 1 && (
                      <span className="text-2xl text-[#1A1A1A]/40">+</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col p-6 lg:h-1/2 lg:overflow-y-auto">
          <header className="mb-4 shrink-0">
            <h2 className="text-2xl tracking-tight" style={SERIF}>
              All compounds detected
            </h2>
            <p className="text-sm text-[#1A1A1A]/60">
              {compounds.length > 0
                ? `${compounds.length} ${compounds.length === 1 ? "molecule" : "molecules"}`
                : "0 molecules"}
            </p>
          </header>

          <div className="flex-1">
            {loading ? (
              <p className="text-sm text-[#1A1A1A]/50">Reading paragraph...</p>
            ) : compounds.length === 0 ? (
              <p className="text-sm text-[#1A1A1A]/50">
                {hasRun ? "No compounds detected" : "Compounds will appear here"}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {compounds.map((c, i) => (
                  <CompoundCard key={`${c.name}-${i}`} compound={c} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReactionArrow({
  catalysts,
  solvents,
}: {
  catalysts: Compound[];
  solvents: Compound[];
}) {
  return (
    <div className="flex flex-col items-center justify-center px-1">
      <div className="min-h-[16px] text-center text-[10px] leading-tight text-[#1A1A1A]/60">
        {catalysts.map((c, i) => (
          <div key={`cat-${i}`}>{c.name}</div>
        ))}
      </div>
      <div className="text-3xl leading-none text-[#CFFF00] drop-shadow-[0_0_1px_rgba(26,26,26,0.4)]">
        ⟶
      </div>
      <div className="min-h-[16px] text-center text-[10px] italic leading-tight text-[#1A1A1A]/60">
        {solvents.map((s, i) => (
          <div key={`sol-${i}`}>{s.name}</div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({ compound }: { compound: Compound }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex w-28 flex-col items-center rounded-xl border border-stone-200 bg-white p-3">
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
    </div>
  );
}

function CompoundCard({ compound }: { compound: Compound }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isProduct = compound.role?.toLowerCase() === "product";

  async function copySmiles() {
    try {
      await navigator.clipboard.writeText(compound.smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <article className="flex w-full flex-col rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-bold text-[#1A1A1A]" title={compound.name}>
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
