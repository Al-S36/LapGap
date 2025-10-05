import { unzipSync, strFromU8 } from "fflate";
import { validatePack } from "./validatePack.js";

// Unpacks the zip file the user uploaded and return app-ready objects
export async function readLapPack(zipBlob) {
  // Validate structures the zip file
  const zipFile = await validatePack(zipBlob);
  if (!zipFile.valid) throw new Error(zipFile.error);

  // Unzip files
  const bytes = new Uint8Array(await zipBlob.arrayBuffer());
  const files = unzipSync(bytes);

  // Helper to parse a JSON file from the zip
  const readJson = (path) => JSON.parse(strFromU8(files[path]));

  // Parse manifest and index first
  const manifest = readJson("manifest.json");
  const index = readJson("index.json");
  const pointer = index.pointers || {};

  // Load core JSON payloads
  const sessionJson = readJson(pointer.session);
  const trackJson = readJson(pointer.track);
  const anchors = pointer.anchors ? readJson(pointer.anchors) : [];

  // Helper to get mime for a path, always prefer manifest.files entry
  const mimeFor = (path) =>
    manifest.files?.[path]?.mime ||
    (path.endsWith(".json") ? "application/json" : "video/mp4");

  // Build a video object in the same shape the app uses
  const buildVideo = (key /* "videoA" | "videoB" */) => {
    const path = pointer[key];
    const data = files[path];
    if (!data) throw new Error(`Missing video bytes: ${path}`);

    const mime = mimeFor(path);
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);

    const meta = sessionJson[key] || {};
    const seconds = Number.isFinite(meta.duration)
      ? Number(meta.duration)
      : Number.isFinite(meta.durationMs)
      ? meta.durationMs / 1000
      : 0;

    // Return the same fields UploadArea would produce
    return {
      file: new File([blob], meta.filename || path.split("/").pop(), {
        type: mime,
      }),
      url,
      duration: seconds,
      width: Number(meta.width) || 0,
      height: Number(meta.height) || 0,
      fps: Number(meta.fps) || null,
      fpsMode: meta.fpsMode || null,
      fpsSource: meta.fpsSource || null,
      title: meta.title || (key === "videoA" ? "Car A" : "Car B"),
    };
  };

  const videoA = buildVideo("videoA");
  const videoB = buildVideo("videoB");

  const toFixedOrEmpty = (n) => (Number.isFinite(n) ? n.toFixed(2) : "");
  const track = {
    name: trackJson?.name || "",
    lengthKm: trackJson?.lengthKmNum ?? null,
    // Keep car fields compatible with report generator
    cars: {
      A: {
        driverName: trackJson?.cars?.A?.driverName || "",
        carModel: trackJson?.cars?.A?.carModel || "",
        carWeightKg: toFixedOrEmpty(trackJson?.cars?.A?.carWeightKgNum),
        carPowerHp: toFixedOrEmpty(trackJson?.cars?.A?.carPowerHpNum),
      },
      B: {
        driverName: trackJson?.cars?.B?.driverName || "",
        carModel: trackJson?.cars?.B?.carModel || "",
        carWeightKg: toFixedOrEmpty(trackJson?.cars?.B?.carWeightKgNum),
        carPowerHp: toFixedOrEmpty(trackJson?.cars?.B?.carPowerHpNum),
      },
    },
  };

  // Return everything the App needs to populate
  return {
    sessionId: sessionJson.sessionId,
    track,
    anchors,
    videoA,
    videoB,
    // clean up object URLs when you replace or unmount
    revoke: () => {
      if (videoA?.url) URL.revokeObjectURL(videoA.url);
      if (videoB?.url) URL.revokeObjectURL(videoB.url);
    },
  };
}
