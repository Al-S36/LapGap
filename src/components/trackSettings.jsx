import { useMemo, useState, useEffect, useRef } from "react";
import "../styling/trackSettings.css";

// Custom event so parent can listen
const emitTrackSettings = (name, lengthStr, cars) => {
  const distance = Number(lengthStr);
  const lengthKm = Number.isFinite(distance) && distance > 0 ? distance : null;
  window.dispatchEvent(
    new CustomEvent("trackSettings:update", {
      detail: {
        name: name || "N/A",
        lengthKm: lengthKm || "N/A",
        cars: cars || undefined,
      },
    })
  );
};

const toNumOrNull = (input) => {
  if (input == null || input === "") return null;
  const parsedInput = Number(input);
  return Number.isFinite(parsedInput) ? parsedInput : null;
};

const powerToWeight = (hp, kg) => {
  if (!Number.isFinite(hp) || !Number.isFinite(kg) || hp <= 0 || kg <= 0)
    return null;
  return +(hp / kg).toFixed(3);
};

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "");
const strOrEmpty = (s) =>
  typeof s === "string" ? s : s == null ? "" : String(s);

export default function TrackSettings({ value }) {
  // ✅ default: empty field (placeholder shows 0.00)
  const [form, setForm] = useState({ name: "", lengthKm: "" });

  const [carA, setCarA] = useState({
    driverName: "",
    carModel: "",
    carWeightKg: "",
    carPowerHp: "",
  });
  const [carB, setCarB] = useState({
    driverName: "",
    carModel: "",
    carWeightKg: "",
    carPowerHp: "",
  });

  // Always normalize blanks to "N/A"
  const isHydratingRef = useRef(false);

  // Populate from imported value
  useEffect(() => {
    if (!value) return;
    isHydratingRef.current = true;

    // Parse length from either numeric or string input
    const hasNum = Number.isFinite(value?.lengthKmNum);
    const hasStr = value?.lengthKm != null && Number.isFinite(+value.lengthKm);
    let hydratedLen = hasNum
      ? value.lengthKmNum
      : hasStr
      ? +value.lengthKm
      : null;

    if (
      hydratedLen === 0.01 ||
      (Number.isFinite(hydratedLen) && hydratedLen <= 0)
    ) {
      hydratedLen = null;
    }

    setForm({
      name: strOrEmpty(value?.name),
      // Keep raw number as string
      lengthKm: hydratedLen != null ? String(hydratedLen) : "",
    });

    const videoA = value?.cars?.A || {};
    const videoB = value?.cars?.B || {};

    const aWeight = Number.isFinite(videoA.carWeightKgNum)
      ? videoA.carWeightKgNum
      : toNumOrNull(videoA.carWeightKg);
    const aPower = Number.isFinite(videoA.carPowerHpNum)
      ? videoA.carPowerHpNum
      : toNumOrNull(videoA.carPowerHp);

    const bWeight = Number.isFinite(videoB.carWeightKgNum)
      ? videoB.carWeightKgNum
      : toNumOrNull(videoB.carWeightKg);
    const bPower = Number.isFinite(videoB.carPowerHpNum)
      ? videoB.carPowerHpNum
      : toNumOrNull(videoB.carPowerHp);

    setCarA({
      driverName: strOrEmpty(videoA.driverName),
      carModel: strOrEmpty(videoA.carModel),
      carWeightKg: fmt2(aWeight),
      carPowerHp: fmt2(aPower),
    });
    setCarB({
      driverName: strOrEmpty(videoB.driverName),
      carModel: strOrEmpty(videoB.carModel),
      carWeightKg: fmt2(bWeight),
      carPowerHp: fmt2(bPower),
    });

    // allow UI to render before enabling emits
    setTimeout(() => (isHydratingRef.current = false), 0);
  }, [value]);

  // Normalize blanks to "N/A" for outbound payload
  const normalizeCar = (car) => {
    const driverName = car.driverName?.trim() || "N/A";
    const carModel = car.carModel?.trim() || "N/A";

    const weightNum = toNumOrNull(car.carWeightKg);
    const powerNum = toNumOrNull(car.carPowerHp);

    const carWeightKg = weightNum != null ? weightNum.toFixed(2) : "N/A";
    const carPowerHp = powerNum != null ? powerNum.toFixed(2) : "N/A";

    const ptw =
      weightNum != null && powerNum != null
        ? powerToWeight(powerNum, weightNum)
        : null;

    return {
      driverName,
      carModel,
      carWeightKg,
      carPowerHp,
      powerToWeightWhpPerKg: ptw != null ? ptw : "N/A",
    };
  };

  const carsPayload = useMemo(
    () => ({
      A: normalizeCar(carA),
      B: normalizeCar(carB),
    }),
    [carA, carB]
  );

  // Validating track length input, allow only numbers and "."
  const handleLengthChange = (raw) => {
    let inputValue = raw.replace(/[^0-9.]/g, "");
    // allowing only one decimal point
    inputValue = inputValue.replace(/(\..*)\./g, "$1");

    // Only update local form; do not emit on each keystroke
    setForm((prev) => ({
      ...prev,
      lengthKm: inputValue,
    }));
  };

  // Round up to 2 decimal places
  const handleLengthBlur = () => {
    let inputValue = (form.lengthKm || "").trim();

    // If user leaves it blank, keep it blank and emit empty
    if (inputValue === "") {
      if (!isHydratingRef.current)
        emitTrackSettings(form.name, "", carsPayload);
      return;
    }

    // Error handling if the user enters .1 it becomes 0.1
    if (inputValue.startsWith(".")) inputValue = "0" + inputValue;
    if (inputValue.endsWith(".")) inputValue = inputValue.slice(0, -1);

    const numericValue = Number(inputValue);

    if (numericValue > 0 && Number.isFinite(numericValue)) {
      const formatted = numericValue.toFixed(2);
      setForm((prev) => ({ ...prev, lengthKm: formatted }));
      if (!isHydratingRef.current)
        emitTrackSettings(form.name, formatted, carsPayload);
    } else {
      // Keep field empty and show placeholder
      setForm((prev) => ({ ...prev, lengthKm: "" }));
      if (!isHydratingRef.current)
        emitTrackSettings(form.name, "", carsPayload);
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

  const handleCarNumericChange = (which, key, raw) => {
    let inputValue = raw.replace(/[^0-9.]/g, "");
    inputValue = inputValue.replace(/(\..*)\./g, "$1");

    if (which === "A") {
      setCarA({ ...carA, [key]: inputValue });
    } else {
      setCarB({ ...carB, [key]: inputValue });
    }
    if (!isHydratingRef.current)
      emitTrackSettings(form.name, form.lengthKm, carsPayload);
  };

  const handleCarNumericBlur = (which, key, val) => {
    // Heaviest production car Mercedes Pullman Guard
    const maxWeight = 5100;
    // Most powerful production car Devel Sixteen 12.3L v16 quad turbo
    const maxPower = 5007;

    let inputValue = (val || "").trim();
    if (inputValue.startsWith(".")) inputValue = "0" + inputValue;
    if (inputValue.endsWith(".")) inputValue = inputValue.slice(0, -1);

    const numericValue = Number(inputValue);

    // Choose ceiling based on field: weight or power
    const limit = key === "carPowerHp" ? maxPower : maxWeight;

    const valid =
      numericValue > 0 && Number.isFinite(numericValue) && numericValue < limit;

    const formatted = valid ? numericValue.toFixed(2) : "";

    if (which === "A") {
      setCarA({ ...carA, [key]: formatted });
    } else {
      setCarB({ ...carB, [key]: formatted });
    }
    if (!isHydratingRef.current)
      emitTrackSettings(form.name, form.lengthKm, carsPayload);
  };

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
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name }));
                if (!isHydratingRef.current)
                  emitTrackSettings(name, form.lengthKm, carsPayload);
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
          {lengthError ? (
            <div className="track-error" role="alert">
              {lengthError}
            </div>
          ) : null}
        </label>
      </div>

      <div className="track-title" style={{ marginTop: 15 }}>
        Car Information
      </div>

      {/* Car A */}
      <div className="track-row">
        <label className="track-field">
          <span className="track-label">Car A – Driver</span>
          <div className="track-shell">
            <input
              className="track-input"
              type="text"
              placeholder="Driver name"
              value={carA.driverName}
              onChange={(e) => setCarA({ ...carA, driverName: e.target.value })}
              onBlur={() => {
                if (!isHydratingRef.current)
                  emitTrackSettings(form.name, form.lengthKm, carsPayload);
              }}
              autoComplete="off"
            />
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car A – Model</span>
          <div className="track-shell">
            <input
              className="track-input"
              type="text"
              placeholder="Car model"
              value={carA.carModel}
              onChange={(e) => setCarA({ ...carA, carModel: e.target.value })}
              onBlur={() => {
                if (!isHydratingRef.current)
                  emitTrackSettings(form.name, form.lengthKm, carsPayload);
              }}
              autoComplete="off"
            />
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car A – Weight</span>
          <div className="track-shell track-suffix">
            <input
              className="track-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={carA.carWeightKg}
              onChange={(e) =>
                handleCarNumericChange("A", "carWeightKg", e.target.value)
              }
              onBlur={() =>
                handleCarNumericBlur("A", "carWeightKg", carA.carWeightKg)
              }
            />
            <span className="track-unit">kg</span>
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car A – Power</span>
          <div className="track-shell track-suffix">
            <input
              className="track-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={carA.carPowerHp}
              onChange={(e) =>
                handleCarNumericChange("A", "carPowerHp", e.target.value)
              }
              onBlur={() =>
                handleCarNumericBlur("A", "carPowerHp", carA.carPowerHp)
              }
            />
            <span className="track-unit">whp</span>
          </div>
        </label>
      </div>

      {/* Car B */}
      <div className="track-row">
        <label className="track-field">
          <span className="track-label">Car B – Driver</span>
          <div className="track-shell">
            <input
              className="track-input"
              type="text"
              placeholder="Driver name"
              value={carB.driverName}
              onChange={(e) => setCarB({ ...carB, driverName: e.target.value })}
              onBlur={() => {
                if (!isHydratingRef.current)
                  emitTrackSettings(form.name, form.lengthKm, carsPayload);
              }}
              autoComplete="off"
            />
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car B – Model</span>
          <div className="track-shell">
            <input
              className="track-input"
              type="text"
              placeholder="Car model"
              value={carB.carModel}
              onChange={(e) => setCarB({ ...carB, carModel: e.target.value })}
              onBlur={() => {
                if (!isHydratingRef.current)
                  emitTrackSettings(form.name, form.lengthKm, carsPayload);
              }}
              autoComplete="off"
            />
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car B – Weight</span>
          <div className="track-shell track-suffix">
            <input
              className="track-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={carB.carWeightKg}
              onChange={(e) =>
                handleCarNumericChange("B", "carWeightKg", e.target.value)
              }
              onBlur={() =>
                handleCarNumericBlur("B", "carWeightKg", carB.carWeightKg)
              }
            />
            <span className="track-unit">kg</span>
          </div>
        </label>

        <label className="track-field">
          <span className="track-label">Car B – Power</span>
          <div className="track-shell track-suffix">
            <input
              className="track-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={carB.carPowerHp}
              onChange={(e) =>
                handleCarNumericChange("B", "carPowerHp", e.target.value)
              }
              onBlur={() =>
                handleCarNumericBlur("B", "carPowerHp", carB.carPowerHp)
              }
            />
            <span className="track-unit">whp</span>
          </div>
        </label>
      </div>
    </section>
  );
}
