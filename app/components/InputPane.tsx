"use client";

import { useState, type RefObject } from "react";

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

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export type Highlight = {
  id: string;
  extraction_id: string | null;
  text: string;
  start_offset: number;
  end_offset: number;
  color: HighlightColor;
  note: string | null;
  created_at: string;
};

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#FFF4A6",
  green: "#C7E9C0",
  blue: "#BFD7EA",
  pink: "#F5C2D7",
};

export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: "rgba(255, 244, 166, 0.4)",
  green: "rgba(199, 233, 192, 0.4)",
  blue: "rgba(191, 215, 234, 0.4)",
  pink: "rgba(245, 194, 215, 0.4)",
};

const COLOR_ORDER: HighlightColor[] = ["yellow", "green", "blue", "pink"];

const SERIF = { fontFamily: "var(--font-serif)" };
const SANS = { fontFamily: "var(--font-sans)" };
const MONO = { fontFamily: "var(--font-mono)" };

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
  highlights: Highlight[];
  onCreateHighlight: (
    start: number,
    end: number,
    color: HighlightColor,
    note: string | null
  ) => void;
  onUpdateHighlight: (
    id: string,
    patch: { note?: string | null; color?: HighlightColor }
  ) => void;
  onDeleteHighlight: (id: string) => void;
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
    highlights,
    onCreateHighlight,
    onUpdateHighlight,
    onDeleteHighlight,
  } = props;

  const [notePopoverOpen, setNotePopoverOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);

  const hasSelection = selectedText.trim().length > 0;
  const canSubmit = hasSelection || text.trim().length > 0;
  const showingSearch = searchResults !== null;

  function getCurrentRange(): { start: number; end: number } | null {
    const el = textareaRef.current;
    if (!el) return null;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end <= start) return null;
    return { start, end };
  }

  function applyColor(color: HighlightColor) {
    const range = getCurrentRange();
    if (!range) return;
    onCreateHighlight(range.start, range.end, color, null);
  }

  function openNote() {
    const range = getCurrentRange();
    if (!range) return;
    setNoteDraft("");
    setNotePopoverOpen(true);
  }

  function saveNote(color: HighlightColor) {
    const range = getCurrentRange();
    if (!range) {
      setNotePopoverOpen(false);
      return;
    }
    onCreateHighlight(
      range.start,
      range.end,
      color,
      noteDraft.trim() ? noteDraft.trim() : null
    );
    setNotePopoverOpen(false);
    setNoteDraft("");
  }

  function focusHighlight(h: Highlight) {
    const el = textareaRef.current;
    if (!el) return;
    if (h.end_offset > el.value.length) return;
    el.focus();
    el.setSelectionRange(h.start_offset, h.end_offset);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {sidebarOpen && (
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-[#1A1A1A]/25 bg-[#FAF6EC]/60">
          <div className="border-b border-[#1A1A1A]/25 p-3">
            <h2
              className="flex items-baseline gap-2 text-[15px] tracking-tight"
              style={SERIF}
            >
              <span
                className="text-[10px] uppercase tracking-[0.32em] text-[#A8483B]"
                style={SANS}
              >
                ¶
              </span>
              History
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search..."
              className="mt-2 w-full border border-[#1A1A1A]/30 bg-[#FAF6EC] px-3 py-1.5 text-xs text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A] focus:outline-none"
              style={SANS}
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
          <div
            className="border-t border-[#1A1A1A]/25 p-2 text-[10px] tracking-[0.18em] uppercase text-[#1A1A1A]/40"
            style={SANS}
          >
            mongodb atlas vector search
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lab-pill"
            style={SANS}
          >
            history
          </button>
          {pdfInfo && (
            <span
              className="text-[10px] tracking-[0.18em] uppercase text-[#1A1A1A]/50"
              style={SANS}
            >
              pdf loaded
            </span>
          )}
        </div>

        <header className="mb-5">
          <p
            className="text-[10px] tracking-[0.32em] uppercase text-[#A8483B]"
            style={SANS}
          >
            § 01 — Source
          </p>
          <h1
            className="mt-1 text-3xl tracking-tight"
            style={SERIF}
          >
            Paste, drop, or highlight
            <span className="text-[#A8483B]">.</span>
          </h1>
          <p
            className="mt-1 text-sm text-[#2a2620]"
            style={SANS}
          >
            a paragraph from a chemistry paper, a textbook, a wikipedia article — anything with molecules in it.
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
            "mb-3 cursor-pointer border border-dashed p-4 text-center text-sm transition-colors " +
            (pdfLoading
              ? "cursor-wait border-[#1A1A1A]/30 bg-[#FAF6EC] text-[#1A1A1A]/50"
              : dragOver
                ? "border-[#A8483B] bg-[#A8483B]/8 text-[#1A1A1A]"
                : "border-[#1A1A1A]/30 bg-[#FAF6EC] text-[#2a2620] hover:bg-[#1A1A1A]/[0.03]")
          }
          style={SANS}
        >
          {pdfLoading ? "reading pdf..." : "drop a pdf here or click to upload"}
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

        {pdfError && (
          <p className="mb-2 text-xs text-[#A8483B]" style={SANS}>
            {pdfError}
          </p>
        )}

        {pdfInfo && (
          <div
            className="mb-3 flex items-center gap-2 text-xs text-[#1A1A1A]/60"
            style={SANS}
          >
            <span className="truncate">
              loaded:{" "}
              <span className="font-medium text-[#1A1A1A]/80">
                {pdfInfo.name}
              </span>{" "}
              ({pdfInfo.pages} {pdfInfo.pages === 1 ? "page" : "pages"},{" "}
              {pdfInfo.chars.toLocaleString()} chars)
            </span>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 border border-[#1A1A1A]/30 bg-[#FAF6EC] px-2 py-0.5 text-[10px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A] hover:text-[#FAF6EC]"
              title="Clear"
            >
              ✕
            </button>
          </div>
        )}

        {pdfInfo?.truncated && (
          <p
            className="mb-2 text-xs italic text-[#1A1A1A]/60"
            style={SANS}
          >
            pdf was longer than 50k chars, showing first portion. highlight a
            section to extract.
          </p>
        )}

        <HighlightedTextarea
          text={text}
          setText={setText}
          highlights={highlights}
          textareaRef={textareaRef}
          readSelectionFromTextarea={readSelectionFromTextarea}
          hasSelection={hasSelection}
          notePopoverOpen={notePopoverOpen}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          onApplyColor={applyColor}
          onOpenNote={openNote}
          onCloseNote={() => setNotePopoverOpen(false)}
          onSaveNote={saveNote}
        />

        <div className="mt-3 flex items-center gap-2 text-xs" style={SANS}>
          {hasSelection ? (
            <>
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#A8483B]" />
              <span className="truncate italic text-[#1A1A1A]/70">
                extracting selection: {selectedText.slice(0, 80)}
                {selectedText.length > 80 ? "..." : ""}
              </span>
            </>
          ) : (
            <span className="text-[#1A1A1A]/50">extracting full paragraph</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setText(EXAMPLE_TEXT)}
            className="lab-pill"
            style={SANS}
          >
            try an example
          </button>
          <button
            type="button"
            onClick={() => setText(MULTISTEP_EXAMPLE_TEXT)}
            className="lab-pill"
            style={SANS}
          >
            try multi-step example
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !canSubmit}
            className="extract-btn"
            style={SANS}
          >
            {loading
              ? "reading paragraph..."
              : hasSelection
                ? "extract selection →"
                : "extract molecules →"}
          </button>
        </div>

        {errored && (
          <p
            className="mt-3 text-sm text-[#A8483B]"
            style={SANS}
          >
            extraction failed, try again
          </p>
        )}

        <HighlightsSection
          highlights={highlights}
          expanded={highlightsExpanded}
          setExpanded={setHighlightsExpanded}
          onFocus={focusHighlight}
          onUpdate={onUpdateHighlight}
          onDelete={onDeleteHighlight}
        />
      </div>

      <style>{paneStyles}</style>
    </div>
  );
}

const paneStyles = `
  .lab-pill {
    border: 1px solid #1A1A1A;
    background: #FAF6EC;
    color: #1A1A1A;
    padding: 8px 16px;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    transition: background-color .2s, color .2s;
  }
  .lab-pill:hover {
    background: #1A1A1A;
    color: #FAF6EC;
  }
  .extract-btn {
    border: 1px solid #1A1A1A;
    background: #1A1A1A;
    color: #FAF6EC;
    padding: 11px 22px;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    transition: background-color .2s, color .2s, opacity .2s;
  }
  .extract-btn:hover { background: #FAF6EC; color: #1A1A1A; }
  .extract-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .extract-btn:disabled:hover { background: #1A1A1A; color: #FAF6EC; }
`;

function HighlightedTextarea({
  text,
  setText,
  highlights,
  textareaRef,
  readSelectionFromTextarea,
  hasSelection,
  notePopoverOpen,
  noteDraft,
  setNoteDraft,
  onApplyColor,
  onOpenNote,
  onCloseNote,
  onSaveNote,
}: {
  text: string;
  setText: (s: string) => void;
  highlights: Highlight[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  readSelectionFromTextarea: () => void;
  hasSelection: boolean;
  notePopoverOpen: boolean;
  noteDraft: string;
  setNoteDraft: (s: string) => void;
  onApplyColor: (c: HighlightColor) => void;
  onOpenNote: () => void;
  onCloseNote: () => void;
  onSaveNote: (color: HighlightColor) => void;
}) {
  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const mirror = (e.currentTarget.parentElement?.querySelector(
      "[data-mirror]"
    ) as HTMLDivElement) ?? null;
    if (mirror) {
      mirror.scrollTop = e.currentTarget.scrollTop;
      mirror.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  return (
    <div className="relative w-full flex-1">
      <div className="relative h-full min-h-[200px] w-full overflow-hidden border border-[#1A1A1A]/30 bg-[#FDFBF5] focus-within:border-[#1A1A1A]">
        <div
          data-mirror
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-5 text-base leading-relaxed"
          style={{ color: "transparent", ...SANS }}
        >
          {renderSegments(text, highlights)}
        </div>
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
          onScroll={handleScroll}
          placeholder="paste a paragraph from a chemistry paper, an organic chem textbook, a wikipedia article on a drug..."
          className="absolute inset-0 h-full w-full resize-none bg-transparent p-5 text-base leading-relaxed text-[#1A1A1A] caret-[#A8483B] placeholder:text-[#1A1A1A]/40 focus:outline-none"
          style={SANS}
        />

        {hasSelection && !notePopoverOpen && (
          <div
            className="absolute right-3 top-3 z-10 flex items-center gap-1 border border-[#1A1A1A]/30 bg-[#FAF6EC] p-1 shadow-md"
            onMouseDown={(e) => e.preventDefault()}
          >
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onApplyColor(c);
                }}
                title={`Highlight ${c}`}
                aria-label={`Highlight ${c}`}
                className="h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: HIGHLIGHT_COLORS[c] }}
              />
            ))}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onOpenNote();
              }}
              className="border border-[#1A1A1A]/30 bg-[#FAF6EC] px-2 py-0.5 text-xs text-[#1A1A1A]/80 hover:bg-[#1A1A1A] hover:text-[#FAF6EC]"
              title="Add note"
              style={SANS}
            >
              + note
            </button>
          </div>
        )}

        {notePopoverOpen && (
          <div
            className="absolute right-3 top-3 z-10 w-72 border border-[#1A1A1A]/30 bg-[#FAF6EC] p-3 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p
              className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#A8483B]"
              style={SANS}
            >
              note
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="what's interesting about this?"
              autoFocus
              className="h-20 w-full resize-none border border-[#1A1A1A]/30 bg-[#FDFBF5] p-2 text-xs text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A] focus:outline-none"
              style={SANS}
            />
            <p
              className="mb-1 mt-2 text-[10px] uppercase tracking-[0.18em] text-[#A8483B]"
              style={SANS}
            >
              color
            </p>
            <div className="flex items-center gap-1">
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSaveNote(c)}
                  title={`Save with ${c}`}
                  aria-label={`Save with ${c}`}
                  className="h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: HIGHLIGHT_COLORS[c] }}
                />
              ))}
              <button
                type="button"
                onClick={onCloseNote}
                className="ml-auto border border-[#1A1A1A]/30 bg-[#FAF6EC] px-2 py-0.5 text-[10px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A] hover:text-[#FAF6EC]"
                style={SANS}
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderSegments(text: string, highlights: Highlight[]) {
  const valid = highlights.filter(
    (h) =>
      h.start_offset >= 0 &&
      h.end_offset <= text.length &&
      h.start_offset < h.end_offset
  );
  if (valid.length === 0) return text;

  type Event = { offset: number; kind: "start" | "end"; h: Highlight };
  const events: Event[] = [];
  for (const h of valid) {
    events.push({ offset: h.start_offset, kind: "start", h });
    events.push({ offset: h.end_offset, kind: "end", h });
  }
  events.sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    return a.kind === "end" ? -1 : 1;
  });

  const active: Highlight[] = [];
  let cursor = 0;
  const out: React.ReactNode[] = [];
  let key = 0;

  function emit(slice: string, current: Highlight[]) {
    if (slice.length === 0) return;
    if (current.length === 0) {
      out.push(<span key={`p-${key++}`}>{slice}</span>);
      return;
    }
    let node: React.ReactNode = slice;
    for (const h of current) {
      const bg = HIGHLIGHT_BG[h.color] ?? HIGHLIGHT_BG.yellow;
      node = (
        <span
          key={`h-${h.id}-${key++}`}
          style={{ backgroundColor: bg, borderRadius: 2 }}
        >
          {node}
        </span>
      );
    }
    out.push(<span key={`s-${key++}`}>{node}</span>);
  }

  for (const ev of events) {
    if (ev.offset > cursor) {
      emit(text.slice(cursor, ev.offset), active);
      cursor = ev.offset;
    }
    if (ev.kind === "start") {
      active.push(ev.h);
    } else {
      const idx = active.findIndex((a) => a.id === ev.h.id);
      if (idx >= 0) active.splice(idx, 1);
    }
  }
  if (cursor < text.length) emit(text.slice(cursor), active);

  return <>{out}</>;
}

