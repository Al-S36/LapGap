import jsPDF from "jspdf";
import { T, contentWidth as CW } from "./report/theme.js";
import { isNum, show, time, sgn, pct } from "./report/formatter.js";
import { headerFooter, h1, h2, need, table, kpi } from "./report/pdfKit.js";
import {
  normalizeAnchors,
  buildSegments,
  rankSegments,
} from "./report/anchors.js";
import {
  computeLeadPercentA,
  computeConsistencyScore,
  computeTheoreticalBestLapPreferred,
} from "./improvementStats.js";

// Generates the LapGap PDF report.
// Adds summary, data tables, segment table, and the cumulative delta chart.

// Computes power-to-weight (whp/kg) for car tables
function getPTW(car) {
  const fromField = Number(car?.powerToWeightWhpPerKg);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const hp = Number(car?.carPowerHp);
  const kg = Number(car?.carWeightKg);
  if (Number.isFinite(hp) && Number.isFinite(kg) && hp > 0 && kg > 0)
    return hp / kg;
  return null;
}

export default async function generateReport({
  track,
  videoA,
  videoB,
  // optional from StatsStrip
  theoreticalBest,
  theoreticalSaving,
  consistencyPct,
  leadSharePctA,
  finalGap,
  deltaSamples = [],
  anchorPairs = null,
}) {
  // Creates a new PDF in a4 size
  const doc = new jsPDF({ unit: "px", format: "a4" });
  headerFooter(doc);

  // Cursor
  let yPos = 60;

  // First Section
  yPos = h1(doc, yPos, "Report Summary");

  const lapA = videoA?.duration ?? null;
  const lapB = videoB?.duration ?? null;

  // Faster lap banner, which car was faster and by how much
  if (isNum(lapA) || isNum(lapB)) {
    let text = "Faster Lap: N/A";
    if (isNum(lapA) && isNum(lapB)) {
      const aIsFaster = lapA <= lapB;
      const who = aIsFaster ? "Car A" : "Car B";
      const when = aIsFaster ? lapA : lapB;
      const diff = Math.abs(lapB - lapA);
      text = `Faster Lap: ${who} (${time(when)}) by ${diff.toFixed(3)} s`;
    } else if (isNum(lapA)) {
      text = `Faster Lap: Car A (${time(lapA)})`;
    } else {
      text = `Faster Lap: Car B (${time(lapB)})`;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...T.C.sub);
    doc.text(text, T.MX, yPos);
    yPos += T.SP.between;
  }

  // KPI row
  const bestLap =
    isNum(lapA) && isNum(lapB)
      ? Math.min(lapA, lapB)
      : isNum(lapA)
      ? lapA
      : lapB;
  const finalGapCalc = isNum(lapA) && isNum(lapB) ? lapB - lapA : null;
  const theoreticalSave =
    isNum(theoreticalBest) && isNum(bestLap) ? bestLap - theoreticalBest : null;

  yPos = kpi(doc, yPos, [
    `Best Lap: ${time(bestLap)}`,
    `Final Gap (B - A): ${sgn(finalGapCalc)}`,
    `Theoretical Save: ${
      isNum(theoreticalSave) ? sgn(-theoreticalSave) : "N/A"
    }`,
  ]);

  // Secondary KPI row
  table(doc, yPos, {
    theme: "plain",
    body: [
      [
        {
          content: `Consistency: ${pct(consistencyPct, 1)}`,
          styles: { fillColor: [250, 250, 250] },
        },
        {
          content: `Lead Share (A): ${
            isNum(leadSharePctA) ? `${leadSharePctA.toFixed(1)}%` : "N/A"
          }`,
          styles: { fillColor: [250, 250, 250] },
        },
      ],
    ],
    col: {
      0: { cellWidth: CW(doc) / 2 - 4 },
      1: { cellWidth: CW(doc) / 2 - 4 },
    },
    fs: 11,
    pad: 6,
  });
  yPos = doc.lastAutoTable.finalY + T.SP.between;

  // Spacer
  yPos += T.SP.section;

  // Data Section
  yPos += T.SP.dataTop;
  yPos = h1(doc, yPos, "Data");

  // Track information table
  yPos = h2(doc, yPos, "Track");
  yPos =
    table(doc, yPos, {
      head: [["Name", "Length (km)"]],
      body: [
        [
          show(track?.name),
          typeof track?.lengthKm === "number"
            ? track.lengthKm.toFixed(2)
            : "N/A",
        ],
      ],
      col: {
        0: { cellWidth: CW(doc) * 0.6 },
        1: { cellWidth: CW(doc) * 0.4, halign: "right" },
      },
    }) + T.SP.section;

  // Car A / Car B information tables
  const ptwString = (car) => {
    const v = getPTW(car);
    return isNum(v) ? v.toFixed(3) : "N/A";
  };

  for (const label of ["A", "B"]) {
    if (label === "B") yPos += T.SP.carBTop;
    yPos = h2(doc, yPos, `Car ${label}`);
    yPos = table(doc, yPos, {
      head: [
        [
          "Driver",
          "Model",
          "Weight (kg)",
          "Power (whp)",
          "Power/Weight (whp/kg)",
        ],
      ],
      body: [
        [
          show(track?.cars?.[label]?.driverName),
          show(track?.cars?.[label]?.carModel),
          show(track?.cars?.[label]?.carWeightKg),
          show(track?.cars?.[label]?.carPowerHp),
          ptwString(track?.cars?.[label]),
        ],
      ],
      col: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });
  }
  yPos = doc.lastAutoTable.finalY + T.SP.section;

  // Lap & Delta
  const trackLengthKm =
    typeof track?.lengthKm === "number" ? track.lengthKm : null;

  // Average speed (km/h)
  const avgSpeed = (durationSec) =>
    isNum(durationSec) &&
    isNum(trackLengthKm) &&
    durationSec > 0 &&
    trackLengthKm > 0
      ? `${(trackLengthKm / (durationSec / 3600)).toFixed(1)} km/h`
      : "N/A";

  // Use strip values if provided, else compute the same way the strip does
  const finalGapVal = isNum(finalGap) ? finalGap : (lapB || 0) - (lapA || 0);

  const theoBestVal = isNum(theoreticalBest)
    ? theoreticalBest
    : computeTheoreticalBestLapPreferred(
        lapA,
        lapB,
        deltaSamples,
        60,
        anchorPairs
      );

  const fastest = Math.min(Number(lapA) || 0, Number(lapB) || 0);
  const theoSavingVal = isNum(theoreticalSaving)
    ? theoreticalSaving
    : Math.max(0, fastest - (Number(theoBestVal) || 0));

  const consistencyVal = isNum(consistencyPct)
    ? consistencyPct
    : computeConsistencyScore(deltaSamples);

  const leadShareAVal = isNum(leadSharePctA)
    ? leadSharePctA
    : computeLeadPercentA(deltaSamples);

  // lap and delta table
  yPos = h2(doc, yPos, "Lap & Delta");
  yPos =
    table(doc, yPos, {
      head: [["Metric", "Value", "Extra"]],
      body: [
        ["Lap A", time(lapA), avgSpeed(lapA)],
        ["Lap B", time(lapB), avgSpeed(lapB)],
        ["Final Gap (B - A)", sgn(isNum(finalGapVal) ? finalGapVal : null), ""],
        [
          "Theoretical Best Lap",
          time(theoBestVal),
          isNum(theoSavingVal) ? `-${theoSavingVal.toFixed(3)} s` : "N/A",
        ],
        [
          "Consistency",
          isNum(consistencyVal) ? pct(consistencyVal, 1) : "N/A",
          "",
        ],
        [
          "Lead Share (A)",
          isNum(leadShareAVal) ? `${leadShareAVal.toFixed(1)}%` : "N/A",
          "",
        ],
      ],
      col: {
        0: { cellWidth: CW(doc) * 0.36 },
        1: { cellWidth: CW(doc) * 0.28 },
        2: { cellWidth: CW(doc) * 0.36, halign: "right" },
      },
    }) + T.SP.section;

  // Anchors and chart
  const anchors = normalizeAnchors(anchorPairs, lapA, lapB);
  const segments = anchors ? buildSegments(anchors) : null;

  const { cumAnchorChart } = await import("./report/charts.js");

  if (segments?.length) {
    // Segment table
    yPos += T.SP.segTop;
    yPos = h2(doc, need(doc, yPos), "Segment Table (Anchor-to-Anchor)");
    table(doc, yPos, {
      head: [
        [
          "Segment",
          "A Cum",
          "B Cum",
          "Segment Delta (B to A)",
          "Cumulative Delta",
        ],
      ],
      body: segments.map((s) => [
        `${s.idx + 1}–${s.idx + 2}`,
        time(s.cumA),
        time(s.cumB),
        sgn(s.dSeg),
        sgn(s.cumDelta),
      ]),
      col: {
        0: { halign: "left" },
        1: { font: "courier", halign: "right" },
        2: { font: "courier", halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      fs: 9,
      pad: 4,
      didParseCell: (d) => {
        const colIdx = d.column.index;
        const raw = d.cell.raw;
        if ((colIdx === 3 || colIdx === 4) && typeof raw === "string") {
          const num = parseFloat(raw);
          if (Number.isFinite(num))
            d.cell.styles.textColor =
              num < 0 ? T.C.a : num > 0 ? T.C.b : T.C.text;
        }
      },
    });
    yPos = doc.lastAutoTable.finalY + T.SP.section;

    // Cumulative delta chart
    const chartWidth = CW(doc);
    const chartHeight = 190;
    const scaleFactor = 3;

    const png = cumAnchorChart(segments, chartWidth, chartHeight, scaleFactor);
    if (png) {
      yPos = h2(
        doc,
        need(doc, yPos),
        "Cumulative Delta by Anchor (B - A)",
        T.SP.chartTitle
      );
      doc.addImage(png, "PNG", T.MX, yPos, chartWidth, chartHeight);
      yPos += chartHeight + T.SP.chartBottom;
    }
  }

  // Suggestions Section
  doc.addPage();
  headerFooter(doc);
  yPos = 60;
  yPos = h1(doc, yPos, "Suggested / Actionable Feedback");

  if (segments?.length) {
    // Top 3 gains/losses to see where exacxtly the driver is gainin/losing time
    const { gains, losses } = rankSegments(segments, 3);

    yPos = h2(doc, yPos, "Segment Ranking");
    yPos =
      table(doc, yPos, {
        head: [["Type", "Segment", "Delta (B - A)"]],
        body: [
          ...gains.map((s, i) => [
            `Top Gain #${i + 1}`,
            `${s.idx + 1}–${s.idx + 2}`,
            sgn(s.dSeg),
          ]),
          ...losses.map((s, i) => [
            `Top Loss #${i + 1}`,
            `${s.idx + 1}–${s.idx + 2}`,
            sgn(s.dSeg),
          ]),
        ],
        col: {
          0: { cellWidth: CW(doc) * 0.46 },
          1: { cellWidth: CW(doc) * 0.26, halign: "center" },
          2: { cellWidth: CW(doc) * 0.28, halign: "right" },
        },
        fs: 9,
        pad: 4,
      }) + T.SP.section;

    // Notes
    yPos = h2(doc, yPos, "Notes");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const bullets = [];
    if (losses[0]) {
      bullets.push(
        `Largest single loss between Anchors ${losses[0].idx + 1}–${
          losses[0].idx + 2
        } (${sgn(losses[0].dSeg)}).`
      );
    }
    if (gains[0]) {
      bullets.push(
        `Largest single gain between Anchors ${gains[0].idx + 1}–${
          gains[0].idx + 2
        } (${sgn(gains[0].dSeg)}).`
      );
    }

    // Largest 3-segment swing
    if (segments.length >= 3) {
      let bestStart = 0;
      let bestSumAbs = -Infinity;
      for (let i = 0; i <= segments.length - 3; i++) {
        const sumAbs = Math.abs(
          segments[i].dSeg + segments[i + 1].dSeg + segments[i + 2].dSeg
        );
        if (sumAbs > bestSumAbs) {
          bestSumAbs = sumAbs;
          bestStart = i;
        }
      }
      const sum3 =
        segments[bestStart].dSeg +
        segments[bestStart + 1].dSeg +
        segments[bestStart + 2].dSeg;
      bullets.push(
        `Most of the gap shifts across Anchors ${bestStart + 1}–${
          bestStart + 3
        } (${sgn(sum3)} over 3 segments).`
      );
    }

    const wrapped = doc.splitTextToSize(
      bullets.map((b) => `• ${b}`).join("\n"),
      CW(doc)
    );
    doc.text(wrapped, T.MX, (yPos += 10));
  } else {
    // No anchors error handle
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(
      "No anchors available — rank and targeted notes require anchor data.",
      T.MX,
      yPos + 4
    );
  }

  // File name, LapGap_Report_"trackname"_"date".pdf
  const safeName = (show(track?.name) || "").replace(/[^\w\d_-]+/g, "_");
  doc.save(
    `LapGap_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
