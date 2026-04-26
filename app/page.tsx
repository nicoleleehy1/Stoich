"use client";

import { useEffect, useRef, useState } from "react";

type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

const EMPTY_CONDITIONS: Conditions = {
  temperature: null,
  pressure: null,
  time: null,
  yield: null,
  notes: null,
};

const EXAMPLE_TEXT =
  "We synthesized aspirin (acetylsalicylic acid) by reacting salicylic acid with acetic anhydride in the presence of a sulfuric acid catalyst. The product was purified by recrystallization from ethanol, yielding white crystalline needles characteristic of pure acetylsalicylic acid.";

const SERIF = { fontFamily: "var(--font-serif)" };
const MAX_CHARS = 50_000;

async function extractPdfText(
  file: File
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageStr = content.items
      .map((item: unknown) => {
        const it = item as { str?: string };
        return it.str ?? "";
      })
      .join(" ");
    pageTexts.push(pageStr);
  }

  return { text: pageTexts.join("\n\n"), pageCount: doc.numPages };
}

export default function Home() {
  const [text, setText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [conditions, setConditions] = useState<Conditions>(EMPTY_CONDITIONS);
  const [errored, setErrored] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{
    name: string;
    pages: number;
    chars: number;
    truncated: boolean;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function readSelectionFromTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      setSelectedText(el.value.slice(start, end));
    } else {
      setSelectedText("");
    }
  }

  useEffect(() => {
    function onMouseUp() {
      if (document.activeElement === textareaRef.current) {
        readSelectionFromTextarea();
      }
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setPdfError("That doesn't look like a PDF.");
      return;
    }
    setPdfError(null);
    setPdfLoading(true);
    try {
      const { text: extracted, pageCount } = await extractPdfText(file);
      const truncated = extracted.length > MAX_CHARS;
      const finalText = truncated ? extracted.slice(0, MAX_CHARS) : extracted;
      setText(finalText);
      setSelectedText("");
      setPdfInfo({
        name: file.name,
        pages: pageCount,
        chars: extracted.length,
        truncated,
      });
    } catch (e) {
      console.error("pdf parse failed", e);
      setPdfError("Couldn't read PDF — try pasting text manually");
      setPdfInfo(null);
    } finally {
      setPdfLoading(false);
    }
  }

  function clearText() {
    setText("");
    setSelectedText("");
    setPdfInfo(null);
    setPdfError(null);
  }

  async function handleSubmit() {
    const textToSend = selectedText.trim() || text.trim();
    if (!textToSend || loading) return;
    setLoading(true);
    setErrored(false);
    setCompounds([]);
    setConditions(EMPTY_CONDITIONS);
    setHasRun(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        compounds: Compound[];
        conditions?: Conditions;
      };
      setCompounds(data.compounds ?? []);
      setConditions({ ...EMPTY_CONDITIONS, ...(data.conditions ?? {}) });
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

  const hasSelection = selectedText.trim().length > 0;
  const canSubmit = hasSelection || text.trim().length > 0;

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

        <div
          onClick={() => !pdfLoading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!pdfLoading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (pdfLoading) return;
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={
            "mb-3 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors " +
            (pdfLoading
              ? "cursor-wait border-stone-300 bg-white text-[#1A1A1A]/50"
              : dragOver
                ? "border-[#CFFF00] bg-[#CFFF00]/10 text-[#1A1A1A]"
                : "border-stone-300 bg-white text-[#1A1A1A]/70 hover:bg-stone-50")
          }
        >
          {pdfLoading ? "Reading PDF..." : "Drop a PDF here or click to upload"}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {pdfError && <p className="mb-2 text-xs text-red-600">{pdfError}</p>}

        {pdfInfo && (
          <div className="mb-3 flex items-center gap-2 text-xs text-[#1A1A1A]/60">
            <span className="truncate">
              Loaded:{" "}
              <span className="font-medium text-[#1A1A1A]/80">{pdfInfo.name}</span>{" "}
              ({pdfInfo.pages} {pdfInfo.pages === 1 ? "page" : "pages"},{" "}
              {pdfInfo.chars.toLocaleString()} chars)
            </span>
            <button
              type="button"
              onClick={clearText}
              className="shrink-0 rounded-full border border-[#1A1A1A]/15 bg-white px-2 py-0.5 text-[10px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
              title="Clear"
            >
              ✕
            </button>
          </div>
        )}

        {pdfInfo?.truncated && (
          <p className="mb-2 text-xs italic text-[#1A1A1A]/60">
            PDF was longer than 50k chars, showing first portion. Highlight a section to extract.
          </p>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            readSelectionFromTextarea();
          }}
          onSelect={readSelectionFromTextarea}
          onKeyUp={readSelectionFromTextarea}
          onMouseUp={readSelectionFromTextarea}
          placeholder="Paste a paragraph from a chemistry paper, an organic chem textbook, a Wikipedia article on a drug..."
          className="min-h-[200px] w-full flex-1 resize-none rounded-2xl border border-stone-200 bg-white p-5 text-base leading-relaxed text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A]/40 focus:outline-none"
        />

        <div className="mt-3 flex items-center gap-2 text-xs">
          {hasSelection ? (
            <>
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#CFFF00]" />
              <span className="truncate italic text-[#1A1A1A]/70">
                Extracting selection: {selectedText.slice(0, 80)}
                {selectedText.length > 80 ? "..." : ""}
              </span>
            </>
          ) : (
            <span className="text-[#1A1A1A]/50">Extracting full paragraph</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
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
            disabled={loading || !canSubmit}
            className="rounded-full bg-[#CFFF00] px-6 py-3 text-base font-medium text-[#1A1A1A] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Reading paragraph..."
              : hasSelection
                ? "Extract selection"
                : "Extract molecules"}
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
                <ReactionArrow
                  catalysts={catalysts}
                  solvents={solvents}
                  conditions={conditions}
                />
                {conditions.yield && (
                  <span className="rounded-full bg-[#1A1A1A]/10 px-2.5 py-1 text-[10px] font-mono text-[#1A1A1A]/70">
                    yield: {conditions.yield}
                  </span>
                )}
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
  conditions,
}: {
  catalysts: Compound[];
  solvents: Compound[];
  conditions: Conditions;
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
        ⟶
      </div>
      <div className="min-h-[16px] text-center text-[10px] italic leading-tight text-[#1A1A1A]/60">
        {below.map((line, i) => (
          <div key={`below-${i}`}>{line}</div>
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
