"use client";

import { useEffect, useRef, useState } from "react";

type Viewer = {
  addModel: (data: string, format: string) => void;
  setStyle: (sel: object, style: object) => void;
  zoomTo: () => void;
  render: () => void;
  spin: (axis: string, speed: number) => void;
  clear: () => void;
};

type ThreeDmol = {
  createViewer: (
    el: HTMLElement,
    config: { backgroundColor?: string }
  ) => Viewer;
};

declare global {
  interface Window {
    $3Dmol?: ThreeDmol;
  }
}

export default function Mol3D({
  smiles,
  height = 280,
  autoSpin = true,
}: {
  smiles: string;
  height?: number;
  autoSpin?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [sdf, setSdf] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSdf(null);
    setError(false);
    (async () => {
      try {
        const url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(
          smiles
        )}/file?format=sdf`;
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const text = await res.text();
        if (!text || text.trim().length === 0) {
          if (!cancelled) setError(true);
          return;
        }
        if (!cancelled) setSdf(text);
      } catch (e) {
        console.error("cactus sdf fetch failed", e);
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [smiles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.$3Dmol) {
      setViewerReady(true);
      return;
    }
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      if (window.$3Dmol) {
        setViewerReady(true);
        clearInterval(interval);
      } else if (count >= 30) {
        clearInterval(interval);
        setError(true);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sdf || !viewerReady) return;
    const el = containerRef.current;
    if (!el || !window.$3Dmol) return;

    try {
      const viewer = window.$3Dmol.createViewer(el, {
        backgroundColor: "white",
      });
      viewer.addModel(sdf, "sdf");
      viewer.setStyle(
        {},
        { stick: { radius: 0.15 }, sphere: { scale: 0.25 } }
      );
      viewer.zoomTo();
      viewer.render();
      if (autoSpin) viewer.spin("y", 0.5);
      viewerRef.current = viewer;
    } catch (e) {
      console.error("3Dmol init failed", e);
      setError(true);
    }

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.clear();
        } catch (e) {
          console.error(e);
        }
        viewerRef.current = null;
      }
    };
  }, [sdf, viewerReady, autoSpin]);

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-xl border border-stone-200 bg-[#1A1A1A]/5 text-sm text-[#1A1A1A]/50"
      >
        3D structure unavailable
      </div>
    );
  }

  if (!sdf || !viewerReady) {
    return (
      <div
        style={{ height }}
        className="flex w-full animate-pulse items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-[#1A1A1A]/50"
      >
        Generating 3D structure...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="relative w-full overflow-hidden rounded-xl border border-stone-200 bg-white"
    />
  );
}