function HighlightsSection({
  highlights,
  expanded,
  setExpanded,
  onFocus,
  onUpdate,
  onDelete,
}: {
  highlights: Highlight[];
  expanded: boolean;
  setExpanded: (b: boolean) => void;
  onFocus: (h: Highlight) => void;
  onUpdate: (
    id: string,
    patch: { note?: string | null; color?: HighlightColor }
  ) => void;
  onDelete: (id: string) => void;
}) {
  if (highlights.length === 0) return null;
  return (
    <div className="mt-5 border-t border-[#1A1A1A]/25 pt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs text-[#1A1A1A]/70 hover:text-[#A8483B]"
        style={SANS}
      >
        <span>
          <span className="text-[#A8483B]">¶</span> {highlights.length}{" "}
          {highlights.length === 1 ? "highlight" : "highlights"}
        </span>
        <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <ul className="mt-3 flex flex-col gap-2">
          {highlights.map((h) => (
            <HighlightItem
              key={h.id}
              highlight={h}
              onFocus={onFocus}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HighlightItem({
  highlight,
  onFocus,
  onUpdate,
  onDelete,
}: {
  highlight: Highlight;
  onFocus: (h: Highlight) => void;
  onUpdate: (
    id: string,
    patch: { note?: string | null; color?: HighlightColor }
  ) => void;
  onDelete: (h: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(highlight.note ?? "");

  function save() {
    const value = draft.trim() ? draft.trim() : null;
    onUpdate(highlight.id, { note: value });
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(highlight.note ?? "");
    setEditing(false);
  }

  const truncated =
    highlight.text.length > 80
      ? highlight.text.slice(0, 80) + "..."
      : highlight.text;

  return (
    <li className="group relative border border-[#1A1A1A]/20 bg-[#FDFBF5] p-2.5">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: HIGHLIGHT_COLORS[highlight.color] }}
          title={highlight.color}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onFocus(highlight)}
            className="block w-full text-left text-xs text-[#1A1A1A] hover:underline"
            style={SANS}
          >
            <span
              className="rounded-sm px-0.5"
              style={{
                backgroundColor: HIGHLIGHT_BG[highlight.color],
              }}
            >
              {truncated}
            </span>
          </button>
          {editing ? (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="add a note..."
                autoFocus
                className="h-16 w-full resize-none border border-[#1A1A1A]/30 bg-[#FAF6EC] p-2 text-xs text-[#1A1A1A] placeholder:text-[#1A1A1A]/40 focus:border-[#1A1A1A] focus:outline-none"
                style={SANS}
              />
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={save}
                  className="border border-[#1A1A1A] bg-[#1A1A1A] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#FAF6EC] hover:bg-[#FAF6EC] hover:text-[#1A1A1A]"
                  style={SANS}
                >
                  save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="border border-[#1A1A1A]/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#1A1A1A]/70 hover:bg-[#1A1A1A] hover:text-[#FAF6EC]"
                  style={SANS}
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(highlight.note ?? "");
                setEditing(true);
              }}
              className="mt-1 block w-full text-left text-[11px] italic text-[#1A1A1A]/60 hover:text-[#A8483B]"
              style={SANS}
            >
              {highlight.note ? highlight.note : "+ add note"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(highlight.id)}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Delete"
          aria-label="Delete highlight"
        >
          <span className="text-xs text-[#1A1A1A]/50 hover:text-[#A8483B]">
            ✕
          </span>
        </button>
      </div>
    </li>
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
    return (
      <p className="text-xs text-[#1A1A1A]/50" style={SANS}>
        history unavailable
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-xs text-[#1A1A1A]/50" style={SANS}>
        extractions you run will appear here.
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
            className="w-full border border-[#1A1A1A]/20 bg-[#FDFBF5] p-2 text-left transition-colors hover:border-[#A8483B] hover:bg-[#A8483B]/5"
          >
            <p
              className="truncate text-xs font-bold text-[#1A1A1A]"
              style={SANS}
            >
              {it.primary_product_name}
            </p>
            <p
              className="mt-1 line-clamp-2 text-[10px] text-[#1A1A1A]/60"
              style={SANS}
            >
              {it.source_text_preview}
            </p>
            <p
              className="mt-1 text-[10px] tracking-[0.1em] text-[#1A1A1A]/40"
              style={MONO}
            >
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
    return (
      <p className="text-xs text-[#1A1A1A]/50" style={SANS}>
        searching...
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="text-xs text-[#1A1A1A]/50" style={SANS}>
        no matches.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {results.map((r, i) => (
        <li key={`${r.extraction_id}-${i}`}>
          <button
            type="button"
            onClick={() => onPick(r.extraction_id)}
            className="w-full border border-[#1A1A1A]/20 bg-[#FDFBF5] p-2 text-left transition-colors hover:border-[#A8483B] hover:bg-[#A8483B]/5"
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className="truncate text-xs font-bold text-[#1A1A1A]"
                style={SANS}
              >
                {r.compound_name}
              </p>
              <span
                className="shrink-0 border border-[#A8483B]/40 bg-[#A8483B]/10 px-1.5 py-0.5 text-[9px] text-[#A8483B]"
                style={MONO}
              >
                {r.score.toFixed(3)}
              </span>
            </div>
            <p
              className="mt-1 line-clamp-2 text-[10px] italic text-[#1A1A1A]/70"
              style={SANS}
            >
              {r.one_line}
            </p>
            <p
              className="mt-1 line-clamp-1 text-[10px] text-[#1A1A1A]/50"
              style={SANS}
            >
              {r.source_text_preview}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
