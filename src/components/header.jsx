import lapgapLogo from "../assets/lapGap-logo.png";

export default function Header({
  onGenerateReport,
  canGenerate,
  onExportPack,
  canExportPack,
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerateReport?.();
  };

  const handleExportClick = (e) => {
    e.preventDefault();
    if (!canExportPack) return;
    onExportPack?.();
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
            Export Pack
          </button>
        </nav>
      </div>
    </header>
  );
}
