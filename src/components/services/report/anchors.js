import { isNum } from "./formatter.js";

const toNum = (v) => Number(v);

// Turns the anchor data into a uniform structure so that we can use it for the tables and charts
// Ensures arrays start at 0 and end at the given lap times
function finalizeAnchors(points = [], lapA, lapB) {
  if (!points.length) return null;

  // Start at 0 if missing
  if (points[0].tA > 1e-9 || points[0].tB > 1e-9) {
    points.unshift({ tA: 0, tB: 0 });
  }

  // Append lap ends if provided and not already present
  const last = points[points.length - 1];
  const needEndA = isNum(lapA) && Math.abs(last.tA - lapA) > 1e-9;
  const needEndB = isNum(lapB) && Math.abs(last.tB - lapB) > 1e-9;

  if (needEndA || needEndB) {
    points.push({
      tA: isNum(lapA) ? lapA : last.tA,
      tB: isNum(lapB) ? lapB : last.tB,
    });
  }

  return points.length >= 2 ? points : null;
}

// Normalizes anchors into two aligned arrays {A:number[], B:number[]}
export function normalizeAnchors(anchorPairs = [], lapA, lapB) {
  if (!Array.isArray(anchorPairs) || anchorPairs.length < 1) return null;

  // Clean + coerce + filter
  let points = anchorPairs
    .map((p) => ({ tA: toNum(p?.tA), tB: toNum(p?.tB) }))
    .filter((p) => isNum(p.tA) && isNum(p.tB) && p.tA >= 0 && p.tB >= 0);

  if (!points.length) return null;

  // Sort by A’s time
  points.sort((a, b) => a.tA - b.tA);

  // Drop any non-monotonic duplicates
  const deduped = [];
  for (const p of points) {
    if (!deduped.length || p.tA > deduped[deduped.length - 1].tA + 1e-9) {
      deduped.push(p);
    }
  }
  points = deduped;

  // Ensure 0 start and lap end anchors
  points = finalizeAnchors(points, lapA, lapB);
  if (!points) return null;

  // Split into arrays A/B
  const A = points.map((p) => p.tA);
  const B = points.map((p) => p.tB);
  return { A, B };
}

// Builds segment stats between consecutive anchors
export function buildSegments({ A, B }) {
  const n = Math.min(A?.length || 0, B?.length || 0) - 1;
  if (!A || !B || n < 1) return null;

  const segs = [];
  let cumA = 0,
    cumB = 0,
    cumDelta = 0;

  for (let i = 0; i < n; i++) {
    const aTime = A[i + 1] - A[i];
    const bTime = B[i + 1] - B[i];
    // guard against tiny negative jitter
    const a = aTime >= 0 ? aTime : 0;
    const b = bTime >= 0 ? bTime : 0;

    const dSeg = b - a;
    cumA += a;
    cumB += b;
    cumDelta += dSeg;

    segs.push({ idx: i, aTime: a, bTime: b, cumA, cumB, dSeg, cumDelta });
  }
  return segs;
}

// Ranks segments by absolute delta; negative = B faster (gain), positive = B slower (loss)
export function rankSegments(segs = [], top = 3) {
  if (!segs.length) return { gains: [], losses: [] };

  const byAbs = (x, y) => Math.abs(y.dSeg) - Math.abs(x.dSeg);
  const gains = segs
    .filter((s) => s.dSeg < 0)
    .sort(byAbs)
    .slice(0, top);
  const losses = segs
    .filter((s) => s.dSeg > 0)
    .sort(byAbs)
    .slice(0, top);

  return { gains, losses };
}
