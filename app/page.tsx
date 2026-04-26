"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Mol3D from "./components/Mol3D";
import InputPane, {
  type Highlight,
  type HighlightColor,
} from "./components/InputPane";
import ReactionPane from "./components/ReactionPane";
import CompoundsPane from "./components/CompoundsPane";

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

type Step = {
  step_number: number;
  description: string;
  compounds: Compound[];
  conditions: Conditions;
};

type HistoryItem = {
  id: string;
  source_text_preview: string;
  compound_count: number;
  primary_product_name: string;
  created_at: string;
};

type SearchResult = {
  extraction_id: string;
  compound_name: string;
  one_line: string;
  source_text_preview: string;
  score: number;
};

type CompoundInfo = {
  formula: string | null;
  weight: string | null;
  iupac_from_pubchem: string | null;
  cid: number | null;
};

type PaneType = "input" | "reaction" | "compounds";
type Slot = "left" | "topRight" | "bottomRight";
type PanelAssignments = Record<Slot, PaneType>;

const DEFAULT_ASSIGNMENTS: PanelAssignments = {
  left: "input",
  topRight: "reaction",
  bottomRight: "compounds",
};

const PANE_TITLES: Record<PaneType, string> = {
  input: "Input",
  reaction: "The Reaction",
  compounds: "Compounds",
};

const STORAGE_KEY = "stoich-panel-assignments";

const EMPTY_CONDITIONS: Conditions = {
  temperature: null,
  pressure: null,
  time: null,
  yield: null,
  notes: null,
};

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

function stepHasReaction(step: Step): boolean {
  const r = step.compounds.filter((c) => c.role?.toLowerCase() === "reactant");
  const p = step.compounds.filter((c) => c.role?.toLowerCase() === "product");
  return r.length > 0 && p.length > 0;
}

function isValidAssignments(v: unknown): v is PanelAssignments {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  const slots: Slot[] = ["left", "topRight", "bottomRight"];
  const types = new Set(["input", "reaction", "compounds"]);
  const seen = new Set<string>();
  for (const s of slots) {
    const t = a[s];
    if (typeof t !== "string" || !types.has(t)) return false;
    if (seen.has(t)) return false;
    seen.add(t);
  }
  return true;
}

function swapAssignments(
  assignments: PanelAssignments,
  slot: Slot,
  newType: PaneType
): PanelAssignments {
  if (assignments[slot] === newType) return assignments;
  const otherSlot = (Object.keys(assignments) as Slot[]).find(
    (s) => assignments[s] === newType
  );
  const next = { ...assignments };
  next[slot] = newType;
  if (otherSlot) next[otherSlot] = assignments[slot];
  return next;
}

