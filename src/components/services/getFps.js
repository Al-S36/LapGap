import MediaInfoFactory from "mediainfo.js";

// Caching the MediaInfo instance
let mediaInfoInitPromise = null;

// Connecting to the WASM file brute force style
function getWasmUrl() {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(
    `mediainfo/MediaInfoModule.wasm`,
    window.location.origin + base
  ).href;
}

async function createMediaInfo() {
  if (mediaInfoInitPromise) return mediaInfoInitPromise;

  const wasmUrl = getWasmUrl();

  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`[MI] Failed to fetch WASM at ${wasmUrl} (status ${response.status})`);
  }
  const wasmBinary = await response.arrayBuffer();

  mediaInfoInitPromise = MediaInfoFactory({
    format: "object",
    wasmBinary,
    locateFile: (path) => {
      const file = String(path).split("/").pop();
      return wasmUrl.replace("MediaInfoModule.wasm", file);
    },
  });

  return mediaInfoInitPromise;
}

// Validates and parses the FPS and parsing it as a string
function parseFpsString(str) {
  if (!str) return null;
  // cases when its (30000/1001) ie parantheses 
  const parenMatch = String(str).match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (parenMatch) {
    const frameRateNum = Number(parenMatch[1]),
      frameRateDen = Number(parenMatch[2]);
    if (frameRateDen) return frameRateNum / frameRateDen;
  }
  // cases when its 30000/1001
  const fractionMatch = String(str).match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const frameRateNum = Number(fractionMatch[1]),
      frameRateDen = Number(fractionMatch[2]);
    if (frameRateDen) return frameRateNum / frameRateDen;
  }
  // cases when its 29.970
  const decimalMatch = String(str).match(/[\d.]+/);
  return decimalMatch ? Number(decimalMatch[0]) : null;
}

// If FPS is within 1.5% of a standard frame rate it will be reassigned it
function snapToStandardFps(fps, tol = 0.015) {
  if (!fps || !isFinite(fps)) return null;
  const standardFpsValues = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
  for (const s of standardFpsValues) {
    if (Math.abs(fps - s) / s <= tol) return s;
  }
  return Number(fps.toFixed(3));
}

// Most accurate, reads the FPS from the file cointainer when possible
async function getFpsFromContainer(file) {
  const mi = await createMediaInfo();
  const result = await mi.analyzeData(
    () => file.size,
    (size, offset) =>
      new Promise((resolve, reject) => {
        const containerResponse = new FileReader();
        containerResponse.onload = () => resolve(new Uint8Array(containerResponse.result));
        containerResponse.onerror = reject;
        containerResponse.readAsArrayBuffer(file.slice(offset, offset + size));
      })
  );

  const video = result?.media?.track?.find((t) => t["@type"] === "Video");
  if (!video)
    return { fps: null, mode: null, source: "container", isNominal: false };

  const modeRaw = video.FrameRate_Mode || video.FrameRate_Mode_Original || null;
  const mode = modeRaw ? String(modeRaw).toUpperCase() : null;

  // Prefer original/nominal fields when present
  const fpsStr =
    video.OriginalFrameRate ||
    video.FrameRate ||
    video.FrameRate_Original ||
    null;

  // Some builds expose explicit numerator/denominator
  const frameRateNum = Number(video.FrameRate_Num);
  const frameRateDen = Number(video.FrameRate_Den);
  const fpsFromFraction =
    frameRateNum && frameRateDen ? frameRateNum / frameRateDen : null;

  const parsed = parseFpsString(fpsStr) ?? fpsFromFraction ?? null;
  const nominal = parsed ? snapToStandardFps(parsed) : null;

  // VFR: When the FPS is allowed to change throughout the video
  if (mode === "VFR") {
    return {
      fps: nominal,
      mode: "Variable Frame Rate",
      source: "container",
      isNominal: true,
    };
  }

  // CFR: When the FPS is constant throughout the video
  if (nominal) {
    return {
      fps: nominal,
      mode: "Constant Frame Rate",
      source: "container",
      isNominal: false,
    };
  }

  // Container had no usable data
  return { fps: null, mode, source: "container", isNominal: false };
}

// If the system couldnt retrieve the FPS it would try estimate the FPS by playback and calculations
async function estimateFpsByPlayback(file, sampleMs = 3000) {
  const url = URL.createObjectURL(file);
  try {
    const tempVideo = document.createElement("video");
    tempVideo.preload = "auto";
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.playbackRate = 1;
    tempVideo.src = url;

    // Wait until metadata is ready
    await new Promise((resolve, reject) => {
      tempVideo.onloadedmetadata = resolve;
      tempVideo.onerror = () => reject(new Error("Failed to load metadata"));
    });

    if (typeof tempVideo.requestVideoFrameCallback === "function") {
      let frameCount = 0;
      let startMediaTime = null;
      let lastMediaTime = null;
      let rvfcHandle = null;

      const onFrame = (_now, meta) => {
        const t = meta?.mediaTime ?? tempVideo.currentTime;
        if (startMediaTime === null) startMediaTime = t;
        lastMediaTime = t;
        frameCount++;
        rvfcHandle = tempVideo.requestVideoFrameCallback(onFrame);
      };

      rvfcHandle = tempVideo.requestVideoFrameCallback(onFrame);

      try {
        await tempVideo.play();
      } catch {
        return { fps: null, mode: null, source: null, isNominal: false };
      }

      await new Promise((resolve) => setTimeout(resolve, sampleMs));
      tempVideo.pause();

      // Correct API + variables
      if (rvfcHandle != null && typeof tempVideo.cancelVideoFrameCallback === "function") {
        tempVideo.cancelVideoFrameCallback(rvfcHandle);
      }

      const span = (lastMediaTime ?? 0) - (startMediaTime ?? 0);
      if (span > 0.5 && frameCount > 1) {
        const raw = frameCount / span;
        const snapped = snapToStandardFps(raw);

        return { fps: snapped, mode: null, source: "playback", isNominal: false };
      }
    }

    // If rvfc is missing, skip noisy wall-clock fallback
    return { fps: null, mode: null, source: null, isNominal: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Try get the FPS from container, otherwise estimate
export async function getFps(file) {
  const containerResult = await getFpsFromContainer(file);
  if (containerResult.fps || containerResult.mode === "VFR")
    return containerResult;

  return await estimateFpsByPlayback(file, 3000);
}

export default getFps;
