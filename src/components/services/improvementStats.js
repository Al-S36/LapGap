const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Nomralizes and sorts the samples
function normalizeSamples(samples = []) {
  return samples
    .filter(
      (sample) => Number.isFinite(sample?.p) && Number.isFinite(sample?.delta)
    )
    .map((sample) => ({ p: clamp(sample.p, 0, 1), delta: sample.delta }))
    .sort((a, b) => a.p - b.p);
}

// Calculating the lead percentage usinng samples to see how much a is ahead of b
export function computeLeadPercentA(samples = []) {
  const normalized = normalizeSamples(samples);
  if (!normalized.length) return 0;
  const aheadCount = normalized.filter((point) => point.delta > 0).length;
  return Math.round((aheadCount / normalized.length) * 100);
}

// Calcilating consistancy by seeing how similar the laps are
export function computeConsistencyScore(samples = []) {
  const normalized = normalizeSamples(samples);
  if (normalized.length < 3) return 0;

  const slopes = [];
  for (let i = 1; i < normalized.length; i++) {
    const deltaProgress = normalized[i].p - normalized[i - 1].p;
    if (deltaProgress <= 0) continue;
    const deltaDelta = normalized[i].delta - normalized[i - 1].delta;
    slopes.push(Math.abs(deltaDelta / deltaProgress));
  }
  if (!slopes.length) return 0;

  slopes.sort((a, b) => a - b);
  const cutoff = Math.floor(slopes.length * 0.9);
  const trimmed = slopes.slice(0, Math.max(cutoff, 1));
  const meanAbsSlope =
    trimmed.reduce((sum, slope) => sum + slope, 0) / trimmed.length;

  const score = 100 - 12 * meanAbsSlope;
  return Math.round(clamp(score, 0, 100));
}

// Calculating the best lap using the anchor points
export function computeTheoreticalBestLapFromAnchors(
  lapTimeA = 0,
  lapTimeB = 0,
  anchorPairs = []
) {
  if (!Array.isArray(anchorPairs) || anchorPairs.length < 2) {
    return Math.min(lapTimeA || 0, lapTimeB || 0);
  }
  const points = anchorPairs
    .map((pair) => ({ tA: +pair.tA || 0, tB: +pair.tB || 0 }))
    .sort((a, b) => a.tA - b.tA);

  if (points.length === 0 || points[0].tA > 1e-3)
    points.unshift({ tA: 0, tB: 0 });
  const lastPoint = points[points.length - 1];
  if (Math.abs(lastPoint.tA - (lapTimeA || 0)) > 1e-3)
    points.push({ tA: lapTimeA || 0, tB: lapTimeB || 0 });

  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const deltaA = points[i + 1].tA - points[i].tA;
    const deltaB = points[i + 1].tB - points[i].tB;
    if (deltaA >= 0 && deltaB >= 0) sum += Math.min(deltaA, deltaB);
  }
  return sum;
}

