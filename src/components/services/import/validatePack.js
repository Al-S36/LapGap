import { unzipSync, strFromU8 } from "fflate";
import { sha256Hex } from "../export/hash.js";


// Here we validate the zip file the user uploads and ensure that all the data we need is there
// As well as much sure nothing is malicious and that the exported zip is from LapGap
export async function validatePack(zipBlob) {
  // Unzip into a map { path: Uint8Array }
  let files;
  try {
    const buffer = await zipBlob.arrayBuffer();
    files = unzipSync(new Uint8Array(buffer));
  } catch (e) {
    return { valid: false, error: "Not a valid zip" };
  }

  // Must have manifest and index present to import
  const nessecaryFiles = ["manifest.json", "index.json"];
  const missingTop = nessecaryFiles.filter((p) => !files[p]);
  if (missingTop.length) {
    return { valid: false, error: `Missing: ${missingTop.join(", ")}` };
  }

  // Parse manifest and index files
  let manifest, index;
  try {
    manifest = JSON.parse(strFromU8(files["manifest.json"]));
    index = JSON.parse(strFromU8(files["index.json"]));
  } catch {
    return { valid: false, error: "Invalid JSON in manifest/index" };
  }

  // Quick check that this is for the same app
  if (manifest.app !== "LapGap" || index.app !== "LapGap") {
    return { valid: false, error: "App mismatch" };
  }

  // Check required pointers exist and point to files
  const pointer = index.pointers || {};
  const requiredPointers = ["session", "track", "anchors", "videoA", "videoB"];
  for (const key of requiredPointers) {
    const path = pointer[key];
    if (!path || !files[path]) {
      return {
        valid: false,
        error: `Pointer missing: ${key} -> ${path || "(null)"}`,
      };
    }
  }
  // Optional pointers must point to files if present
  const optionalPointers = ["stats", "user", "settings"];
  for (const key of optionalPointers) {
    const path = pointer[key];
    if (path && !files[path]) {
      return { valid: false, error: `Pointer missing: ${key} -> ${path}` };
    }
  }

  // Verify manifest checksums and byte sizes for every listed file
  for (const [path, meta] of Object.entries(manifest.files || {})) {
    const data = files[path];
    if (!data) return { valid: false, error: `Listed not found: ${path}` };

    // Hash exactly the bytes of this entry (handle subarray views)
    const bufForHash =
      data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
        ? data.buffer
        : data.slice().buffer;

    const sha = await sha256Hex(bufForHash);
    if (sha !== meta.sha256)
      return { valid: false, error: `SHA mismatch: ${path}` };

    if (data.byteLength !== meta.bytes) {
      return { valid: false, error: `Byte mismatch: ${path}` };
    }
  }

  // require the core JSON data files to exist
  const mustHaveData = [
    "data/session.json",
    "data/track.json",
    "data/anchors.json",
  ];
  const missingData = mustHaveData.filter((p) => !files[p]);
  if (missingData.length) {
    return { valid: false, error: `Missing: ${missingData.join(", ")}` };
  }

  return { valid: true };
}
