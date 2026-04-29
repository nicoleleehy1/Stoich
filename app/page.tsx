import type { Metadata } from "next";
import Link from "next/link";

const STOICH_GITHUB_URL = "https://github.com/nicoleleehy1/Stoich";

export const metadata: Metadata = {
  title: "Stoich — read chemistry, see the molecules",
  description:
    "Paste a paragraph, upload a PDF, or highlight a sentence. Stoich extracts every compound and builds the reaction.",
};

export default function LandingPage() {
  return (
    <main className="stoich-page relative min-h-screen overflow-hidden bg-[#FAF6EC] text-[#1A1A1A]">
      {/* Paper grain + faint ruled lines */}
      <div aria-hidden className="paper-lines pointer-events-none absolute inset-0" />
      <div aria-hidden className="paper-grain pointer-events-none absolute inset-0" />

      {/* Top corner: punched holes & date stamp */}
      <div aria-hidden className="absolute left-6 top-6 hidden flex-col gap-6 sm:flex">
        <span className="hole" />
        <span className="hole" />
        <span className="hole" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-8 sm:px-12">
        <span
          className="text-[11px] tracking-[0.32em] uppercase"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Lab Notebook · Vol. 04
        </span>
        <span
          className="hidden text-[11px] tracking-[0.32em] uppercase sm:block"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          Entry — 04.26.2026
        </span>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pt-16 pb-24 sm:px-12 sm:pt-24 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          {/* Margin note */}
          <p
            className="mb-6 text-[12px] leading-relaxed text-[#5b5346]"
            style={{ fontFamily: "var(--font-vt323)", fontSize: "18px" }}
          >
            ※ scratch — apr 26, ~11:42pm
          </p>

          <h1
            className="stoich-wordmark relative leading-[0.92]"
            style={{ fontFamily: "var(--font-lora)" }}
          >
            <span className="block text-[88px] sm:text-[140px] lg:text-[176px] font-medium tracking-tight">
              Stoich<span className="period">.</span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 600 24"
              className="wordmark-underline absolute -bottom-2 left-0 w-[58%]"
              preserveAspectRatio="none"
            >
              <path
                d="M2 14 C 120 4, 260 22, 380 10 S 580 14, 598 8"
                fill="none"
                stroke="#A8483B"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </h1>

          <p
            className="mt-10 max-w-xl text-[18px] leading-[1.55] text-[#2a2620] sm:text-[20px]"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Reads chemistry papers and shows you the molecules.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/lab"
              className="cta-btn group relative inline-flex items-center gap-3 border border-[#1A1A1A] bg-[#FAF6EC] px-7 py-3.5 text-[14px] tracking-[0.18em] uppercase"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              <span className="relative z-10">Open the lab</span>
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="relative z-10 h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 12 H 19" />
                <path d="M13 6 L 19 12 L 13 18" />
              </svg>
            </Link>

            <span
              className="text-[12px] tracking-[0.18em] uppercase text-[#7a7163]"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              No signup · paste & go
            </span>
          </div>

          {/* Tiny labelled list */}
          <ul
            className="mt-16 grid max-w-xl grid-cols-1 gap-x-10 gap-y-3 text-[14px] sm:grid-cols-2"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {[
              ["i.", "extracts every compound mentioned"],
              ["ii.", "draws 2D & 3D structures"],
              ["iii.", "tags reactants, products, catalysts"],
              ["iv.", "rebuilds the reaction with conditions"],
              ["v.", "narrates the mechanism aloud"],
              ["vi.", "remembers across papers you've read"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3">
                <span
                  className="mt-[2px] w-6 shrink-0 text-[#A8483B]"
                  style={{ fontFamily: "var(--font-lora)" }}
                >
                  {n}
                </span>
                <span className="text-[#2a2620]">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: animated benzene + tags */}
        <div className="relative hidden lg:col-span-5 lg:block">
          <figure className="relative mx-auto mt-6 w-full max-w-[460px]">
            <span
              className="absolute -top-3 left-2 text-[12px] tracking-[0.28em] uppercase text-[#7a7163]"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              fig. 1 — benzene, C₆H₆
            </span>

            <svg
              viewBox="0 0 400 400"
              className="benzene-svg w-full"
              aria-hidden
            >
              {/* graph paper square frame */}
              <rect
                x="20"
                y="20"
                width="360"
                height="360"
                fill="none"
                stroke="#1A1A1A"
                strokeWidth="0.6"
                strokeDasharray="2 4"
                opacity="0.45"
              />
              {/* tick marks */}
              {Array.from({ length: 9 }).map((_, i) => (
                <g key={i}>
                  <line
                    x1={20 + (i + 1) * 36}
                    y1="18"
                    x2={20 + (i + 1) * 36}
                    y2="22"
                    stroke="#1A1A1A"
                    strokeWidth="0.5"
                    opacity="0.5"
                  />
                  <line
                    x1="18"
                    y1={20 + (i + 1) * 36}
                    x2="22"
                    y2={20 + (i + 1) * 36}
                    stroke="#1A1A1A"
                    strokeWidth="0.5"
                    opacity="0.5"
                  />
                </g>
              ))}

              {/* benzene ring — hexagon traced + alternating double bonds */}
              <g transform="translate(200 200)">
                {/* outer hexagon */}
                <polygon
                  className="ring-trace"
                  points="0,-110 95,-55 95,55 0,110 -95,55 -95,-55"
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                {/* inner double-bond marks */}
                <g className="double-bonds" stroke="#1A1A1A" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="-72" y1="-42" x2="72" y2="-42" />
                  <line x1="-72" y1="42" x2="72" y2="42" />
                  <line x1="0" y1="-84" x2="0" y2="84" opacity="0" />
                </g>
                {/* vertex carbons */}
                {[
                  [0, -110],
                  [95, -55],
                  [95, 55],
                  [0, 110],
                  [-95, 55],
                  [-95, -55],
                ].map(([x, y], i) => (
                  <g key={i} className="vertex" style={{ animationDelay: `${i * 0.18}s` }}>
                    <circle cx={x} cy={y} r="6" fill="#FAF6EC" stroke="#1A1A1A" strokeWidth="2" />
                    <text
                      x={x}
                      y={y + 3}
                      fontSize="9"
                      textAnchor="middle"
                      fill="#1A1A1A"
                      style={{ fontFamily: "var(--font-inter)", fontWeight: 600 }}
                    >
                      C
                    </text>
                  </g>
                ))}
                {/* H labels off each vertex */}
                {[
                  [0, -135, "H"],
                  [118, -68, "H"],
                  [118, 68, "H"],
                  [0, 135, "H"],
                  [-118, 68, "H"],
                  [-118, -68, "H"],
                ].map(([x, y, l], i) => (
                  <text
                    key={i}
                    className="h-label"
                    x={x as number}
                    y={(y as number) + 3}
                    fontSize="11"
                    textAnchor="middle"
                    fill="#1A1A1A"
                    style={{
                      fontFamily: "var(--font-inter)",
                      animationDelay: `${1.4 + i * 0.12}s`,
                    }}
                  >
                    {l}
                  </text>
                ))}
              </g>

              {/* ambient annotation arrow */}
              <g className="annotate" stroke="#A8483B" strokeWidth="1.2" fill="none">
                <path
                  d="M 320 80 C 280 100, 260 110, 240 130"
                  strokeLinecap="round"
                />
                <path
                  d="M 240 130 L 248 124 M 240 130 L 246 138"
                  strokeLinecap="round"
                />
              </g>
              <text
                x="328"
                y="74"
                fontSize="11"
                fill="#A8483B"
                style={{ fontFamily: "var(--font-vt323)", fontSize: "16px" }}
                className="annotate-text"
              >
                aromatic
              </text>
            </svg>

            {/* drifting tags */}
            <div className="absolute inset-0 pointer-events-none">
              <span className="tag drift-a">reactant</span>
              <span className="tag drift-b">product</span>
              <span className="tag drift-c">catalyst</span>
              <span className="tag drift-d">solvent</span>
            </div>
          </figure>
        </div>
      </section>

      {/* SECONDARY: equation strip */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 sm:px-12">
        <div className="mb-6 flex items-baseline justify-between border-t border-[#1A1A1A]/40 pt-6">
          <h2
            className="text-[14px] tracking-[0.32em] uppercase"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            § 02 — A Reaction, Recovered
          </h2>
          <span
            className="text-[12px] text-[#7a7163]"
            style={{ fontFamily: "var(--font-vt323)", fontSize: "16px" }}
          >
            from a paragraph, in &lt;3s
          </span>
        </div>

        <div
          className="equation-row flex flex-wrap items-center gap-x-5 gap-y-6 text-[28px] sm:text-[34px]"
          style={{ fontFamily: "var(--font-lora)" }}
        >
          <Compound formula="CH₃COOH" tag="reactant" delay={0} />
          <Op>+</Op>
          <Compound formula="C₂H₅OH" tag="reactant" delay={0.15} />
          <Arrow />
          <Compound formula="CH₃COOC₂H₅" tag="product" delay={0.45} />
          <Op>+</Op>
          <Compound formula="H₂O" tag="byproduct" delay={0.6} />
        </div>

        <div
          className="mt-8 flex flex-wrap gap-x-10 gap-y-2 text-[12px] tracking-[0.2em] uppercase text-[#5b5346]"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <span>cat. H₂SO₄</span>
          <span>T = 78°C</span>
          <span>p = 1 atm</span>
          <span>yield ≈ 67%</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto max-w-6xl border-t border-[#1A1A1A]/40 px-6 py-8 sm:px-12">
        <div
          className="flex flex-col items-start justify-between gap-4 text-[11px] tracking-[0.18em] uppercase text-[#5b5346] sm:flex-row sm:items-center"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <span>Stoich · LA Hacks 2026</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>Gemma 3</span>
            <span aria-hidden>·</span>
            <span>MongoDB Atlas</span>
            <span aria-hidden>·</span>
            <span>PubChem</span>
            <span aria-hidden>·</span>
            <span>3Dmol.js</span>
            <span aria-hidden>·</span>
            <span>ElevenLabs</span>
          </span>
          <span className="flex items-center gap-4">
            <a
              href={STOICH_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              github →
            </a>
            <Link href="/" className="footer-link">
              /lab →
            </Link>
          </span>
        </div>
      </footer>

      <style>{styles}</style>
    </main>
  );
}

function Compound({
  formula,
  tag,
  delay,
}: {
  formula: string;
  tag: string;
  delay: number;
}) {
  return (
    <span
      className="compound relative inline-flex flex-col"
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="compound-formula">{formula}</span>
      <span
        className="compound-tag"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {tag}
      </span>
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="opacity-70">{children}</span>;
}

function Arrow() {
  return (
    <span className="inline-flex flex-col items-center px-1">
      <span
        className="text-[10px] tracking-[0.2em] uppercase text-[#A8483B]"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        H₂SO₄, Δ
      </span>
      <svg
        viewBox="0 0 80 16"
        className="h-4 w-20"
        aria-hidden
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path className="arrow-shaft" d="M2 8 H 76" />
        <path d="M68 3 L 76 8 L 68 13" />
      </svg>
    </span>
  );
}

const styles = `
  /* Paper background details */
  .paper-lines {
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 31px,
      rgba(168, 72, 59, 0.06) 31px,
      rgba(168, 72, 59, 0.06) 32px
    );
  }
  .paper-grain {
    background-image:
      radial-gradient(rgba(26,26,26,0.05) 1px, transparent 1px),
      radial-gradient(rgba(26,26,26,0.04) 1px, transparent 1px);
    background-size: 3px 3px, 7px 7px;
    background-position: 0 0, 1px 2px;
    mix-blend-mode: multiply;
    opacity: 0.55;
  }

  .hole {
    width: 14px; height: 14px; border-radius: 9999px;
    background: #EDE6D6;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.25);
    display: block;
  }

  /* Wordmark */
  .stoich-wordmark .period { color: #A8483B; }
  .stoich-wordmark .wordmark-underline path {
    stroke-dasharray: 1200;
    stroke-dashoffset: 1200;
    animation: ink-trace 2.2s cubic-bezier(.4,.1,.2,1) 0.3s forwards;
  }

  @keyframes ink-trace {
    to { stroke-dashoffset: 0; }
  }

  /* CTA */
  .cta-btn {
    transition: color .25s ease, background-color .25s ease, transform .25s ease;
    overflow: hidden;
  }
  .cta-btn::before {
    content: "";
    position: absolute; inset: 0;
    background: #A8483B;
    transform: translateY(102%);
    transition: transform .35s cubic-bezier(.4,.1,.2,1);
    z-index: 0;
  }
  .cta-btn:hover { color: #FAF6EC; transform: translateY(-1px); }
  .cta-btn:hover::before { transform: translateY(0); }

  /* Benzene drawing */
  .ring-trace {
    stroke-dasharray: 660;
    stroke-dashoffset: 660;
    animation: ink-trace 2.4s cubic-bezier(.4,.1,.2,1) 0.6s forwards;
  }
  .double-bonds line {
    opacity: 0;
    animation: bond-fade 0.6s ease 2.6s forwards;
  }
  @keyframes bond-fade { to { opacity: 1; } }

  .vertex circle, .vertex text {
    opacity: 0;
    animation: bond-fade 0.5s ease forwards;
    animation-delay: inherit;
  }
  .h-label {
    opacity: 0;
    animation: bond-fade 0.5s ease forwards;
  }

  .annotate path {
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: ink-trace 1.4s ease 3.2s forwards;
  }
  .annotate-text {
    opacity: 0;
    animation: bond-fade 0.6s ease 4.2s forwards;
  }

  .benzene-svg {
    animation: float 9s ease-in-out infinite;
    transform-origin: center;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-8px) rotate(0.6deg); }
  }

  /* Drifting tags */
  .tag {
    position: absolute;
    font-family: var(--font-vt323);
    font-size: 16px;
    color: #5b5346;
    background: #FAF6EC;
    padding: 2px 8px;
    border: 1px solid #1A1A1A;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .drift-a { top: 8%;  left: 4%;  animation: drift 11s ease-in-out infinite; }
  .drift-b { top: 22%; right: -4%; animation: drift 13s ease-in-out infinite reverse; }
  .drift-c { bottom: 18%; left: -2%; animation: drift 15s ease-in-out infinite; }
  .drift-d { bottom: 6%; right: 8%; animation: drift 12s ease-in-out infinite reverse; }
  @keyframes drift {
    0%, 100% { transform: translate(0,0); }
    50%      { transform: translate(6px, -10px); }
  }

  /* Equation strip */
  .compound {
    opacity: 0;
    transform: translateY(6px);
    animation: rise 0.7s cubic-bezier(.4,.1,.2,1) forwards;
  }
  @keyframes rise {
    to { opacity: 1; transform: translateY(0); }
  }
  .compound-formula {
    font-feature-settings: "lnum";
    border-bottom: 1px dashed transparent;
    transition: border-color .25s ease;
  }
  .compound:hover .compound-formula { border-color: #A8483B; }
  .compound-tag {
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #7a7163;
    margin-top: 6px;
  }
  .compound:hover .compound-tag { color: #A8483B; }

  .arrow-shaft {
    stroke-dasharray: 80;
    stroke-dashoffset: 80;
    animation: ink-trace 0.9s ease 0.3s forwards;
  }

  .footer-link {
    border-bottom: 1px solid transparent;
    transition: border-color .25s, color .25s;
  }
  .footer-link:hover { color: #A8483B; border-color: #A8483B; }

  /* Mobile: hide the right column animation already via lg:, simplify drift */
  @media (max-width: 640px) {
    .paper-lines { background-size: 100% 28px; }
    .stoich-wordmark .wordmark-underline { width: 70%; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    .ring-trace, .wordmark-underline path, .annotate path, .arrow-shaft {
      stroke-dashoffset: 0 !important;
    }
  }
`;
