const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const partialRoot = path.join(repoRoot, "partial");
const outputRoot = path.join(repoRoot, "visualization", "animations_smooth");

const DEFAULT_GRAPHS = [
  "18470775",
  "18681592",
  "barabasi_albert_N50_E49",
  "hybrid_WS_star_N10_E33",
];

const MODES = [
  "betweeness",
  "closeness",
  "degree",
  "pagerank",
  "random",
  "rmc",
  "spectral",
];

const TWEEN_STEPS = 5;
const FINAL_HOLD_FRAMES = 6;

function loadScript(relPath, context) {
  const fullPath = path.join(repoRoot, relPath);
  const code = fs.readFileSync(fullPath, "utf8");
  vm.runInContext(code, context, { filename: relPath });
}

function stairToEdgeSet(stair) {
  return new Set(stair.map(String));
}

function jaccardSimilarity(setA, setB) {
  let intersectionSize = 0;
  for (const value of setA) {
    if (setB.has(value)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function getReferenceStairColors(referenceStairs) {
  const stairPalette = [
    "#4E79A7",
    "#F28E2B",
    "#E15759",
    "#76B7B2",
    "#59A14F",
    "#EDC948",
    "#B07AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AC",
    "#86BCB6",
    "#D37295",
  ];

  return referenceStairs.map((_, index) => stairPalette[index % stairPalette.length]);
}

function getBestReferenceMatchIndex(referenceStairs, currentStair) {
  const currentEdgeSet = stairToEdgeSet(currentStair);
  let bestMatchIndex = -1;
  let bestOverlap = 0;

  for (let i = 0; i < referenceStairs.length; i++) {
    const overlap = jaccardSimilarity(
      stairToEdgeSet(referenceStairs[i]),
      currentEdgeSet,
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatchIndex = i;
    }
  }

  return { bestMatchIndex, bestOverlap };
}

function getCurrentStairColors(referenceStairs, currentStairs, referenceColors) {
  if (currentStairs.length === 0) return [];
  if (referenceStairs.length === 0) return currentStairs.map(() => "#5C677D");

  const assignments = currentStairs.map((currentStair, currentIndex) => {
    const match = getBestReferenceMatchIndex(referenceStairs, currentStair);
    return {
      currentIndex,
      referenceIndex: match.bestMatchIndex,
      overlap: match.bestOverlap,
    };
  });

  assignments.sort((a, b) => b.overlap - a.overlap);

  const currentColors = new Array(currentStairs.length).fill("#5C677D");
  const usedCurrent = new Set();
  const usedReference = new Set();

  for (const assignment of assignments) {
    if (assignment.referenceIndex === -1 || assignment.overlap === 0) continue;
    if (usedCurrent.has(assignment.currentIndex) || usedReference.has(assignment.referenceIndex)) {
      continue;
    }

    currentColors[assignment.currentIndex] = referenceColors[assignment.referenceIndex];
    usedCurrent.add(assignment.currentIndex);
    usedReference.add(assignment.referenceIndex);
  }

  for (const assignment of assignments) {
    if (usedCurrent.has(assignment.currentIndex)) continue;
    if (assignment.referenceIndex === -1 || assignment.overlap === 0) continue;

    currentColors[assignment.currentIndex] = referenceColors[assignment.referenceIndex];
    usedCurrent.add(assignment.currentIndex);
  }

  return currentColors;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function adjustColor(hexColor, factor) {
  const hex = hexColor.replace("#", "");
  const pairs = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
  const adjusted = pairs.map((pair) => {
    const channel = parseInt(pair, 16);
    const next = factor >= 0
      ? channel + (255 - channel) * factor
      : channel * (1 + factor);
    return Math.round(clamp(next, 0, 255))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${adjusted.join("")}`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeCubicInOut(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getStairPairColors(stairIndices, stairColors) {
  const staircaseColor1 = "#F9D466";
  const staircaseColor2 = "#f7a222";

  if (!stairIndices.length) return ["#ccc", "#ccc"];

  if (!stairColors || !stairColors.length) {
    const baseIndex = stairIndices[0];
    if (baseIndex % 2 === 0) return [staircaseColor2, staircaseColor1];
    return [staircaseColor1, staircaseColor2];
  }

  const primaryBase = stairColors[stairIndices[0]] || "#8A94A6";
  const secondaryBase =
    stairIndices.length > 1 ? (stairColors[stairIndices[1]] || primaryBase) : primaryBase;

  return [
    adjustColor(primaryBase, -0.22),
    adjustColor(secondaryBase, 0.18),
  ];
}

function computeLayout(frame) {
  const svgwidth = 500;
  const svgheight = 500;
  const padding = { left: 30, right: 20, top: 20, bottom: 50 };
  const numnodes = Math.max(frame.graph.nodes.length, 1);
  const numedges = Math.max(frame.graph.links.length, 1);
  const nodePositions = new Map();
  const edgeById = new Map(frame.graph.links.map((edge) => [String(edge.id), edge]));

  const nodes = frame.nodeordering.map((nodeId, index) => {
    const y =
      padding.top +
      ((svgheight - padding.top - padding.bottom) / numnodes) * index;
    const key = String(nodeId);
    nodePositions.set(key, y);
    return { id: key, y };
  });

  const edges = frame.edgeordering.map((edgeId, index) => {
    const key = String(edgeId);
    const edge = edgeById.get(key);
    const x =
      padding.left +
      ((svgwidth - padding.left - padding.right) / numedges) * index;
    const stairIndices = (frame.result.stairs || [])
      .map((stair, stairIndex) => (stair.map(String).includes(key) ? stairIndex : -1))
      .filter((stairIndex) => stairIndex !== -1);
    const [underlayColor, overlayColor] = getStairPairColors(
      stairIndices,
      frame.currentStairColors,
    );

    return {
      id: key,
      x,
      y1: nodePositions.get(String(edge.source)),
      y2: nodePositions.get(String(edge.target)),
      hasUnderlay: stairIndices.length > 0,
      underlayColor,
      overlayColor,
      dasharray: stairIndices.length === 2 ? "6,20" : "none",
      isNew: frame.newEdgeIds.has(key),
    };
  });

  return {
    svgwidth,
    svgheight,
    padding,
    nodeMap: new Map(nodes.map((node) => [node.id, node])),
    edgeMap: new Map(edges.map((edge) => [edge.id, edge])),
  };
}

function interpolateLayout(startLayout, endLayout, t) {
  const eased = easeCubicInOut(t);
  const nodes = [];
  const edges = [];
  const dots = [];

  const nodeIds = new Set([
    ...startLayout.nodeMap.keys(),
    ...endLayout.nodeMap.keys(),
  ]);

  for (const nodeId of nodeIds) {
    const startNode = startLayout.nodeMap.get(nodeId);
    const endNode = endLayout.nodeMap.get(nodeId);
    const baseY = (startNode || endNode).y;
    const y = lerp(startNode ? startNode.y : baseY, endNode ? endNode.y : baseY, eased);
    const opacity = startNode && endNode ? 1 : (startNode ? 1 - eased : eased);
    nodes.push({ id: nodeId, y, opacity });
  }

  const edgeIds = new Set([
    ...startLayout.edgeMap.keys(),
    ...endLayout.edgeMap.keys(),
  ]);

  for (const edgeId of edgeIds) {
    const startEdge = startLayout.edgeMap.get(edgeId);
    const endEdge = endLayout.edgeMap.get(edgeId);
    const baseEdge = startEdge || endEdge;
    const x = lerp(startEdge ? startEdge.x : baseEdge.x, endEdge ? endEdge.x : baseEdge.x, eased);
    const y1 = lerp(startEdge ? startEdge.y1 : baseEdge.y1, endEdge ? endEdge.y1 : baseEdge.y1, eased);
    const y2 = lerp(startEdge ? startEdge.y2 : baseEdge.y2, endEdge ? endEdge.y2 : baseEdge.y2, eased);
    const opacity = startEdge && endEdge ? 1 : (startEdge ? 1 - eased : eased);
    const edge = {
      id: edgeId,
      x,
      y1,
      y2,
      opacity,
      hasUnderlay: endEdge ? endEdge.hasUnderlay : startEdge.hasUnderlay,
      underlayColor: endEdge ? endEdge.underlayColor : startEdge.underlayColor,
      overlayColor: endEdge ? endEdge.overlayColor : startEdge.overlayColor,
      dasharray: endEdge ? endEdge.dasharray : startEdge.dasharray,
    };
    edges.push(edge);

    const startDot = startEdge && startEdge.isNew;
    const endDot = endEdge && endEdge.isNew;
    if (startDot || endDot) {
      dots.push({
        id: edgeId,
        x,
        opacity: startDot && endDot ? 1 : (startDot ? 1 - eased : eased),
      });
    }
  }

  return {
    svgwidth: startLayout.svgwidth,
    svgheight: startLayout.svgheight,
    padding: startLayout.padding,
    nodes,
    edges,
    dots,
  };
}

function renderInterpolatedSvg(layout) {
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.svgwidth}" height="${layout.svgheight}" viewBox="0 0 ${layout.svgwidth} ${layout.svgheight}">`,
  );

  for (const node of layout.nodes) {
    parts.push(
      `<line x1="${layout.padding.left}" x2="${layout.svgwidth - layout.padding.left}" y1="${node.y}" y2="${node.y}" stroke="#eeeeee" stroke-width="3" stroke-linecap="round" opacity="${node.opacity}"/>`,
      `<text x="${layout.padding.left - 10}" y="${node.y}" text-anchor="end" dominant-baseline="middle" font-family="Arial" font-size="12" fill="lightgray" opacity="${node.opacity}">${escapeXml(node.id)}</text>`,
    );
  }

  for (const edge of layout.edges) {
    if (edge.hasUnderlay) {
      parts.push(
        `<line x1="${edge.x}" x2="${edge.x}" y1="${edge.y1}" y2="${edge.y2}" stroke="${edge.underlayColor}" stroke-width="8" stroke-linecap="round" opacity="${edge.opacity}"/>`,
      );
    }

    parts.push(
      `<line x1="${edge.x}" x2="${edge.x}" y1="${edge.y1}" y2="${edge.y2}" stroke="${edge.overlayColor}" stroke-width="8" stroke-linecap="round"${edge.dasharray === "none" ? "" : ` stroke-dasharray="${edge.dasharray}"`} opacity="${edge.opacity}"/>`,
    );
  }

  for (const dot of layout.dots) {
    parts.push(
      `<circle cx="${dot.x}" cy="${layout.svgheight - layout.padding.bottom / 2}" r="8" fill="steelblue" opacity="${dot.opacity}"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

function loadFrame(analyzeGraph, graphName, mode, iteration, previousEdgeIds, finalStairs, finalStairColors) {
  const graph = JSON.parse(
    fs.readFileSync(
      path.join(partialRoot, graphName, mode, `iteration${iteration}.json`),
      "utf8",
    ),
  );
  const nodeordering = graph.nodes.map((node) => node.id);
  const edgeordering = graph.links.map((edge) => String(edge.id));
  const result = analyzeGraph(graph.nodes, graph.links);
  const currentStairColors = getCurrentStairColors(
    finalStairs,
    (result.stairs || []).map((stair) => stair.map(String)),
    finalStairColors,
  );
  const newEdgeIds = new Set(edgeordering.filter((edgeId) => !previousEdgeIds.has(edgeId)));

  return {
    graph,
    nodeordering,
    edgeordering,
    result,
    currentStairColors,
    newEdgeIds,
  };
}

function exportGraph(graphName) {
  const context = vm.createContext({ console });
  loadScript("visualization/js/helpers/stairsHelper.js", context);
  loadScript("visualization/js/helpers/runwayHelper.js", context);
  loadScript("visualization/js/analyzeGraph.js", context);
  const analyzeGraph = context.analyzeGraph;

  const graphOutputDir = path.join(outputRoot, graphName);
  fs.mkdirSync(graphOutputDir, { recursive: true });

  for (const mode of MODES) {
    const modeDir = path.join(partialRoot, graphName, mode);
    if (!fs.existsSync(modeDir)) continue;

    const finalGraph = JSON.parse(
      fs.readFileSync(path.join(modeDir, "iteration10.json"), "utf8"),
    );
    const finalResult = analyzeGraph(finalGraph.nodes, finalGraph.links);
    const finalStairs = (finalResult.stairs || []).map((stair) => stair.map(String));
    const finalStairColors = getReferenceStairColors(finalStairs);

    const frameDir = path.join(graphOutputDir, `.${mode}_frames`);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });

    let previousEdgeIds = new Set();
    const frames = [];
    for (let iteration = 1; iteration <= 10; iteration++) {
      const frame = loadFrame(
        analyzeGraph,
        graphName,
        mode,
        iteration,
        previousEdgeIds,
        finalStairs,
        finalStairColors,
      );
      frames.push(frame);
      previousEdgeIds = new Set(frame.edgeordering);
    }

    const layouts = frames.map(computeLayout);
    let frameIndex = 0;

    const firstSvg = renderInterpolatedSvg(interpolateLayout(layouts[0], layouts[0], 1));
    fs.writeFileSync(path.join(frameDir, `${String(frameIndex).padStart(3, "0")}.svg`), firstSvg);
    frameIndex += 1;

    for (let i = 0; i < layouts.length - 1; i++) {
      for (let step = 1; step <= TWEEN_STEPS; step++) {
        const t = step / TWEEN_STEPS;
        const svg = renderInterpolatedSvg(interpolateLayout(layouts[i], layouts[i + 1], t));
        fs.writeFileSync(
          path.join(frameDir, `${String(frameIndex).padStart(3, "0")}.svg`),
          svg,
        );
        frameIndex += 1;
      }
    }

    const finalSvg = renderInterpolatedSvg(interpolateLayout(layouts[layouts.length - 1], layouts[layouts.length - 1], 1));
    for (let i = 0; i < FINAL_HOLD_FRAMES; i++) {
      fs.writeFileSync(
        path.join(frameDir, `${String(frameIndex).padStart(3, "0")}.svg`),
        finalSvg,
      );
      frameIndex += 1;
    }

    console.log(`Exported tween frames for ${graphName}/${mode}`);
  }
}

const graphNames = process.argv.slice(2);
const targets = graphNames.length ? graphNames : DEFAULT_GRAPHS;

for (const graphName of targets) {
  exportGraph(graphName);
}
