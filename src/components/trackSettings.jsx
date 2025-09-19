import { useMemo, useState } from "react";
import "../styling/trackSettings.css";

// Custom event so parent can listen
const emitTrackSettings = (name, lengthStr) => {
  const distance = Number(lengthStr);
  const lengthKm = Number.isFinite(distance) && distance > 0 ? distance : null;
  window.dispatchEvent(
    new CustomEvent("trackSettings:update", {
      detail: { name, lengthKm },
    })
  );
};

export default function TrackSettings() {
  const [form, setForm] = useState({ name: "", lengthKm: "" });

  // Validating track length input, allow only numbers and "."
  const handleLengthChange = (raw) => {
    let inputValue = raw.replace(/[^0-9.]/g, "");
    // allowing only one decimal point
    inputValue = inputValue.replace(/(\..*)\./g, "$1");

    setForm({
      name: form.name,
      lengthKm: inputValue,
    });

    emitTrackSettings(form.name, inputValue); // ADD: live emit while typing
  };

  // Round up to 2 decimal places
  const handleLengthBlur = () => {
    let inputValue = (form.lengthKm || "").trim();

    // Error handiling if the user enters .1 it becomes 0.1
    if (inputValue.startsWith(".")) inputValue = "0" + inputValue;
    if (inputValue.endsWith(".")) inputValue = inputValue.slice(0, -1);

    const numericValue = Number(inputValue);

    if (numericValue > 0 && Number.isFinite(numericValue)) {
      const formatted = numericValue.toFixed(2);
      setForm({ name: form.name, lengthKm: formatted });
      emitTrackSettings(form.name, formatted); // ADD
    } else {
      setForm({ name: form.name, lengthKm: "" });
      emitTrackSettings(form.name, ""); // ADD
    }
  };

  const lengthError = useMemo(() => {
    const inputValue = (form.lengthKm || "").trim();
    if (inputValue === "") return "";
    const numericValue = Number(inputValue);

    // if the input is not a number and smaller than 0 or longer than the Nürburgring
    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0 ||
      numericValue > 21
    ) {
      return "Invalid track length";
    }
    return "";
  }, [form.lengthKm]);

  return (
    <section>
      <div className="track-title">Track Settings</div>
      <div className="track-row">
        {/* Track Name */}
        <label className="track-field">
          <span className="track-label">Name</span>
          <div className="track-shell">
            <input
              id="track-name"
              className="track-input"
              type="text"
              placeholder="e.g., Manja Circuit"
              value={form.name}
              onChange={(e) => {
                setForm({ name: e.target.value, lengthKm: form.lengthKm });
                emitTrackSettings(e.target.value, form.lengthKm);
              }}
              autoComplete="off"
            />
          </div>
        </label>

        {/* Track Length */}
        <label className="track-field">
          <span className="track-label">Length</span>
          <div className="track-shell track-suffix">
            <input
              id="track-length"
              className="track-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.lengthKm}
              onChange={(e) => handleLengthChange(e.target.value)}
              onBlur={handleLengthBlur}
            />
            <span className="track-unit">km</span>
          </div>
        </label>
      </div>
    </section>
  );
}
