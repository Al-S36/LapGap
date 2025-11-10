import { useState } from "react";
import { createLapPack, buildDefaultPackFilename } from "../services/pack.js";
import { downloadBlob } from "../services/download.js";

// When pressed it packages the current session into a zip file using createLapPack
// it downloads itself using downloadBlob
export default function ExportControls({
  videoA,
  videoB,
  anchors,
  track,
  user,
  stats,
  settings,
  deltaSamples,
  sessionId,
}) {
  // sets itself as busy to prevent multiple downloads at the same time
  const [busy, setBusy] = useState(false);
  // Only enabled if both videos are present
  const canExport = !!(videoA?.file && videoB?.file);

  // Packing the blob then triggereing a download
  const handleExport = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    try {
      // Filename computed at export time to avoid stale dates
      const filename = buildDefaultPackFilename(track?.name || "track");
      // Current session data
      const packBlob = await createLapPack({
        sessionId,
        track,
        user,
        videoA,
        videoB,
        anchors,
        stats,
        settings,
        deltaSamples,
      });
      downloadBlob(packBlob, filename);
    } catch (err) {
      try {
        alert("Export failed.");
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-controls" style={{ marginTop: 8 }}>
      <button
        className="btn"
        onClick={handleExport}
        disabled={!canExport || busy}
      >
        {busy ? "Exporting…" : "Export Session (.zip)"}
      </button>
      {!canExport && (
        <span className="muted" style={{ marginLeft: 8 }}>
          Upload both videos to enable export.
        </span>
      )}
    </div>
  );
}
