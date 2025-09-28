// Generates the Cumulative Delta by Anchor (B - A) graph
// Adds in a axis titles, legend, as well as gain/loss colored line segments for ease of use
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isNum = (value) => Number.isFinite(value);

// Gets the screen size and restrains the code from generating a huge image
const getScale = () => {
  if (typeof window === "undefined") return 2;
  const dpr = window.devicePixelRatio || 1;
  return clamp(dpr, 1, 3);
};

// Draws nice steps for the Y axis to make it easy to understand each step (no wierd increments)
const niceStep = (range) => {
  const safeRange = Math.max(range, 1e-9);
  const target = safeRange / 4;
  const pow10 = Math.pow(10, Math.floor(Math.log10(target)));
  const options = [1, 2, 2.5, 5, 10].map((m) => m * pow10);
  return options.reduce((best, cand) =>
    Math.abs(cand - target) < Math.abs(best - target) ? cand : best
  );
};

// Create a canvas that draws in logical units and respects scale
const makeCanvas = (width, height, scale = getScale()) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  canvas.logicalWidth = width;
  canvas.logicalHeight = height;
  canvas.scaleFactor = scale;
  return canvas;
};

// Draw grid, axis, labels, and tick labels
export function gridAxis(context, box, config) {
  const { x0, x1, y0, y1 } = box;
  const {
    xTicks = [],
    yMin,
    yMax,
    yStep,
    xLabel,
    yLabel,
    xTickFormat,
  } = config;

  // Map relative progress to X
  const getX = (progress) => x0 + (x1 - x0) * progress;

  // Map value to Y (top origin canvas)
  const getY = (value) => {
    const t = (value - yMin) / (yMax - yMin || 1);
    return y1 + (y0 - y1) * (1 - t);
  };

  // Background styling
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);

  // Vertical grid at each x tick
  context.strokeStyle = "#eeeeee";
  context.lineWidth = 1;
  xTicks.forEach((progress) => {
    const xx = getX(progress);
    context.beginPath();
    context.moveTo(xx, y1);
    context.lineTo(xx, y0);
    context.stroke();
  });

  // Horizontal gridlines across ± yMax using yStep
  for (let value = -yMax; value <= yMax + 1e-9; value += yStep) {
    const yy = getY(value);
    context.beginPath();
    context.moveTo(x0, yy);
    context.lineTo(x1, yy);
    context.stroke();
  }

  // Zero line styling, its emphasized
  context.strokeStyle = "#444444";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x0, getY(0));
  context.lineTo(x1, getY(0));
  context.stroke();

  // X Y axis line
  context.strokeStyle = "#999999";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x0, y1);
  context.lineTo(x0, y0);
  context.moveTo(x0, y0);
  context.lineTo(x1, y0);
  context.stroke();

  // Axis labels
  context.fillStyle = "#333333";
  context.font = "11px sans-serif";
  if (xLabel) {
    const w = context.measureText(xLabel).width;
    context.fillText(xLabel, (x0 + x1) / 2 - w / 2, y0 + 24);
  }
  if (yLabel) {
    context.save();
    context.translate(14, (y0 + y1) / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(yLabel, 0, 0);
    context.restore();
  }

  // Tick label styling
  context.fillStyle = "#555555";
  context.font = "10px sans-serif";

  // X tick labels
  xTicks.forEach((progress) => {
    const xx = getX(progress);
    const label = xTickFormat
      ? xTickFormat(progress)
      : `${Math.round(progress * 100)}%`;
    context.fillText(label, xx - context.measureText(label).width / 2, y0 + 16);
  });

  // Y tick labels with 2 decimal places
  const yTicks = [];
  for (let value = 0; value <= yMax + 1e-9; value += yStep)
    yTicks.push(+value.toFixed(6));
  for (let value = -yStep; value >= -yMax - 1e-9; value -= yStep)
    yTicks.push(+value.toFixed(6));
  yTicks.forEach((value) => {
    const yy = getY(value);
    const label = `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)}s`;
    context.fillText(label, x0 - 8 - context.measureText(label).width, yy + 3);
  });

  return { getX, getY };
}

// Draw the Cumulative Delta graph
export function cumAnchorChart(segs = [], width, height = 220, scale) {
  const canvas = makeCanvas(width, height, scale);
  if (!canvas) return null;

  const context = canvas.getContext("2d");
  if (canvas.scaleFactor !== 1)
    context.setTransform(canvas.scaleFactor, 0, 0, canvas.scaleFactor, 0, 0);

  // Layout padding
  const pad = { l: 60, r: 20, t: 26, b: 34 };
  const box = { x0: pad.l, x1: width - pad.r, y0: height - pad.b, y1: pad.t };

  // Build X on acnhor points and Y on time gained or lost, starting at 0
  const count = segs?.length || 0;
  const xs = Array.from({ length: count + 1 }, (_, i) => i);
  const ys = [0, ...segs.map((s) => (isNum(s?.cumDelta) ? s.cumDelta : 0))];

  // Choose a vertical range with a minimum visual breathing room.
  const absMax = Math.max(0.06, ...ys.map((value) => Math.abs(value)));
  const paddedMax = absMax * 1.12;
  const yStep = niceStep(paddedMax * 1.3);
  const yMax = Math.max(yStep, Math.ceil(paddedMax / yStep) * yStep);

  // Show every anchor index along X axis
  const xTicks = xs.map((i) => (count ? i / count : 0));
  const { getX, getY } = gridAxis(context, box, {
    xTicks,
    yMin: -yMax,
    yMax,
    yStep,
    xLabel: "Anchor #",
    yLabel: "Time (s)",
    xTickFormat: (progress) => String(Math.round(progress * (count || 1))),
  });

  const green = "#2e7d32";
  const red = "#c62828";

  // Draw line segments with gain/loss based colors for the Cumulative Delta graph
  context.lineWidth = 2;
  for (let i = 0; i < xs.length - 1; i++) {
    const xA = getX(xs[i] / (count || 1));
    const yA = getY(ys[i]);
    const xB = getX(xs[i + 1] / (count || 1));
    const yB = getY(ys[i + 1]);

    context.strokeStyle = ys[i + 1] - ys[i] > 0 ? red : green;
    context.beginPath();
    context.moveTo(xA, yA);
    context.lineTo(xB, yB);
    context.stroke();
  }

  // Add small markers on each anchor on the Cumulative Delta graph
  context.fillStyle = "#1f5aa6";
  for (let i = 0; i < xs.length; i++) {
    context.beginPath();
    context.arc(getX(xs[i] / (count || 1)), getY(ys[i]), 2.5, 0, Math.PI * 2);
    context.fill();
  }

  // Add a compact legend for the Cumulative Delta graph
  context.font = "10px sans-serif";
  context.fillStyle = "#333";
  const legendX = box.x0 + 20;
  const legendY = box.y1;
  context.fillText("Legend:", legendX, legendY);

  // Green sample, time gained
  context.strokeStyle = green;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(legendX + 52, legendY - 4);
  context.lineTo(legendX + 72, legendY - 4);
  context.stroke();
  context.fillText("down = B gains", legendX + 78, legendY);

  // Red sample, time lost
  context.strokeStyle = red;
  context.beginPath();
  context.moveTo(legendX + 162, legendY - 4);
  context.lineTo(legendX + 182, legendY - 4);
  context.stroke();
  context.fillText("up = B loses", legendX + 188, legendY);

  return canvas.toDataURL("image/png");
}

export default { cumAnchorChart };
