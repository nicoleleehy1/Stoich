"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type Compound = {
  name: string;
  iupac: string | null;
  smiles: string;
  role: string;
  one_line: string;
  image_url: string;
};

export type Conditions = {
  temperature: string | null;
  pressure: string | null;
  time: string | null;
  yield: string | null;
  notes: string | null;
};

export type Step = {
  step_number: number;
  description: string;
  compounds: Compound[];
  conditions: Conditions;
};

type NodeKind = "compound" | "reaction";
type LinkKind = "reactant" | "product" | "catalyst" | "solvent";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  label: string;
  compound?: Compound;
  step_number?: number;
  role?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  kind: LinkKind;
}

const ROLE_BORDER: Record<string, string> = {
  product: "#CFFF00",
  reactant: "#7C8BA0",
  catalyst: "#D6D3CE",
  solvent: "#D6D3CE",
  mentioned: "#D6D3CE",
};

function buildGraph(steps: Step[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const compoundMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const reactionNodes: GraphNode[] = [];

  for (const step of steps) {
    const reactionId = `rxn-${step.step_number}`;
    const reactionNode: GraphNode = {
      id: reactionId,
      kind: "reaction",
      label: `R${step.step_number}`,
      step_number: step.step_number,
    };
    reactionNodes.push(reactionNode);

    for (const c of step.compounds ?? []) {
      const key = (c.name ?? "").trim().toLowerCase();
      if (!key) continue;
      const existing = compoundMap.get(key);
      if (existing) {
        existing.role = c.role; // last role wins
      } else {
        compoundMap.set(key, {
          id: `c-${key}`,
          kind: "compound",
          label: c.name,
          compound: c,
          role: c.role,
        });
      }
      const role = (c.role ?? "").toLowerCase() as LinkKind;
      const compoundId = `c-${key}`;
      if (role === "reactant") {
        links.push({ source: compoundId, target: reactionId, kind: "reactant" });
      } else if (role === "product") {
        links.push({ source: reactionId, target: compoundId, kind: "product" });
      } else if (role === "catalyst" || role === "solvent") {
        links.push({ source: compoundId, target: reactionId, kind: role });
      }
    }
  }

  return {
    nodes: [...compoundMap.values(), ...reactionNodes],
    links,
  };
}

export default function ReactionGraph({
  steps,
  onPickCompound,
}: {
  steps: Step[];
  onPickCompound: (c: Compound) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;
    if (!steps || steps.length === 0) return;

    const { nodes, links } = buildGraph(steps);
    if (nodes.length === 0) return;

    const rect = container.getBoundingClientRect();
    let width = Math.max(rect.width, 320);
    let height = Math.max(rect.height, 240);

    const svg = d3
      .select(svgEl)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow-product")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#1A1A1A")
      .attr("opacity", 0.6);

    defs
      .append("marker")
      .attr("id", "arrow-reactant")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 14)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#1A1A1A")
      .attr("opacity", 0.6);

    const root = svg.append("g");

    const linkSel = root
      .append("g")
      .attr("stroke", "#1A1A1A")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d) =>
        d.kind === "catalyst" || d.kind === "solvent" ? "4 3" : null
      )
      .attr("marker-end", (d) =>
        d.kind === "product"
          ? "url(#arrow-product)"
          : d.kind === "reactant"
            ? "url(#arrow-reactant)"
            : null
      );

    const nodeSel = root
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", (d) => (d.kind === "compound" ? "pointer" : "grab"));

    // Reaction nodes: small black circle + white label
    const reactionGroup = nodeSel.filter((d) => d.kind === "reaction");
    reactionGroup
      .append("circle")
      .attr("r", 12)
      .attr("fill", "#1A1A1A")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 2);
    reactionGroup
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", "0.32em")
      .attr("font-size", 10)
      .attr("font-weight", 700)
      .attr("fill", "#FFFFFF")
      .attr("pointer-events", "none");

    // Compound nodes: white circle with role-color border + label below
    const compoundGroup = nodeSel.filter((d) => d.kind === "compound");
    compoundGroup
      .append("circle")
      .attr("r", 24)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) =>
        ROLE_BORDER[(d.role ?? "").toLowerCase()] ?? ROLE_BORDER.mentioned
      )
      .attr("stroke-width", 3);
    compoundGroup
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", 38)
      .attr("font-size", 11)
      .attr("fill", "#1A1A1A")
      .attr("pointer-events", "none");

    // Hover tooltip + click for compounds
    compoundGroup
      .on("mouseenter", (event: MouseEvent, d) => {
        if (!d.compound) return;
        const cRect = container.getBoundingClientRect();
        setTooltip({
          text: d.compound.one_line || d.compound.name,
          x: event.clientX - cRect.left + 12,
          y: event.clientY - cRect.top + 12,
        });
      })
      .on("mousemove", (event: MouseEvent) => {
        const cRect = container.getBoundingClientRect();
        setTooltip((t) =>
          t
            ? {
                ...t,
                x: event.clientX - cRect.left + 12,
                y: event.clientY - cRect.top + 12,
              }
            : t
        );
      })
      .on("mouseleave", () => setTooltip(null))
      .on("click", (_event: MouseEvent, d) => {
        if (d.compound) onPickCompound(d.compound);
      });

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(30))
      .on("tick", () => {
        linkSel
          .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
        nodeSel.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
      });

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(drag);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          width = cr.width;
          height = cr.height;
          svg.attr("viewBox", `0 0 ${width} ${height}`);
          simulation.force("center", d3.forceCenter(width / 2, height / 2));
          simulation.alpha(0.3).restart();
        }
      }
    });
    ro.observe(container);

    return () => {
      simulation.stop();
      ro.disconnect();
      svg.selectAll("*").remove();
    };
  }, [steps, onPickCompound]);

  if (!steps || steps.length === 0) {
    return (
      <p className="m-auto text-sm text-[#1A1A1A]/50">No reactions to graph</p>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] text-[#1A1A1A] shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-2 flex flex-col items-end gap-1 text-[9px] text-[#1A1A1A]/40">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-[#CFFF00] bg-white" />
          product
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-[#7C8BA0] bg-white" />
          reactant
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#1A1A1A]" />
          reaction
        </div>
      </div>
    </div>
  );
}
