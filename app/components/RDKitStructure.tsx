"use client";

import { useEffect, useRef, useState } from "react";
import { getRDKit, type RDKitMol } from "../lib/rdkit";

type Props = {
  smiles: string;
  width?: number;
  height?: number;
  fallbackUrl?: string;
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
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Hold the live mol on the closure so the cleanup function can delete it
    // even if the async work was interrupted by an unmount or a smiles change
    // before get_svg finished. mol.delete() frees WASM memory that JS GC won't.
    let activeMol: RDKitMol | null = null;
    setStatus({ kind: "loading" });

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
  }, [status]);

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
        <span
          className="flex h-full w-full items-center justify-center text-[10px] italic text-[#1A1A1A]/50"
        >
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
