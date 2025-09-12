// /services/mapping.js

// Clamp a number so it always stays between min and max (before 0 and past video duration)
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// Calculate how much faster or slower video B runs compared to video A between two anchor points
export function deltaRate(pointAStart, pointBStart, pointAEnd, pointBEnd) {
  // delta of video A from anchor to anchor
  const deltaA = pointAEnd - pointAStart;
  // delta of video B from anchor to anchor
  const deltaB = pointBEnd - pointBStart;

  // if the delta of video a is close or is 0 we offset it as to not divde by 0
  const safeDeltaA = Math.abs(deltaA) < 1e-9 ? 1e-9 : deltaA;

  // the rate of change between video B and A between these anchors
  return deltaB / safeDeltaA;
}

// Builds the arrays of the anchorpoints as times (video A: 10s, video B: 12s, ...)
export function buildWarp(anchorPairs) {
  // validates that the anchorpoins is an array and that it isnt empty
  if (!Array.isArray(anchorPairs) || anchorPairs.length === 0) {
    return { timesA: [], timesB: [] };
  }

  // Sorts the anchors so if the users changes or enters an anchor point later it wont break
  const sortedAnchors = anchorPairs
    .map(({ tA, tB }) => ({ timeA: +tA, timeB: +tB }))
    .sort((a, b) => a.timeA - b.timeA);

  const timesA = [];
  const timesB = [];
  let lastTimeB = 0;
  let adjustedTimeB;

  // Validates that Video B never goes backwards:  timeB < lastTimeB
  for (const { timeA, timeB } of sortedAnchors) {
    if (timeB < lastTimeB) {
      adjustedTimeB = lastTimeB;
    } else {
      adjustedTimeB = timeB;
    }
    timesA.push(timeA);
    timesB.push(adjustedTimeB);
    lastTimeB = adjustedTimeB;
  }

  return { timesA, timesB };
}

// Map tA -> tB via piecewise-linear interpolation + endpoint extrapolation
export function mapAtoB(anchorPoints, timeA) {
  // Gets the anchor time points from each video
  const timesA = anchorPoints?.timesA;
  const timesB = anchorPoints?.timesB;

  // Validating if the anchors are arrays, the same number of anchors, and more than 2
  if (
    !Array.isArray(timesA) ||
    !Array.isArray(timesB) ||
    timesA.length !== timesB.length ||
    timesA.length < 2
  ) {
    return timeA; // identity fallback
  }

  const last = timesA.length - 1;

  // First and last anchors will always be set to the start and end of video
  if (timeA <= timesA[0]) return timesB[0];
  if (timeA >= timesA[last]) return timesB[last];

  // First and last anchors
  let leftAnchor = 0;
  let rightAnchor = last;

  // While loop while theres at least one anchor between the start and end
  while (rightAnchor - leftAnchor > 1) {
    // The half way from start to end
    const midAnchor = (leftAnchor + rightAnchor) >> 1;

    // Searching for the closest anchor with the given time
    if (timeA >= timesA[midAnchor]) {
      leftAnchor = midAnchor;
    } else {
      rightAnchor = midAnchor;
    }
  }

  // Getting two anchor points from video A
  const startTimeA = timesA[leftAnchor];
  const endTimeA = timesA[leftAnchor + 1];
  // Getting two anchor points from video B
  const startTimeB = timesB[leftAnchor];
  const endTimeB = timesB[leftAnchor + 1];

  // How long this segment lasts in A
  const segmentLengthA = endTimeA - startTimeA;

  // The rate of far has timeA moved between the start and end
  const progress =
    Math.abs(segmentLengthA) < 1e-9 ? 0 : (timeA - startTimeA) / segmentLengthA;

  // Using the same rate on video b to get the mapped tiem
  return startTimeB + progress * (endTimeB - startTimeB);
}
