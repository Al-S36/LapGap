import lapgapLogo from "../assets/lapGap-logo.png";

export default function Header({ onGenerateReport, canGenerate }) {
  const handleClick = (e) => {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerateReport?.();
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
        </nav>
      </div>
    </header>
  );
}
