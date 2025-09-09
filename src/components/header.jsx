import lapgapLogo from "../assets/lapGap-logo.png";

export default function Header() {
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
        </nav>
      </div>
    </header>
  );
}
