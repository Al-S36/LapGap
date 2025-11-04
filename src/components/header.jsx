import lapgapLogo from "../assets/lapGap-logo.png";
import { useRef, useState } from "react";

export default function Header({
  onGenerateReport,
  canGenerate,
  onExportPack,
  canExportPack,
  onImportPack,
}) {
  // Hidden file input for picking a .zip
  const importInputRef = useRef(null);

  // Export button state
  const [exportBusy, setExportBusy] = useState(false);
  // Import button state
  const [importBusy, setImportBusy] = useState(false);

  const handleClick = (e) => {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerateReport?.();
  };

  // Yield helpers so the UI paints before blocking work starts
  const nextTick = () => new Promise((r) => setTimeout(r, 0));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // Export pack
  const handleExportClick = async (e) => {
    e.preventDefault();
    if (!canExportPack || exportBusy || importBusy) return;

    setExportBusy(true);
    await nextTick();
    await nextFrame();

    try {
      await onExportPack?.();
    } catch (err) {
      try {
        alert("Export failed.");
      } catch {}
    } finally {
      setExportBusy(false);
    }
  };

  // Import pack
  const handleImportClick = (e) => {
    e.preventDefault();
    if (importBusy || exportBusy) return;
    importInputRef.current?.click();
  };

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still triggers onChange
    if (importInputRef.current) importInputRef.current.value = "";
    if (!file || !onImportPack || importBusy || exportBusy) return;

    setImportBusy(true);
    await nextTick();
    await nextFrame();

    try {
      await onImportPack(file);
    } catch (err) {
      try {
        alert("Import failed.");
      } catch {}
    } finally {
      setImportBusy(false);
    }
  };

  // Refresh page
  const handleRefreshClick = (e) => {
    e.preventDefault();
    window.location.reload();
  };

  return (
    <header className="header">
      <div className="header-content">
        <a className="brand" href="/">
          <img className="brand-logo" src={lapgapLogo} alt="LapGap logo" />
          <h1>LapGap</h1>
        </a>

        <nav className="nav">
          <a href="#" className="nav-link active">
            Home
          </a>

          {/* Quick Report acts as the generate+download button */}
          <button
            className="nav-link"
            onClick={handleClick}
            disabled={!canGenerate || exportBusy || importBusy}
            title={
              !canGenerate
                ? "Upload both laps to enable report"
                : "Download Quick Report (PDF)"
            }
          >
            Quick Report
          </button>

          <button
            className="nav-link"
            onClick={handleExportClick}
            disabled={!canExportPack || exportBusy || importBusy}
            aria-busy={exportBusy ? "true" : "false"}
            title={
              !canExportPack
                ? "Upload both laps to enable export"
                : "Download Lap Pack (.zip)"
            }
          >
            {exportBusy ? "Exporting…" : "Export Session"}
          </button>

          <button
            className="nav-link"
            onClick={handleImportClick}
            disabled={importBusy || exportBusy}
            aria-busy={importBusy ? "true" : "false"}
            title="Import LapGap Pack (.zip)"
          >
            {importBusy ? "Importing…" : "Import Session"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleImportChange}
            hidden
          />

          {/* Refresh button */}
          <button
            className="nav-link"
            onClick={handleRefreshClick}
            title="Refresh the page"
          >
            Refresh
          </button>
        </nav>
      </div>
    </header>
  );
}
