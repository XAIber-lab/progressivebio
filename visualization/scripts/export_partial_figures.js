const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const partialRoot = path.join(repoRoot, "partial");
const outputRoot = path.join(repoRoot, "visualization", "figures");

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

function meanPerStairOverlap(referenceStairs, currentStairs) {
  if (referenceStairs.length === 0) return currentStairs.length === 0 ? 1 : 0;
  if (currentStairs.length === 0) return 0;

  const currentEdgeSets = currentStairs.map(stairToEdgeSet);
  let overlapSum = 0;

  for (const referenceStair of referenceStairs) {
    const referenceEdgeSet = stairToEdgeSet(referenceStair);
    let bestOverlap = 0;

    for (const currentEdgeSet of currentEdgeSets) {
      bestOverlap = Math.max(bestOverlap, jaccardSimilarity(referenceEdgeSet, currentEdgeSet));
    }

    overlapSum += bestOverlap;
  }

  return overlapSum / referenceStairs.length;
}

function kendallTauFromOrderings(referenceOrdering, currentOrdering) {
  const referenceRanks = new Map(
    referenceOrdering.map((nodeId, index) => [String(nodeId), index]),
  );
  const commonNodes = currentOrdering.map(String).filter((nodeId) => referenceRanks.has(nodeId));

  if (commonNodes.length < 2) return null;

  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < commonNodes.length; i++) {
    for (let j = i + 1; j < commonNodes.length; j++) {
      const refDiff =
        referenceRanks.get(commonNodes[i]) - referenceRanks.get(commonNodes[j]);
      if (refDiff < 0) concordant++;
      else if (refDiff > 0) discordant++;
    }
  }

  const totalPairs = concordant + discordant;
  if (totalPairs === 0) return null;

  return (concordant - discordant) / totalPairs;
}

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

function getReferenceStairColors(referenceStairs) {
  return referenceStairs.map((_, index) => stairPalette[index % stairPalette.length]);
}

function getBestReferenceMatchIndex(referenceStairs, currentStair) {
  const currentEdgeSet = stairToEdgeSet(currentStair);
  let bestMatchIndex = -1;
  let bestOverlap = 0;

  for (let i = 0; i < referenceStairs.length; i++) {
    const overlap = jaccardSimilarity(stairToEdgeSet(referenceStairs[i]), currentEdgeSet);
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

function renderFigure({
  graph,
  result,
  newEdgeIds,
  stairColors,
}) {
  const svgwidth = 500;
  const svgheight = 500;
  const padding = { left: 30, right: 20, top: 20, bottom: 50 };

  const nodeordering = graph.nodes.map((n) => n.id);
  const edgeordering = graph.links.map((e) => e.id);
  const node_h_dict = {};
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgwidth}" height="${svgheight}" viewBox="0 0 ${svgwidth} ${svgheight}">`,
  );

  for (let i = 0; i < nodeordering.length; i++) {
    const line_h = padding.top + ((svgheight - padding.top - padding.bottom) / nodeordering.length) * i;
    node_h_dict[nodeordering[i]] = line_h;

    parts.push(
      `<line x1="${padding.left}" x2="${svgwidth - padding.left}" y1="${line_h}" y2="${line_h}" stroke="#eeeeee" stroke-width="3" stroke-linecap="round"/>`,
      `<text x="${padding.left - 10}" y="${line_h}" text-anchor="end" dominant-baseline="middle" font-family="Arial" font-size="12" fill="lightgray">${escapeXml(nodeordering[i])}</text>`,
    );
  }

  for (let i = 0; i < edgeordering.length; i++) {
    const edgeId = edgeordering[i];
    const line_x = padding.left + ((svgwidth - padding.left - padding.right) / edgeordering.length) * i;
    const edge = graph.links.find((e) => e.id === edgeId);
    const topnode_h = node_h_dict[edge.source];
    const bottomnode_h = node_h_dict[edge.target];
    const stairIndices = result.stairs
      .map((stair, index) => (stair.includes(edgeId) ? index : -1))
      .filter((index) => index !== -1);

    let underlayColor = "#8A94A6";
    let overlayColor = "#8A94A6";

    if (stairIndices.length > 0) {
      const primaryBase = stairColors[stairIndices[0]] || "#5C677D";
      const secondaryBase =
        stairIndices.length > 1
          ? stairColors[stairIndices[1]] || primaryBase
          : primaryBase;
      underlayColor = adjustColor(primaryBase, -0.22);
      overlayColor = adjustColor(secondaryBase, 0.18);

      parts.push(
        `<line x1="${line_x}" x2="${line_x}" y1="${topnode_h}" y2="${bottomnode_h}" stroke="${underlayColor}" stroke-width="8" stroke-linecap="round"/>`,
      );
    }

    parts.push(
      `<line x1="${line_x}" x2="${line_x}" y1="${topnode_h}" y2="${bottomnode_h}" stroke="${overlayColor}" stroke-width="8" stroke-linecap="round"${stairIndices.length === 2 ? ` stroke-dasharray="6,20"` : ""}/>`,
    );

    if (newEdgeIds.has(edgeId)) {
      parts.push(
        `<circle cx="${line_x}" cy="${svgheight - padding.bottom / 2}" r="8" fill="steelblue"/>`,
      );
    }
  }

  parts.push(`</svg>`);

  return parts.join("");
}

