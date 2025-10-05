// COmputes a SHA-256 hash of the input and returns it as lowercase hex string
// this will help on import to make sure the files are intact and not corrupted
export async function sha256Hex(input) {
  const data =
    // Normalize input to raw bytes for Web Crypto
    // if it's a Blob/File read it with .arrayBuffer(), otherwise UTF-8 encode String(input)
    input instanceof ArrayBuffer
      ? input
      : input instanceof Blob
      ? await input.arrayBuffer()
      : new TextEncoder().encode(String(input));

  // Hashing the input data to SHA-256 and returning the array
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
