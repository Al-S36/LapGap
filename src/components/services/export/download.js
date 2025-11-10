// Triggers a download for the given blob all client side
export function downloadBlob(blob, filename = "lapgap-pack.zip") {
  // Create a temporary in-memory URL that points to the Blob
  const url = URL.createObjectURL(blob);
  // Create a temporary <a> element with download attribute
  const tempLink = document.createElement("a");
  // Point the link at our Blob URL and define the filename
  tempLink.href = url;
  tempLink.download = filename;
  document.body.appendChild(tempLink);
  try {
    // Triggers the download
    tempLink.click();
  } finally {
    // Remove the element
    tempLink.remove();
    // To guarantee that the click uses the URL on every browser, defer invalidation
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
