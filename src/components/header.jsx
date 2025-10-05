import lapgapLogo from "../assets/lapGap-logo.png";
import { useRef } from "react";

export default function Header({
  onGenerateReport,
  canGenerate,
  onExportPack,
  canExportPack,
  onImportPack,
}) {
  
  // Hidden file input for picking a .zip
  const importInputRef = useRef(null);

  const handleClick = (e) => {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerateReport?.();
  };

  // Export pack
  const handleExportClick = (e) => {
    e.preventDefault();
    if (!canExportPack) return;
    onExportPack?.();
  };

  // Import pack
  const handleImportClick = (e) => {
    e.preventDefault();
    importInputRef.current?.click();
  };
  const handleImportChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onImportPack) onImportPack(file);
    // Reset so choosing the same file again still triggers onChange
    if (importInputRef.current) importInputRef.current.value = "";
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
            disabled={!canGenerate}
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
            disabled={!canExportPack}
            title={
              !canExportPack
                ? "Upload both laps to enable export"
                : "Download Lap Pack (.zip)"
            }
          >
            Export Session
          </button>

          <button
            className="nav-link"
            onClick={handleImportClick}
            title="Import LapGap Pack (.zip)"
          >
            Import Session
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
