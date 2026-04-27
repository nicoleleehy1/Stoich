"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STOICH_GITHUB_URL } from "../lib/site";

const SERIF = { fontFamily: "var(--font-serif)" };
const MONO = { fontFamily: "var(--font-mono)" };
const SANS = { fontFamily: "var(--font-sans)" };

const EXAMPLES: { label: string; blurb: string; text: string }[] = [
  {
    label: "aspirin synthesis",
    blurb: "single-step esterification",
    text: "We synthesized aspirin (acetylsalicylic acid) by reacting salicylic acid with acetic anhydride in the presence of a sulfuric acid catalyst. The product was purified by recrystallization from ethanol, yielding white crystalline needles characteristic of pure acetylsalicylic acid.",
  },
  {
    label: "haber process",
    blurb: "multi-step ammonia synthesis",
    text: "In the Haber process, nitrogen and hydrogen gas are passed over an iron catalyst at 450°C and 200 atm to form ammonia. The ammonia is then condensed and separated, while unreacted nitrogen and hydrogen are recycled back into the reactor for additional passes.",
  },
  {
    label: "anti-inflammatory mechanism",
    blurb: "for the vector search demo",
    text: "Ibuprofen acts as a non-selective inhibitor of cyclooxygenase enzymes (COX-1 and COX-2), reducing the conversion of arachidonic acid to prostaglandin H2. Lower prostaglandin levels diminish inflammation, fever, and pain signaling at the site of injury.",
  },
];

export default function TopNav() {
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <>
      <nav className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-[#1A1A1A]/40 bg-white px-4 sm:px-6">
        <Link
          href="/landing"
          className="group inline-flex items-baseline gap-0 text-[20px] tracking-tight"
          style={SERIF}
          aria-label="Stoich — back to landing"
        >
          <span className="font-bold">Stoich</span>
          <span className="font-bold text-[#A8483B] transition-transform group-hover:translate-y-[1px]">
            .
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setDocsOpen(true)}
            className="nav-link"
            style={SANS}
          >
            docs
          </button>
          <span className="nav-sep" aria-hidden>
            ·
          </span>
          <a
            href={STOICH_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
            style={SANS}
          >
            github
          </a>
          <span className="nav-sep" aria-hidden>
            ·
          </span>
          <Link href="/landing" className="nav-link" style={SANS}>
            lab
          </Link>
        </div>

        <style>{navStyles}</style>
      </nav>

      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
    </>
  );
}

