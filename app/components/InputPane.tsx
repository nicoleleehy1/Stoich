"use client";

import type { RefObject } from "react";

export type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

export type HistoryItem = {
  id: string;
  source_text_preview: string;
  compound_count: number;
  primary_product_name: string;
  created_at: string;
};

export type SearchResult = {
  extraction_id: string;
  compound_name: string;
  one_line: string;
  source_text_preview: string;
  score: number;
};

const SERIF = { fontFamily: "var(--font-serif)" };

const EXAMPLE_TEXT =
  "We synthesized aspirin (acetylsalicylic acid) by reacting salicylic acid with acetic anhydride in the presence of a sulfuric acid catalyst. The product was purified by recrystallization from ethanol, yielding white crystalline needles characteristic of pure acetylsalicylic acid.";

const MULTISTEP_EXAMPLE_TEXT =
  "In the first step, salicylic acid was treated with acetic anhydride in the presence of sulfuric acid catalyst at 85°C, yielding aspirin. The aspirin was then hydrolyzed in aqueous sodium hydroxide at room temperature to regenerate salicylic acid as the carboxylate salt, which was then acidified with HCl to recover salicylic acid.";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function InputPane(props: {
  text: string;
  setText: (s: string) => void;
  selectedText: string;
  loading: boolean;
  errored: boolean;
  pdfLoading: boolean;
  pdfError: string | null;
  pdfInfo: {
    name: string;
    pages: number;
    chars: number;
    truncated: boolean;
  } | null;
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  history: HistoryItem[];
  historyError: boolean;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  searchResults: SearchResult[] | null;
  searchLoading: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onFile: (f: File) => void;
  onClear: () => void;
  onLoadExtraction: (id: string) => void;
  readSelectionFromTextarea: () => void;
}) {
  const {
    text,
    setText,
    selectedText,
    loading,
    errored,
    pdfLoading,
    pdfError,
    pdfInfo,
    dragOver,
    setDragOver,
    sidebarOpen,
    setSidebarOpen,
    history,
    historyError,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    textareaRef,
    fileInputRef,
    onSubmit,
    onFile,
    onClear,
    onLoadExtraction,
    readSelectionFromTextarea,
  } = props;

  const hasSelection = selectedText.trim().length > 0;
  const canSubmit = hasSelection || text.trim().length > 0;
  const showingSearch = searchResults !== null;

  return (
    <div className="flex h-full overflow-hidden">
      {sidebarOpen && (
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-stone-200 bg-white/40">
          <div className="border-b border-stone-200 p-3">
            <h2 className="text-base tracking-tight" style={SERIF}>
              History
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A]/40 focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {showingSearch ? (
              <SearchList
                results={searchResults!}
                loading={searchLoading}
                onPick={onLoadExtraction}
              />
            ) : (
              <HistoryList
                items={history}
                error={historyError}
                onPick={onLoadExtraction}
              />
            )}
          </div>
          <div className="border-t border-stone-200 p-2 text-[9px] text-[#1A1A1A]/40">
            MongoDB Atlas Vector Search
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-full border border-[#1A1A1A]/20 bg-white px-3 py-1.5 text-xs text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
          >
            📚 History
          </button>
        </div>

        <header className="mb-4">
          <h1 className="text-4xl tracking-tight" style={SERIF}>
            Stoich
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
            if (file) onFile(file);
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
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {pdfError && <p className="mb-2 text-xs text-red-600">{pdfError}</p>}

        {pdfInfo && (
          <div className="mb-3 flex items-center gap-2 text-xs text-[#1A1A1A]/60">
            <span className="truncate">
              Loaded:{" "}
              <span className="font-medium text-[#1A1A1A]/80">
                {pdfInfo.name}
              </span>{" "}
              ({pdfInfo.pages} {pdfInfo.pages === 1 ? "page" : "pages"},{" "}
              {pdfInfo.chars.toLocaleString()} chars)
            </span>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded-full border border-[#1A1A1A]/15 bg-white px-2 py-0.5 text-[10px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
              title="Clear"
            >
              ✕
            </button>
          </div>
        )}

        {pdfInfo?.truncated && (
          <p className="mb-2 text-xs italic text-[#1A1A1A]/60">
            PDF was longer than 50k chars, showing first portion. Highlight a
            section to extract.
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
            onClick={() => setText(MULTISTEP_EXAMPLE_TEXT)}
            className="rounded-full border border-[#1A1A1A]/20 bg-white px-4 py-2 text-sm text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
          >
            Try multi-step example
          </button>
          <button
            type="button"
            onClick={onSubmit}
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
      </div>
    </div>
  );
}

function HistoryList({
  items,
  error,
  onPick,
}: {
  items: HistoryItem[];
  error: boolean;
  onPick: (id: string) => void;
}) {
  if (error) {
    return <p className="text-xs text-[#1A1A1A]/50">history unavailable</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-xs text-[#1A1A1A]/50">
        Extractions you run will appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => onPick(it.id)}
            className="w-full rounded-lg border border-stone-200 bg-white p-2 text-left transition-colors hover:bg-stone-50"
          >
            <p className="truncate text-xs font-bold text-[#1A1A1A]">
              {it.primary_product_name}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] text-[#1A1A1A]/60">
              {it.source_text_preview}
            </p>
            <p className="mt-1 text-[9px] text-[#1A1A1A]/40">
              {timeAgo(it.created_at)} · {it.compound_count}{" "}
              {it.compound_count === 1 ? "compound" : "compounds"}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SearchList({
  results,
  loading,
  onPick,
}: {
  results: SearchResult[];
  loading: boolean;
  onPick: (id: string) => void;
}) {
  if (loading) {
    return <p className="text-xs text-[#1A1A1A]/50">Searching...</p>;
  }
  if (results.length === 0) {
    return <p className="text-xs text-[#1A1A1A]/50">No matches.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {results.map((r, i) => (
        <li key={`${r.extraction_id}-${i}`}>
          <button
            type="button"
            onClick={() => onPick(r.extraction_id)}
            className="w-full rounded-lg border border-stone-200 bg-white p-2 text-left transition-colors hover:bg-stone-50"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold text-[#1A1A1A]">
                {r.compound_name}
              </p>
              <span className="shrink-0 rounded-full bg-[#CFFF00]/40 px-1.5 py-0.5 font-mono text-[9px] text-[#1A1A1A]/70">
                {r.score.toFixed(3)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] italic text-[#1A1A1A]/70">
              {r.one_line}
            </p>
            <p className="mt-1 line-clamp-1 text-[9px] text-[#1A1A1A]/50">
              {r.source_text_preview}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