function exportGraphFigures(graphName) {
  const context = vm.createContext({ console });
  loadScript("visualization/js/helpers/stairsHelper.js", context);
  loadScript("visualization/js/helpers/runwayHelper.js", context);
  loadScript("visualization/js/analyzeGraph.js", context);
  const analyzeGraph = context.analyzeGraph;

  const modes = [
    "betweeness",
    "closeness",
    "degree",
    "pagerank",
    "random",
    "rmc",
    "spectral",
  ];

  const graphOutputDir = path.join(outputRoot, graphName);
  fs.mkdirSync(graphOutputDir, { recursive: true });

  const summary = [];

  for (const mode of modes) {
    const modeDir = path.join(partialRoot, graphName, mode);
    if (!fs.existsSync(modeDir)) continue;

    const finalGraph = JSON.parse(
      fs.readFileSync(path.join(modeDir, "iteration10.json"), "utf8"),
    );
    const finalNodeOrdering = finalGraph.nodes.map((n) => n.id);
    const finalResult = analyzeGraph(finalGraph.nodes, finalGraph.links);
    const finalStairs = (finalResult.stairs || []).map((stair) => stair.map(String));
    const finalStairColors = getReferenceStairColors(finalStairs);

    let previousEdgeIds = new Set();

    for (let iteration = 1; iteration <= 10; iteration++) {
      const graph = JSON.parse(
        fs.readFileSync(path.join(modeDir, `iteration${iteration}.json`), "utf8"),
      );

      const nodeordering = graph.nodes.map((n) => n.id);
      const edgeordering = graph.links.map((e) => e.id);
      const result = analyzeGraph(graph.nodes, graph.links);
      const currentStairColors = getCurrentStairColors(
        finalStairs,
        (result.stairs || []).map((stair) => stair.map(String)),
        finalStairColors,
      );
      const newEdgeIds = new Set(edgeordering.filter((edgeId) => !previousEdgeIds.has(edgeId)));
      const totalStaircaseQuality = result.stairQualities
        .slice(0, -1)
        .map((s) => Math.round(s[0] * 100) / 100)
        .reduce((a, b) => a + b, 0);
      const kendallTau = kendallTauFromOrderings(finalNodeOrdering, nodeordering);
      const stairOverlap = meanPerStairOverlap(
        finalStairs,
        (result.stairs || []).map((stair) => stair.map(String)),
      );

      const svg = renderFigure({
        graph,
        result,
        newEdgeIds,
        stairColors: currentStairColors,
      });

      const basename = `${mode}_iteration${iteration}`;
      const outPath = path.join(graphOutputDir, `${basename}.svg`);
      fs.writeFileSync(outPath, svg);

      summary.push({
        mode,
        iteration,
        tau: kendallTau === null ? null : Number(kendallTau.toFixed(2)),
        overlap: Number(stairOverlap.toFixed(2)),
        svg: path.relative(repoRoot, outPath),
      });

      previousEdgeIds = new Set(edgeordering);
    }
  }

  return summary;
}

const graphName = process.argv[2];
if (!graphName) {
  console.error("Usage: node visualization/scripts/export_partial_figures.js <graphName>");
  process.exit(1);
}

const summary = exportGraphFigures(graphName);
console.log(JSON.stringify(summary, null, 2));