function DocsModal({ onClose }: { onClose: () => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function copyExample(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1200);
    } catch (e) {
      console.error("copy failed", e);
    }
  }

  return (
    <div
      className="docs-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How Stoich works"
    >
      <div
        className="docs-card relative my-8 w-full max-w-[720px] border border-[#1A1A1A]/40 bg-white p-6 sm:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center border border-[#1A1A1A]/40 bg-white text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          aria-label="Close docs"
        >
          ✕
        </button>

        <p
          className="mb-1 text-[11px] uppercase tracking-[0.32em] text-[#5b5346]"
          style={SANS}
        >
          Stoich · field guide
        </p>
        <h2 className="text-3xl tracking-tight sm:text-4xl" style={SERIF}>
          How Stoich works<span className="text-[#A8483B]">.</span>
        </h2>

        <DocsSection num="§ 01" title="Quick start">
          <ol className="docs-numlist">
            <li>
              <span className="num">i.</span> paste a paragraph from any
              chemistry paper into the input pane
            </li>
            <li>
              <span className="num">ii.</span> click <em>extract molecules</em>
            </li>
            <li>
              <span className="num">iii.</span> the reaction, the compounds, and
              the structures appear
            </li>
          </ol>
          <p className="docs-aside">
            or upload a PDF — Stoich pulls the text. or highlight a single
            sentence — Stoich extracts only that.
          </p>
        </DocsSection>

        <DocsSection num="§ 02" title="What you can do">
          <ul className="docs-numlist">
            {[
              "extract every compound from any chemistry paragraph",
              "see 2D structures (PubChem) and 3D models (drag to rotate)",
              "identify reactants, products, catalysts, and solvents automatically",
              "see the full reaction with temperature, pressure, time, and yield",
              "hear the reaction narrated aloud (ElevenLabs)",
              "search every paper you've read with vector search — type a concept, find the paper",
              "customize your workspace by swapping panes between slots",
              "toggle between equation view and graph view for multi-step reactions",
            ].map((line, i) => (
              <li key={i}>
                <span className="num">{romans[i]}.</span> {line}
              </li>
            ))}
          </ul>
        </DocsSection>

        <DocsSection num="§ 03" title="The stack">
          <ul className="docs-stack" style={MONO}>
            <li>gemma 3 27b — chemical reasoning</li>
            <li>mongodb atlas — vector search across your library</li>
            <li>pubchem & cactus — 2d and 3d structure rendering</li>
            <li>3dmol.js — interactive 3d viewer</li>
            <li>elevenlabs — reaction narration</li>
            <li>next.js — framework</li>
          </ul>
        </DocsSection>

        <DocsSection num="§ 04" title="Try this">
          <ul className="docs-examples">
            {EXAMPLES.map((ex, i) => (
              <li key={ex.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[15px]" style={SERIF}>
                      <span className="text-[#A8483B]">{romans[i]}.</span>{" "}
                      {ex.label}
                    </p>
                    <p
                      className="text-[12px] text-[#5b5346]"
                      style={SANS}
                    >
                      {ex.blurb}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyExample(ex.text, i)}
                    className="docs-copy"
                    style={SANS}
                  >
                    {copiedIdx === i ? "copied ✓" : "copy"}
                  </button>
                </div>
                <p
                  className="mt-2 line-clamp-3 text-[12px] italic text-[#2a2620]"
                  style={SANS}
                >
                  &ldquo;{ex.text}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </DocsSection>

        <DocsSection num="§ 05" title="Built for LA Hacks 2026">
          <p
            className="text-[14px] text-[#2a2620]"
            style={SANS}
          >
            built in a weekend, with paper-thin patience and a lot of caffeine.
          </p>
        </DocsSection>

        <style>{docsStyles}</style>
      </div>
    </div>
  );
}

function DocsSection({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="docs-section">
      <header className="docs-section-head">
        <span className="docs-num" style={SANS}>
          {num}
        </span>
        <h3 style={SERIF}>{title}</h3>
      </header>
      <div className="docs-section-body">{children}</div>
    </section>
  );
}

const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

const navStyles = `
  .nav-link {
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #2a2620;
    padding: 4px 8px;
    border-bottom: 1px solid transparent;
    transition: color .2s ease, border-color .2s ease;
    background: transparent;
  }
  .nav-link:hover {
    color: #A8483B;
    border-bottom-color: #A8483B;
  }
  .nav-sep {
    color: #1A1A1A;
    opacity: 0.3;
    font-size: 12px;
  }
`;

const docsStyles = `
  .docs-backdrop {
    background: rgba(26, 26, 26, 0.5);
    animation: docs-fade 0.18s ease-out;
  }
  .docs-card {
    animation: docs-rise 0.22s cubic-bezier(.4,.1,.2,1);
    box-shadow: 0 30px 60px -20px rgba(26, 26, 26, 0.35);
  }
  @keyframes docs-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes docs-rise {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .docs-section { margin-top: 30px; }
  .docs-section-head {
    display: flex; align-items: baseline; gap: 14px;
    border-top: 1px solid rgba(26,26,26,0.25);
    padding-top: 14px;
    margin-bottom: 10px;
  }
  .docs-num {
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #A8483B;
    min-width: 56px;
  }
  .docs-section-head h3 {
    font-size: 22px;
    letter-spacing: -0.01em;
    color: #1A1A1A;
  }
  .docs-section-body { padding-left: 70px; }
  @media (max-width: 640px) {
    .docs-section-body { padding-left: 0; }
  }

  .docs-numlist { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #2a2620; }
  .docs-numlist .num { color: #A8483B; display: inline-block; min-width: 1.6em; }
  .docs-aside { margin-top: 12px; font-size: 13px; color: #5b5346; font-style: italic; }

  .docs-stack { display: flex; flex-direction: column; gap: 4px; font-size: 16px; color: #5b5346; }

  .docs-examples { display: flex; flex-direction: column; gap: 18px; }
  .docs-examples > li {
    border: 1px solid rgba(26,26,26,0.18);
    background: #FFFFFF;
    padding: 12px 14px;
  }
  .docs-copy {
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    border: 1px solid #1A1A1A;
    padding: 4px 10px;
    color: #1A1A1A;
    background: #FFFFFF;
    transition: background-color .2s, color .2s;
    flex-shrink: 0;
  }
  .docs-copy:hover { background: #1A1A1A; color: #FFFFFF; }

  @media (prefers-reduced-motion: reduce) {
    .docs-backdrop, .docs-card { animation: none; }
  }
`;
