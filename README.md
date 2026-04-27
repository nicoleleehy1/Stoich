# Stoich

**Read chemistry papers, see the molecules.**

Stoich turns chemistry papers into interactive molecular diagrams. Paste a paragraph, upload a PDF, or highlight a sentence — and Stoich extracts every compound, draws it in 2D and 3D, classifies its role in the reaction, builds the full equation with conditions and yield, and lets you search across every paper you've read with semantic vector search.

Built for [LA Hacks 2026](https://lahacks.com).

[Live site](https://stoich.vercel.app/landing) · [Devpost](https://devpost.com/) · [Demo video](#)

---

## What it does

- **Extract** every compound from any chemistry paragraph using Google Gemma 3 27B
- **Render** 2D structures via PubChem and rotatable 3D models via 3Dmol.js + Cactus
- **Classify** each compound as reactant, product, catalyst, or solvent
- **Build** the full reaction equation with temperature, pressure, time, and yield
- **Decompose** multi-step syntheses into stacked equations or a force-directed graph
- **Search** every paper you've extracted with `$vectorSearch` — type "anti-inflammatory" and find the aspirin paper from last week
- **Narrate** any reaction aloud with ElevenLabs
- **Customize** your workspace by swapping any pane to any slot
- **Annotate** with highlights and notes that persist per extraction

## Tech stack

- **Frontend**: Next.js 14 (app router), TypeScript, Tailwind CSS
- **Reasoning**: Google Gemma 3 27B via Google AI Studio
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dim)
- **Database**: MongoDB Atlas with `$vectorSearch`
- **2D structures**: PubChem REST API
- **3D structures**: 3Dmol.js + NIH Cactus (SMILES → SDF)
- **TTS**: ElevenLabs Turbo v2.5
- **PDF parsing**: pdf.js (client-side)
- **Hosting**: Vercel

## Architecture