export default function Home() {
  const [text, setText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  );
  const [searchLoading, setSearchLoading] = useState(false);

  const [drawerCompound, setDrawerCompound] = useState<Compound | null>(null);

  const [viewMode, setViewMode] = useState<"equation" | "graph">("equation");

  const [narrateLoading, setNarrateLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [panelAssignments, setPanelAssignments] =
    useState<PanelAssignments>(DEFAULT_ASSIGNMENTS);
  const [assignmentsHydrated, setAssignmentsHydrated] = useState(false);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidAssignments(parsed)) {
          setPanelAssignments(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setAssignmentsHydrated(true);
  }, []);

  useEffect(() => {
    if (!assignmentsHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(panelAssignments));
    } catch (e) {
      console.error(e);
    }
  }, [panelAssignments, assignmentsHydrated]);

  const readSelectionFromTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      setSelectedText(el.value.slice(start, end));
    } else {
      setSelectedText("");
    }
  }, []);

  useEffect(() => {
    function onMouseUp() {
      if (document.activeElement === textareaRef.current) {
        readSelectionFromTextarea();
      }
    }
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [readSelectionFromTextarea]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = (await res.json()) as {
        items?: HistoryItem[];
        error?: string;
      };
      setHistory(data.items ?? []);
      setHistoryError(Boolean(data.error));
    } catch (e) {
      console.error(e);
      setHistoryError(true);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = (await res.json()) as {
          results?: SearchResult[];
          error?: string;
        };
        setSearchResults(data.results ?? []);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") &&
      file.type !== "application/pdf"
    ) {
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
  }, []);

  const clearText = useCallback(() => {
    setText("");
    setSelectedText("");
    setPdfInfo(null);
    setPdfError(null);
    setHighlights([]);
    setExtractionId(null);
  }, []);

  function localHighlightId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const createHighlight = useCallback(
    async (
      start: number,
      end: number,
      color: HighlightColor,
      note: string | null
    ) => {
      if (start >= end) return;
      const el = textareaRef.current;
      if (!el) return;
      const sliceText = el.value.slice(start, end);
      if (!sliceText.trim()) return;

      const tempId = localHighlightId();
      const optimistic: Highlight = {
        id: tempId,
        extraction_id: extractionId,
        text: sliceText,
        start_offset: start,
        end_offset: end,
        color,
        note,
        created_at: new Date().toISOString(),
      };
      setHighlights((prev) =>
        [...prev, optimistic].sort(
          (a, b) => a.start_offset - b.start_offset
        )
      );

      if (extractionId) {
        try {
          const res = await fetch("/api/highlights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              extraction_id: extractionId,
              text: sliceText,
              start_offset: start,
              end_offset: end,
              color,
              note,
            }),
          });
          if (res.ok) {
            const saved = (await res.json()) as Highlight;
            setHighlights((prev) =>
              prev.map((h) => (h.id === tempId ? saved : h))
            );
          }
        } catch (e) {
          console.error("highlight POST failed", e);
        }
      }
    },
    [extractionId]
  );

  const updateHighlight = useCallback(
    async (
      id: string,
      patch: { note?: string | null; color?: HighlightColor }
    ) => {
      setHighlights((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
      );
      const isStaged = id.startsWith("local-") || id.length !== 24;
      if (isStaged) return;
      try {
        await fetch("/api/highlights", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
      } catch (e) {
        console.error("highlight PATCH failed", e);
      }
    },
    []
  );

  const deleteHighlight = useCallback(async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    const isStaged = id.startsWith("local-") || id.length !== 24;
    if (isStaged) return;
    try {
      await fetch(`/api/highlights?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("highlight DELETE failed", e);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const textToSend = selectedText.trim() || text.trim();
    if (!textToSend || loading) return;

    const wasStaged = extractionId === null;
    const stagedHighlights = wasStaged ? [...highlights] : [];

    setLoading(true);
    setErrored(false);
    setSteps([]);
    setCompounds([]);
    setConditions(EMPTY_CONDITIONS);
    setHasRun(true);
    if (!wasStaged) {
      setHighlights([]);
      setExtractionId(null);
    }

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        steps?: Step[];
        compounds: Compound[];
        conditions?: Conditions;
        extraction_id?: string;
      };
      setSteps(data.steps ?? []);
      setCompounds(data.compounds ?? []);
      setConditions({ ...EMPTY_CONDITIONS, ...(data.conditions ?? {}) });

      if (data.extraction_id) {
        setExtractionId(data.extraction_id);
        if (stagedHighlights.length > 0) {
          const persisted: Highlight[] = [];
          for (const h of stagedHighlights) {
            try {
              const r = await fetch("/api/highlights", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  extraction_id: data.extraction_id,
                  text: h.text,
                  start_offset: h.start_offset,
                  end_offset: h.end_offset,
                  color: h.color,
                  note: h.note,
                }),
              });
              if (r.ok) {
                persisted.push((await r.json()) as Highlight);
              } else {
                persisted.push(h);
              }
            } catch (e) {
              console.error("staged highlight persist failed", e);
              persisted.push(h);
            }
          }
          setHighlights(
            persisted.sort((a, b) => a.start_offset - b.start_offset)
          );
        }
      }

      refreshHistory();
    } catch (err) {
      console.error(err);
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, [selectedText, text, loading, refreshHistory, extractionId, highlights]);

  const loadExtraction = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/extraction/${id}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as {
        source_text: string;
        steps?: Step[];
        compounds: Compound[];
        conditions: Conditions;
      };
      setText(data.source_text ?? "");
      setSelectedText("");
      setSteps(data.steps ?? []);
      setCompounds(data.compounds ?? []);
      setConditions({ ...EMPTY_CONDITIONS, ...(data.conditions ?? {}) });
      setHasRun(true);
      setErrored(false);
      setPdfInfo(null);
      setPdfError(null);
      setExtractionId(id);

      try {
        const hr = await fetch(
          `/api/highlights?extraction_id=${encodeURIComponent(id)}`
        );
        const hd = (await hr.json()) as { items?: Highlight[] };
        setHighlights(hd.items ?? []);
      } catch (e) {
        console.error("highlight fetch failed", e);
        setHighlights([]);
      }
    } catch (e) {
      console.error("load extraction failed", e);
    }
  }, []);

  const handleNarrate = useCallback(async () => {
    if (narrateLoading || compounds.length === 0) return;
    setNarrateLoading(true);
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compounds, conditions }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch((e) => console.error(e));
      }
    } catch (e) {
      console.error("narrate failed", e);
    } finally {
      setNarrateLoading(false);
    }
  }, [narrateLoading, compounds, conditions]);

  const reactionSteps = steps.filter(stepHasReaction);

  const handleSwap = useCallback((slot: Slot, newType: PaneType) => {
    setPanelAssignments((cur) => swapAssignments(cur, slot, newType));
  }, []);

  function renderPaneContent(type: PaneType) {
    if (type === "input") {
      return (
        <InputPane
          text={text}
          setText={setText}
          selectedText={selectedText}
          loading={loading}
          errored={errored}
          pdfLoading={pdfLoading}
          pdfError={pdfError}
          pdfInfo={pdfInfo}
          dragOver={dragOver}
          setDragOver={setDragOver}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          history={history}
          historyError={historyError}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          onSubmit={handleSubmit}
          onFile={handleFile}
          onClear={clearText}
          onLoadExtraction={loadExtraction}
          readSelectionFromTextarea={readSelectionFromTextarea}
          highlights={highlights}
          onCreateHighlight={createHighlight}
          onUpdateHighlight={updateHighlight}
          onDeleteHighlight={deleteHighlight}
        />
      );
    }
    if (type === "reaction") {
      return (
        <ReactionPane
          loading={loading}
          hasRun={hasRun}
          reactionSteps={reactionSteps}
          compoundsCount={compounds.length}
          viewMode={viewMode}
          setViewMode={setViewMode}
          narrateLoading={narrateLoading}
          onNarrate={handleNarrate}
          audioRef={audioRef}
          onPickCompound={(c) => setDrawerCompound(c)}
        />
      );
    }
    return (
      <CompoundsPane
        loading={loading}
        hasRun={hasRun}
        compounds={compounds}
        onPickCompound={(c) => setDrawerCompound(c)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] lg:h-screen lg:overflow-hidden">
      {/* Mobile fallback: vertical stack, no draggable panels */}
      <div className="flex flex-col lg:hidden">
        <section className="min-h-[80vh] border-b border-stone-200">
          {renderPaneContent("input")}
        </section>
        <section className="min-h-[60vh] border-b border-stone-200">
          {renderPaneContent("reaction")}
        </section>
        <section className="min-h-[60vh]">
          {renderPaneContent("compounds")}
        </section>
      </div>

      {/* Desktop: resizable panel system */}
      <div className="hidden h-screen lg:block">
        <PanelGroup
          direction="horizontal"
          autoSaveId="stoich-horizontal"
          className="h-full"
        >
          <Panel defaultSize={50} minSize={25} order={1}>
            <PaneShell
              slot="left"
              assignment={panelAssignments.left}
              onSwap={(t) => handleSwap("left", t)}
            >
              {renderPaneContent(panelAssignments.left)}
            </PaneShell>
          </Panel>

          <PanelResizeHandle className="group relative flex w-1 cursor-col-resize items-center justify-center bg-stone-200 transition-colors hover:bg-[#CFFF00] data-[resize-handle-state=drag]:bg-[#CFFF00]" />

          <Panel defaultSize={50} minSize={25} order={2}>
            <PanelGroup direction="vertical" autoSaveId="stoich-vertical">
              <Panel defaultSize={50} minSize={20} order={1}>
                <PaneShell
                  slot="topRight"
                  assignment={panelAssignments.topRight}
                  onSwap={(t) => handleSwap("topRight", t)}
                >
                  {renderPaneContent(panelAssignments.topRight)}
                </PaneShell>
              </Panel>

              <PanelResizeHandle className="group relative flex h-1 cursor-row-resize items-center justify-center bg-stone-200 transition-colors hover:bg-[#CFFF00] data-[resize-handle-state=drag]:bg-[#CFFF00]" />

              <Panel defaultSize={50} minSize={20} order={2}>
                <PaneShell
                  slot="bottomRight"
                  assignment={panelAssignments.bottomRight}
                  onSwap={(t) => handleSwap("bottomRight", t)}
                >
                  {renderPaneContent(panelAssignments.bottomRight)}
                </PaneShell>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {drawerCompound && (
        <CompoundDrawer
          compound={drawerCompound}
          onClose={() => setDrawerCompound(null)}
        />
      )}
    </main>
  );
}

function PaneShell({
  slot,
  assignment,
  onSwap,
  children,
}: {
  slot: Slot;
  assignment: PaneType;
  onSwap: (t: PaneType) => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc() {
      setMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [menuOpen]);

  return (
    <div className="flex h-full flex-col bg-[#FAF7F2]">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50/80 px-3">
        <h3
          className="text-xs italic text-[#1A1A1A]/70"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {PANE_TITLES[assignment]}
        </h3>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            title={`Swap ${PANE_TITLES[assignment]}`}
            aria-label={`Swap pane ${slot}`}
            className="flex h-5 w-5 items-center justify-center rounded text-[#1A1A1A]/60 transition-colors hover:bg-[#1A1A1A]/10 hover:text-[#1A1A1A]"
          >
            ⇄
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg">
              {(["input", "reaction", "compounds"] as PaneType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onSwap(t);
                    setMenuOpen(false);
                  }}
                  className={
                    "block w-full px-3 py-1.5 text-left text-xs transition-colors " +
                    (t === assignment
                      ? "bg-[#CFFF00]/30 text-[#1A1A1A]"
                      : "text-[#1A1A1A] hover:bg-stone-50")
                  }
                >
                  {PANE_TITLES[t]}
                  {t === assignment ? " ·" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function CompoundDrawer({
  compound,
  onClose,
}: {
  compound: Compound;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<CompoundInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isProduct = compound.role?.toLowerCase() === "product";

  useEffect(() => {
    let cancelled = false;
    setInfoLoading(true);
    setInfo(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/compound-info?smiles=${encodeURIComponent(compound.smiles)}`
        );
        const data = (await res.json()) as CompoundInfo;
        if (!cancelled) setInfo(data);
      } catch (e) {
        console.error("compound-info fetch failed", e);
        if (!cancelled)
          setInfo({
            formula: null,
            weight: null,
            iupac_from_pubchem: null,
            cid: null,
          });
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compound.smiles]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copySmiles() {
    try {
      await navigator.clipboard.writeText(compound.smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  }

  const pubchemUrl = info?.cid
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${info.cid}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative h-full w-full max-w-[400px] overflow-y-auto bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-[#1A1A1A]/15 bg-white px-2 py-0.5 text-sm text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mt-2">
          <Mol3D smiles={compound.smiles} height={280} />
          <p className="mt-1 text-[10px] text-[#1A1A1A]/50">
            3D model (drag to rotate, scroll to zoom)
          </p>
        </div>

        <div className="mt-4 flex justify-center rounded-xl bg-white">
          {imageFailed ? (
            <div className="flex h-48 w-full items-center justify-center rounded-xl bg-[#1A1A1A]/5 text-sm text-[#1A1A1A]/50">
              structure not in PubChem
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={compound.image_url}
              alt={compound.name}
              className="max-h-72 w-full rounded-xl bg-white object-contain"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>

        <h2
          className="mt-5 text-2xl tracking-tight text-[#1A1A1A]"
          style={SERIF}
        >
          {compound.name}
        </h2>
        <span
          className={
            "mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider " +
            (isProduct
              ? "bg-[#CFFF00] text-[#1A1A1A]"
              : "bg-[#1A1A1A]/10 text-[#1A1A1A]/70")
          }
        >
          {compound.role?.toUpperCase()}
        </span>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/50">
            Identifiers
          </h3>
          <dl className="mt-2 space-y-2 text-xs">
            <Row label="IUPAC">
              <span className="break-words font-mono text-[#1A1A1A]/80">
                {compound.iupac || info?.iupac_from_pubchem || "—"}
              </span>
            </Row>
            <Row label="SMILES">
              <span className="flex items-start gap-2">
                <span className="break-all font-mono text-[#1A1A1A]/80">
                  {compound.smiles}
                </span>
                <button
                  type="button"
                  onClick={copySmiles}
                  className="shrink-0 rounded-full border border-[#1A1A1A]/15 bg-white px-1.5 py-0.5 text-[9px] text-[#1A1A1A]/70 hover:bg-[#1A1A1A]/5"
                >
                  {copied ? "✓" : "copy"}
                </button>
              </span>
            </Row>
            <Row label="Formula">
              {infoLoading ? (
                <Skeleton />
              ) : (
                <span className="font-mono text-[#1A1A1A]/80">
                  {info?.formula ?? "—"}
                </span>
              )}
            </Row>
            <Row label="Weight">
              {infoLoading ? (
                <Skeleton />
              ) : (
                <span className="font-mono text-[#1A1A1A]/80">
                  {info?.weight ? `${info.weight} g/mol` : "—"}
                </span>
              )}
            </Row>
          </dl>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/50">
            Description
          </h3>
          <p className="mt-2 text-sm italic text-[#1A1A1A]/80">
            {compound.one_line}
          </p>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A]/50">
            External
          </h3>
          {infoLoading ? (
            <Skeleton className="mt-2 w-40" />
          ) : pubchemUrl ? (
            <a
              href={pubchemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-[#1A1A1A] underline decoration-[#CFFF00] decoration-2 underline-offset-4 hover:opacity-80"
            >
              PubChem CID {info?.cid} ↗
            </a>
          ) : (
            <p className="mt-2 text-sm text-[#1A1A1A]/50">
              Not found in PubChem
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-[#1A1A1A]/50">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-block h-3 w-24 animate-pulse rounded bg-[#1A1A1A]/10 " +
        className
      }
    />
  );
}
