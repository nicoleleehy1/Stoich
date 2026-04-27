"use client";

import { useEffect, useRef, useState } from "react";
import { getRDKit, type RDKitMol } from "../lib/rdkit";

export type AtomData = {
  index: number;
  x: number;
  y: number;
  element: string;
};

export type AtomMap = {
  atoms: AtomData[];
  viewBoxX: number;
  viewBoxY: number;
  svgWidth: number;
  svgHeight: number;
  smiles: string;
};

type Props = {
  smiles: string;
  width?: number;
  height?: number;
  fallbackUrl?: string;
  onAtomMap?: (atomMap: AtomMap) => void;
  debug?: boolean;
};

type Status =
  | { kind: "loading" }
  | { kind: "ok"; svg: string }
  | { kind: "fallback" }
  | { kind: "error" };

const WRAPPER_PADDING = 20;

export default function RDKitStructure({
  smiles,
  width = 200,
  height = 200,
  fallbackUrl,
  onAtomMap,
  debug = false,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [atomMap, setAtomMap] = useState<AtomMap | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  // Hold the latest onAtomMap in a ref so the cleanup effect doesn't have to
  // include it in deps and re-run on every parent render. The callback only
  // needs to fire when a fresh SVG is inserted.
  const onAtomMapRef = useRef(onAtomMap);
  useEffect(() => {
    onAtomMapRef.current = onAtomMap;
  }, [onAtomMap]);

  useEffect(() => {
    let cancelled = false;
    // Hold the live mol on the closure so the cleanup function can delete it
    // even if the async work was interrupted by an unmount or a smiles change
    // before get_svg finished. mol.delete() frees WASM memory that JS GC won't.
    let activeMol: RDKitMol | null = null;
    setStatus({ kind: "loading" });
    setAtomMap(null);

    (async () => {
      try {
        const rdkit = await getRDKit();
        if (cancelled) return;

        const mol = rdkit.get_mol(smiles);
        if (!mol) {
          if (!cancelled) {
            setStatus(fallbackUrl ? { kind: "fallback" } : { kind: "error" });
          }
          return;
        }
        if (cancelled) {
          mol.delete();
          return;
        }
        activeMol = mol;

        if (typeof mol.set_new_coords === "function") {
          mol.set_new_coords(true);
        }

        const drawW = Math.max(60, width - 2 * WRAPPER_PADDING);
        const drawH = Math.max(60, height - 2 * WRAPPER_PADDING);

        // Ask RDKit-JS for a transparent background. backgroundColour is an
        // [r,g,b,a] tuple in 0-1 floats; alpha 0 disables the white fill the
        // MolDraw2D backend emits by default.
        const detailJson = JSON.stringify({
          width: drawW,
          height: drawH,
          backgroundColour: [1, 1, 1, 0],
        });

        let svg: string | null = null;
        try {
          svg = mol.get_svg_with_highlights(detailJson);
        } catch (err) {
          console.warn(
            "RDKit get_svg_with_highlights failed, falling back to get_svg",
            err
          );
        }
        if (!svg) {
          try {
            svg = mol.get_svg(drawW, drawH);
          } catch (err) {
            console.error("RDKit get_svg failed", err);
            if (!cancelled) {
              setStatus(
                fallbackUrl ? { kind: "fallback" } : { kind: "error" }
              );
            }
            return;
          }
        }

        if (!cancelled) setStatus({ kind: "ok", svg });
      } catch (err) {
        console.error("RDKit render failed", err);
        if (!cancelled) {
          setStatus(fallbackUrl ? { kind: "fallback" } : { kind: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (activeMol) {
        activeMol.delete();
        activeMol = null;
      }
    };
  }, [smiles, fallbackUrl, width, height]);

  // Once RDKit's SVG is in the DOM we have to scrub a few things:
  //   1. hardcoded width/height attributes (so the SVG can scale to the box)
  //   2. ANY <rect> with a white fill — RDKit may still inject one even with
  //      backgroundColour=transparent on some builds
  //   3. ANY <rect> that covers the full viewBox area (regardless of fill —
  //      treat it as a background and remove it)
  //   4. inline background style on the <svg> root
  //   5. expand the viewBox by ~8% on each side so edge atom labels (HO, OH)
  //      have breathing room and don't clip
  // Then walk the rendered atoms and extract their (index, x, y, element)
  // tuples in the (post-expansion) viewBox coordinate space, store them in
  // state for the debug overlay, and notify any onAtomMap listener.
  useEffect(() => {
    if (status.kind !== "ok") return;
    const host = svgHostRef.current;
    if (!host) return;
    const svgEl = host.querySelector("svg");
    if (!svgEl) return;

    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    (svgEl as SVGSVGElement).style.width = "100%";
    (svgEl as SVGSVGElement).style.height = "100%";
    (svgEl as SVGSVGElement).style.background = "transparent";
    (svgEl as SVGSVGElement).style.backgroundColor = "transparent";

    const initialViewBox = svgEl.getAttribute("viewBox");
    let vbWidth = 0;
    let vbHeight = 0;
    if (initialViewBox) {
      const parts = initialViewBox.split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        vbWidth = parts[2];
        vbHeight = parts[3];
      }
    }

    const rects = svgEl.querySelectorAll("rect");
    rects.forEach((r) => {
      const fillAttr = (r.getAttribute("fill") || "").toLowerCase().trim();
      const fillStyle = (r.style.fill || "").toLowerCase().trim();
      const isWhiteFill = (v: string) =>
        v === "#ffffff" ||
        v === "#fff" ||
        v === "white" ||
        v === "rgb(255,255,255)" ||
        v === "rgb(255, 255, 255)";

      const x = parseFloat(r.getAttribute("x") || "0");
      const y = parseFloat(r.getAttribute("y") || "0");
      const w = parseFloat(r.getAttribute("width") || "0");
      const h = parseFloat(r.getAttribute("height") || "0");
      const isFullCover =
        vbWidth > 0 &&
        vbHeight > 0 &&
        x <= 0.5 &&
        y <= 0.5 &&
        Math.abs(w - vbWidth) < 1 &&
        Math.abs(h - vbHeight) < 1;

      if (isWhiteFill(fillAttr) || isWhiteFill(fillStyle) || isFullCover) {
        r.remove();
      }
    });

    if (initialViewBox) {
      const parts = initialViewBox.split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [x, y, w, h] = parts;
        const padX = w * 0.08;
        const padY = h * 0.08;
        svgEl.setAttribute(
          "viewBox",
          `${x - padX} ${y - padY} ${w + padX * 2} ${h + padY * 2}`
        );
      }
    }

    const extracted = extractAtomMap(svgEl, smiles);
    setAtomMap(extracted);
    if (extracted) onAtomMapRef.current?.(extracted);
  }, [status, smiles]);

  const wrapperStyle: React.CSSProperties = {
    width,
    height,
    boxSizing: "border-box",
    padding: WRAPPER_PADDING,
  };

  const isPlaceholder = status.kind === "loading" || status.kind === "error";
  const wrapperBg = isPlaceholder ? "bg-[#1A1A1A]/5" : "bg-transparent";

  return (
    <div
      style={wrapperStyle}
      className={`relative overflow-hidden rounded-md ${wrapperBg}`}
    >
      <ProgressBar loading={status.kind === "loading"} />

      {status.kind === "loading" && (
        <span className="flex h-full w-full items-center justify-center text-[10px] italic text-[#1A1A1A]/50">
          Drawing structure...
        </span>
      )}

      {status.kind === "fallback" && fallbackUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackUrl}
          alt="Molecular structure (PubChem fallback)"
          className="h-full w-full object-contain"
        />
      )}

      {status.kind === "ok" && (
        <div
          ref={svgHostRef}
          className="h-full w-full"
          dangerouslySetInnerHTML={{ __html: status.svg }}
        />
      )}

      {status.kind === "error" && (
        <span className="flex h-full w-full items-center justify-center text-[10px] italic text-[#1A1A1A]/50">
          Couldn&apos;t render
        </span>
      )}

      {debug && status.kind === "ok" && atomMap && (
        <DebugOverlay atomMap={atomMap} />
      )}
    </div>
  );
}

function ProgressBar({ loading }: { loading: boolean }) {
  // 1px brick-red bar pinned to the top of the structure container. Pulses
  // gently while RDKit renders, fades out over 300ms once the SVG is ready.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-px overflow-hidden transition-opacity duration-300"
      style={{ opacity: loading ? 1 : 0 }}
    >
      <div className="h-full w-full animate-pulse bg-[#A8483B]" />
    </div>
  );
}

function DebugOverlay({ atomMap }: { atomMap: AtomMap }) {
  // The overlay must occupy the same content area as the structure SVG (i.e.
  // the wrapper minus its padding), and use the same viewBox + aspect-ratio
  // policy so atom coordinates align pixel-perfect with the rendered atoms.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
      style={{ padding: WRAPPER_PADDING, boxSizing: "border-box" }}
    >
      <svg
        className="h-full w-full"
        viewBox={`${atomMap.viewBoxX} ${atomMap.viewBoxY} ${atomMap.svgWidth} ${atomMap.svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {atomMap.atoms.map((a) => (
          <g key={a.index}>
            <circle
              cx={a.x}
              cy={a.y}
              r={4}
              fill="#A8483B"
              opacity={0.6}
            />
            <text
              x={a.x + 8}
              y={a.y - 2}
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#A8483B"
            >
              {a.index}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// RDKit emits each atom with a class like "atom-3". Heteroatoms render as
// <text> with the element symbol; carbons are implicit and may render as
// <path> bond endpoints, <circle> markers, or be omitted from the DOM
// altogether — versions vary. We collect every variant we can find, dedupe by
// atom index, and prefer the source with the most reliable position data:
// text > path > circle. Coordinates are in the SVG's viewBox space, which is
// the same coordinate system any future arrow overlay will use.
function extractAtomMap(svgEl: SVGSVGElement, smiles: string): AtomMap | null {
  const atomElements = svgEl.querySelectorAll<SVGGraphicsElement>(
    '[class*="atom-"]'
  );

  type Candidate = AtomData & { priority: number };
  const byIndex = new Map<number, Candidate>();

  atomElements.forEach((el) => {
    const className = el.getAttribute("class") || "";
    // Skip bond paths. RDKit annotates each bond with its endpoint atom
    // indices (class="bond-1 atom-3 atom-4"), but the bond's centroid is the
    // midpoint of the bond, not the atom position — so attributing it to an
    // atom would be wrong.
    if (/\bbond-\d+/.test(className)) return;

    const match = className.match(/atom-(\d+)/);
    if (!match) return;
    const index = parseInt(match[1], 10);
    if (!Number.isFinite(index)) return;

    const tag = el.tagName.toLowerCase();
    let x: number;
    let y: number;
    let element: string;
    let priority: number;

    try {
      if (tag === "text") {
        const bbox = el.getBBox();
        x = bbox.x + bbox.width / 2;
        y = bbox.y + bbox.height / 2;
        const text = (el.textContent || "").trim();
        element = text || "C";
        priority = 3;
      } else if (tag === "circle") {
        x = parseFloat(el.getAttribute("cx") || "0");
        y = parseFloat(el.getAttribute("cy") || "0");
        element = "C";
        priority = 1;
      } else if (tag === "path") {
        const bbox = el.getBBox();
        x = bbox.x + bbox.width / 2;
        y = bbox.y + bbox.height / 2;
        element = "C";
        priority = 2;
      } else {
        const bbox = el.getBBox();
        x = bbox.x + bbox.width / 2;
        y = bbox.y + bbox.height / 2;
        element = "C";
        priority = 0;
      }
    } catch {
      return;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const existing = byIndex.get(index);
    if (!existing || priority > existing.priority) {
      byIndex.set(index, { index, x, y, element, priority });
    }
  });

  const atoms: AtomData[] = Array.from(byIndex.values())
    .map(({ index, x, y, element }) => ({ index, x, y, element }))
    .sort((a, b) => a.index - b.index);

  // Use the SVG's CURRENT viewBox (after our 8% expansion) so atom coords and
  // the overlay's viewBox share a consistent coordinate system.
  const finalVB = svgEl.getAttribute("viewBox");
  let viewBoxX = 0;
  let viewBoxY = 0;
  let svgWidth = 0;
  let svgHeight = 0;
  if (finalVB) {
    const parts = finalVB.split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      viewBoxX = parts[0];
      viewBoxY = parts[1];
      svgWidth = parts[2];
      svgHeight = parts[3];
    }
  }

  return { atoms, viewBoxX, viewBoxY, svgWidth, svgHeight, smiles };
}
