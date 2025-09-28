// Central theme (margins, spacing, colors, fonts) for PDF reports
// Keeps style consistent across tables, charts, and sections

export const T = {
  // Horizontal margin (both sides)
  MX: 25,

  // Standard spacings (pt)
  SP: {
    // gap under section titles
    afterTitle: 11,
    // spacing between blocks
    between: 9,
    // tiny gap for fine-tuning
    small: 5,
    // gap before notes
    note: 8,
    // bottom spacing after a section
    section: 15,
    // padding before data section
    dataTop: 8,
    // pulls chart closer to its title
    chartTitle: 3,
    // space under charts
    chartBottom: 3,
    // breathing room before segment table
    segTop: 100,
    // extra spacing before Car B block
    carBTop: 12,
  },

  // Color palette
  C: {
    text: [30, 30, 30], // main text
    sub: [90, 90, 90], // subtitles / secondary
    head: [245, 245, 245], // table headers / KPI fill
    a: [34, 139, 34], // green → A ahead
    b: [198, 40, 40], // red → B ahead
    brand: [40, 87, 167], // LapGap brand color
  },

  // Font presets
  font: {
    h1: { family: "helvetica", size: 18, style: "bold" },
    h2: { family: "helvetica", size: 13, style: "bold" },
  },
};

// Content width inside margins
export const contentWidth = (doc) =>
  doc.internal.pageSize.getWidth() - T.MX * 2;
