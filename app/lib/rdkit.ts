// RDKit-JS singleton loader.
//
// RDKit-JS is a WebAssembly port of RDKit (~2.5MB WASM blob + JS shim).
// We load it lazily from a CDN the first time any component asks for it,
// then cache the resolved module so subsequent callers get it for free.
// A module-level loadingPromise prevents double-loading when components
// mount/unmount rapidly (StrictMode, fast navigation, etc).

export type RDKitMol = {
  get_svg: (width?: number, height?: number) => string;
  get_svg_with_highlights: (details: string) => string;
  set_new_coords?: (canonicalize?: boolean) => boolean;
  delete: () => void;
};

export type RDKitModule = {
  get_mol: (smiles: string) => RDKitMol | null;
};

declare global {
  interface Window {
    initRDKitModule?: () => Promise<RDKitModule>;
    RDKit?: RDKitModule;
  }
}

const CDN_URL = "https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js";

let cached: RDKitModule | null = null;
let loadingPromise: Promise<RDKitModule> | null = null;

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CDN_URL}"]`
    );
    if (existing) {
      if (window.initRDKitModule) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("RDKit script failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("RDKit script failed to load"));
    document.head.appendChild(script);
  });
}

export async function getRDKit(): Promise<RDKitModule> {
  if (typeof window === "undefined") {
    throw new Error("RDKit can only be loaded in the browser");
  }
  if (cached) return cached;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await injectScript();
    if (!window.initRDKitModule) {
      throw new Error("initRDKitModule not found on window after script load");
    }
    const rdkit = await window.initRDKitModule();
    cached = rdkit;
    window.RDKit = rdkit;
    return rdkit;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}