// Fallback to calculate theoretical best if the anchors havent been placed
export function computeTheoreticalBestLap(
  lapTimeA = 0,
  lapTimeB = 0,
  deltaSamples = [],
  bins = 60
) {
  if (!Number.isFinite(lapTimeA)) lapTimeA = 0;
  if (!Number.isFinite(lapTimeB)) lapTimeB = 0;
  if (lapTimeA <= 0 && lapTimeB <= 0) return 0;

  const normalized = normalizeSamples(deltaSamples);
  if (normalized.length < 2) return Math.min(lapTimeA, lapTimeB);

  // Build slope segments between sample points
  const segments = [];
  for (let i = 1; i < normalized.length; i++) {
    const progressStart = normalized[i - 1].p,
      progressEnd = normalized[i].p;
    const deltaStart = normalized[i - 1].delta,
      deltaEnd = normalized[i].delta;
    const progressSpan = progressEnd - progressStart;
    if (progressSpan > 0) {
      segments.push({
        p0: progressStart,
        p1: progressEnd,
        slope: (deltaEnd - deltaStart) / progressSpan,
      });
    }
  }
  if (!segments.length) return Math.min(lapTimeA, lapTimeB);

  // Divide lap into equal bins (like sectors, default 60)
  const step = 1 / bins;

  // If A is faster overall, integrate in A-space
  if (lapTimeA <= lapTimeB) {
    let hybridLap = 0;
    for (let i = 0; i < bins; i++) {
      const binStart = i * step,
        binEnd = (i + 1) * step;

      // Accumulate slopes from overlapping segments
      let slopeSum = 0,
        weight = 0;
      for (const segment of segments) {
        const overlapStart = Math.max(binStart, segment.p0),
          overlapEnd = Math.min(binEnd, segment.p1);
        const overlapWidth = overlapEnd - overlapStart;
        if (overlapWidth > 0) {
          slopeSum += segment.slope * overlapWidth;
          weight += overlapWidth;
        }
      }

      // Average slope of this bin (delta/time gradient)
      const meanSlope = weight ? slopeSum / weight : 0;

      // Use whichever lap density (A vs adjusted B) is faster for this bin
      const densityA = lapTimeA;
      const densityB = clamp(lapTimeA + meanSlope, 0, lapTimeA * 3);

      // Add best choice for this bin to the hybrid lap
      hybridLap += Math.min(densityA, densityB) * step;
    }
    return clamp(hybridLap, 0, lapTimeA);
  }

  // Else transform samples into B-space
  const transformedSamples = normalized
    .map((point) => {
      const timeA = point.p * lapTimeA;
      const timeB = timeA + point.delta;
      const progressB = lapTimeB > 0 ? clamp(timeB / lapTimeB, 0, 1) : 0;
      const deltaBA = -point.delta; // reframe delta relative to B
      return { p: progressB, delta: deltaBA };
    })
    .sort((a, b) => a.p - b.p);

  // Build slope segments in B-space
  const segmentsB = [];
  for (let i = 1; i < transformedSamples.length; i++) {
    const progressStart = transformedSamples[i - 1].p,
      progressEnd = transformedSamples[i].p;
    const deltaStart = transformedSamples[i - 1].delta,
      deltaEnd = transformedSamples[i].delta;
    const progressSpan = progressEnd - progressStart;
    if (progressSpan > 0) {
      segmentsB.push({
        p0: progressStart,
        p1: progressEnd,
        slope: (deltaEnd - deltaStart) / progressSpan,
      });
    }
  }
  if (!segmentsB.length) return Math.min(lapTimeA, lapTimeB);

  // Integrate in B-space bins
  let hybridLap = 0;
  for (let i = 0; i < bins; i++) {
    const binStart = i * step,
      binEnd = (i + 1) * step;

    // Accumulate slopes from overlapping segments
    let slopeSum = 0,
      weight = 0;
    for (const segment of segmentsB) {
      const overlapStart = Math.max(binStart, segment.p0),
        overlapEnd = Math.min(binEnd, segment.p1);
      const overlapWidth = overlapEnd - overlapStart;
      if (overlapWidth > 0) {
        slopeSum += segment.slope * overlapWidth;
        weight += overlapWidth;
      }
    }

    // Average slope of this bin (delta/time gradient in B-space)
    const meanSlope = weight ? slopeSum / weight : 0;

    // Use whichever lap density (B vs adjusted A) is faster for this bin
    const densityB = lapTimeB;
    const densityA = clamp(lapTimeB + meanSlope, 0, lapTimeB * 3);

    // Add best choice for this bin to the hybrid lap
    hybridLap += Math.min(densityA, densityB) * step;
  }
  return clamp(hybridLap, 0, lapTimeB);
}

// Always try to use anchors first as its more accurate
export function computeTheoreticalBestLapPreferred(
  lapTimeA,
  lapTimeB,
  deltaSamples,
  bins,
  anchorPairs
) {
  if (Array.isArray(anchorPairs) && anchorPairs.length >= 2) {
    return computeTheoreticalBestLapFromAnchors(
      lapTimeA,
      lapTimeB,
      anchorPairs
    );
  }
  return computeTheoreticalBestLap(lapTimeA, lapTimeB, deltaSamples, bins);
}
