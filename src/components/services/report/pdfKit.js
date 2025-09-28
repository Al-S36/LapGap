import autoTable from "jspdf-autotable";
import { T, contentWidth as CW } from "./theme.js";

// Renders header & page index on every page
export function headerFooter(doc) {
  autoTable(doc, {
    startY: 0,
    margin: { left: T.MX, right: T.MX, top: 20 },
    theme: "plain",
    styles: {
      fillColor: [255, 255, 255],
      textColor: T.C.brand,
      fontSize: 11,
      halign: "left",
    },
    body: [
      [{ content: "LapGap – Quick Report", styles: { fontStyle: "bold" } }],
    ],
    didDrawPage: () => {
      const page = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...T.C.sub);
      doc.text(
        page,
        doc.internal.pageSize.getWidth() - T.MX,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
    },
  });
}

// H1 title
export function h1(doc, y, text) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...T.C.text);
  doc.text(text, T.MX, y);
  return y + T.SP.afterTitle;
}

// H2 subtitle
export function h2(doc, y, text, after = T.SP.afterTitle) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...T.C.text);
  doc.text(text, T.MX, y);
  return y + after;
}

// Ensures there's room for the next block; adds a page if needed
export function need(doc, y) {
  const h = doc.internal.pageSize.getHeight();
  if (doc.lastAutoTable) y = Math.max(y, doc.lastAutoTable.finalY + T.SP.small);
  if (y > h - 60) {
    doc.addPage();
    headerFooter(doc);
    return 60;
  }
  return y;
}

// Simple table wrapper
export function table(
  doc,
  y,
  { head, body, col = {}, fs = 10, pad = 6, theme = "grid", didParseCell } = {}
) {
  autoTable(doc, {
    startY: y,
    margin: { left: T.MX, right: T.MX },
    theme,
    styles: { fontSize: fs, cellPadding: pad, textColor: T.C.text },
    headStyles: { fillColor: T.C.head },
    columnStyles: col,
    head,
    body,
    didParseCell,
  });
  return doc.lastAutoTable.finalY;
}

// KPI row with 3 cells
export function kpi(doc, y, cells = []) {
  autoTable(doc, {
    startY: y,
    margin: { left: T.MX, right: T.MX },
    theme: "plain",
    styles: { fontSize: 12, cellPadding: 8, textColor: T.C.text },
    columnStyles: {
      0: { cellWidth: CW(doc) / 3 - 6 },
      1: { cellWidth: CW(doc) / 3 - 6 },
      2: { cellWidth: CW(doc) / 3 - 6 },
    },
    body: [
      cells.map((c) => ({
        content: c,
        styles: { fillColor: T.C.head, fontStyle: "bold" },
      })),
    ],
  });
  return doc.lastAutoTable.finalY + T.SP.small;
}

// Small gray note paragraph
export function note(doc, y, text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...T.C.sub);
  const wrapped = doc.splitTextToSize(text, CW(doc));
  doc.text(wrapped, T.MX, y);
  return y + T.SP.section;
}

// expose content width helper
export const contentWidth = CW;
