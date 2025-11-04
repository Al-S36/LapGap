import { zipSync, strToU8 } from "fflate";
import { sha256Hex } from "./hash.js";

// Turn a string into a URL safe string/slug
export function safeURL(input = "", fallback = "untitled") {
  let inputTitle = String(input).normalize("NFC");
  // Converts arabic numbers to ASCII
  inputTitle = inputTitle.replace(/[\u0660-\u0669]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x0660)
  );
  // Removes arabic harakat or tatweel
  inputTitle = inputTitle.replace(
    /[\u0640\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,
    ""
  );
  // Makes all text lowercase
  inputTitle = inputTitle.replace(/[A-Z]/g, (car) => car.toLowerCase());
  // Replace any non a-z, digits, Arabic characters with "-"
  inputTitle = inputTitle.replace(
    /[^a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g,
    "-"
  );
  // Remove leading/trailing dashes
  inputTitle = inputTitle.replace(/(^-|-$)+/g, "");
  // Fallback if nothing remains
  return inputTitle || fallback;
}

// label for all JSON files
const mimeJSON = "application/json";

//
const toNum = (value) => (Number.isFinite(+value) ? +value : null);

// Default when a video file has no .type
const mimeFallbackVideo = "video/mp4";
// Whitelist of containers we support for pathing
const videoExt = new Set(["mp4", "webm", "mov", "mkv"]);

// return a normalized extension, or null if unknown
const extFromMime = (type) => {
  if (!type) return null;
  const extension = type.toLowerCase();
  if (extension.includes("mp4")) return "mp4";
  if (extension.includes("webm")) return "webm";
  if (extension.includes("quicktime") || extension.includes("mov"))
    return "mov";
  if (
    extension.includes("x-matroska") ||
    extension.includes("matroska") ||
    extension.includes("mkv")
  )
    return "mkv";
  return null;
};

// Fallback to use the extension from the filename
const extFromName = (name) => {
  const fileName = String(name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/i);
  return fileName ? fileName[1] : null;
};

// Mime first, then filename (whitelisted), else default to mp4
const guessVideoExt = (file) => {
  const byMime = extFromMime(file?.type);
  if (byMime && videoExt.has(byMime)) return byMime;

  const byName = extFromName(file?.name);
  if (byName && videoExt.has(byName)) return byName;

  return "mp4";
};

const videoMime = (file) => file?.type || mimeFallbackVideo;

const sanitizeSessionId = (raw) => {
  const sessionId = String(raw || "").trim();
  // Reject blob: and empty; generate sess_<base36 time + 4 random chars>
  if (!sessionId || sessionId.startsWith("blob:")) {
    const rnd = Math.random().toString(36).slice(2, 6);
    return `sess_${Date.now().toString(36)}${rnd}`;
  }
  // Keep caller-supplied id but make it filesystem/URL safe and bounded
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
};

export async function createLapPack(session = {}) {
  // Must have both videos with .file blobs
  if (!session?.videoA?.file || !session?.videoB?.file) {
    throw new Error("Export failed: both videos are required.");
  }

  const sessionId = sanitizeSessionId(session.sessionId);

  // Track snapshot (lean): only canonical values used by import/UI
  const trackIn = session.track || {};

  const toStrOrNull = (value) => {
    const str = (value ?? "").toString().trim();
    return str ? str : null;
  };

  // Keep stable car and driver info
  const toCar = (car = {}) => ({
    driverName: toStrOrNull(car.driverName),
    carModel: toStrOrNull(car.carModel),
    carWeightKgNum: toNum(car.carWeightKg),
    carPowerHpNum: toNum(car.carPowerHp),
  });

  const trackJson = {
    name: toStrOrNull(trackIn.name),
    lengthKmNum: toNum(trackIn.lengthKm),
    cars: {
      A: toCar(trackIn.cars?.A || {}),
      B: toCar(trackIn.cars?.B || {}),
    },
  };

  // Video metadata (precise ms + mime)
  const maskVideoMeta = (metaData = {}) => {
    const dur = Number(metaData.duration) || 0;
    return {
      title: metaData.title || null,
      duration: dur,
      durationMs: Math.round(dur * 1000),
      width: Number(metaData.width) || 0,
      height: Number(metaData.height) || 0,
      fps: Number(metaData.fps) || null,
      fpsMode: metaData.fpsMode || null,
      fpsSource: metaData.fpsSource || null,
      filename: metaData?.file?.name || null,
      mime: videoMime(metaData?.file),
    };
  };

  // Anchors array of { tA, tB }
  const anchorsJson = Array.isArray(session.anchors) ? session.anchors : [];

  // only what import/UI needs
  const sessionJson = {
    sessionId,
    videoA: maskVideoMeta(session.videoA),
    videoB: maskVideoMeta(session.videoB),
  };

  // Optional data from the user, only include if present
  const userJson = session.user ?? null;
  const settingsJson = session.settings ?? null;

  // Media paths (preserve detected extensions for clarity)
  const extA = guessVideoExt(session.videoA.file);
  const extB = guessVideoExt(session.videoB.file);
  const pathVideoA = `media/videoA.${extA}`;
  const pathVideoB = `media/videoB.${extB}`;

  // Read video bytes using Uint8Array to make them ready for zipping
  const mediaA = new Uint8Array(await session.videoA.file.arrayBuffer());
  const mediaB = new Uint8Array(await session.videoB.file.arrayBuffer());

  // We’ve removed derived stats from the pack (recomputed on import/UI)
  const statsJson = null;

  // Build the list of files that will go into the zip.
  const files = {
    "manifest.json": null,
    "index.json": null,
    "data/session.json": strToU8(JSON.stringify(sessionJson, null, 2)),
    "data/track.json": strToU8(JSON.stringify(trackJson, null, 2)),
    "data/anchors.json": strToU8(JSON.stringify(anchorsJson, null, 2)),
    ...(statsJson
      ? { "data/stats.json": strToU8(JSON.stringify(statsJson, null, 2)) }
      : {}),
    ...(userJson
      ? { "data/user.json": strToU8(JSON.stringify(userJson, null, 2)) }
      : {}),
    ...(settingsJson
      ? { "data/settings.json": strToU8(JSON.stringify(settingsJson, null, 2)) }
      : {}),
    // Raw video bytes (store/no-compress to avoid heavy CPU/memory)
    [pathVideoA]: [mediaA, { level: 0 }],
    [pathVideoB]: [mediaB, { level: 0 }],
  };

  // Build manifest.json: record size, sha256, and mime for every file.
  const manifestFiles = {};
  for (const [path, data] of Object.entries(files)) {
    if (path === "manifest.json" || path === "index.json") continue;

    // Support [Uint8Array, {level}] tuples
    const payload = Array.isArray(data) ? data[0] : data;

    // File size in bytes
    const bytes =
      payload instanceof Uint8Array ? payload.byteLength : payload?.length || 0;

    // MIME type: JSON for data/*, video mime for media/*
    const mime = path.startsWith("media/")
      ? path === pathVideoA
        ? videoMime(session.videoA.file)
        : videoMime(session.videoB.file)
      : mimeJSON;

    // Exact bytes to hash (handle Uint8Array views safely)
    const bufForHash =
      payload instanceof Uint8Array
        ? payload.byteOffset === 0 &&
          payload.byteLength === payload.buffer.byteLength
          ? payload.buffer
          : payload.slice().buffer
        : payload;

    // SHA-256 of the file contents
    const sha256 = await sha256Hex(bufForHash);

    // Save entry for this file in the manifest
    manifestFiles[path] = { bytes, sha256, mime };
  }

  // Minimal manifest
  const trackSlug = safeURL(
    trackJson?.name || session.track?.name || "unknown-track"
  );
  const manifest = {
    app: "LapGap",
    sessionId,
    trackSlug,
    files: manifestFiles,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

  // The main source of data for importer
  const index = {
    app: "LapGap",
    sessionId,
    trackSlug,
    pointers: {
      session: "data/session.json",
      track: "data/track.json",
      anchors: "data/anchors.json",
      stats: statsJson ? "data/stats.json" : null,
      user: userJson ? "data/user.json" : null,
      settings: settingsJson ? "data/settings.json" : null,
      videoA: pathVideoA,
      videoB: pathVideoB,
    },
  };
  files["index.json"] = strToU8(JSON.stringify(index, null, 2));

  // Zip everything client side (JSON compressed, videos stored)
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

// Date-only filename helper
export function buildDefaultPackFilename(
  trackName = "track",
  when = new Date()
) {
  const slug = safeURL(trackName || "track");
  const YYYY = when.getFullYear();
  const MM = String(when.getMonth() + 1).padStart(2, "0");
  const DD = String(when.getDate()).padStart(2, "0");
  return `lapgap-pack-${slug}-${DD}-${MM}-${YYYY}.zip`;
}
