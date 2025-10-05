import { useEffect, useRef, useState } from "react";
import getFps from "./services/getFps";

// Responsible for the Upload section, allows the user to add the two videos
// and pulls all the meta data from the videos, it then sends the data to preview and stats

export default function UploadArea({ label = "Car", hint, onLoaded, value }) {
  // fileInputRef used to call the input
  const fileInputRef = useRef(null);
  // Store the vidoe metadata
  const [videoMetadata, setVideoMetadata] = useState(null);
  // Store the title of the video
  const [titleText, setTitleText] = useState(label);
  // Keeps trak of the last URL so metadata updates only with the latest files data
  const lastObjectUrlRef = useRef(null);

  // Sets video name to the title
  useEffect(() => {
    setTitleText(label);
  }, [label]);

  const revokeLastUrl = () => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0] || null;
    // Handle if no file was selected
    if (!selectedFile) {
      revokeLastUrl();
      setVideoMetadata(null);
      onLoaded?.(null);
      return;
    }

    // Preparing the new file
    revokeLastUrl();
    const objectUrl = URL.createObjectURL(selectedFile);
    lastObjectUrlRef.current = objectUrl;

    // Retrieving the videos metadata
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = objectUrl;

    // Storing the blob URL of the video being processed
    const token = objectUrl;

    // Once the metadata loads it retrieves and stores the data
    tempVideo.onloadedmetadata = async () => {
      // Attempting to get the FPS data
      let fpsInfo = { fps: null, mode: null, source: null };
      try {
        fpsInfo = (await getFps(selectedFile)) || fpsInfo;
      } catch {
        // Keeps FPS null if anything fails
      }

      // If user already picked another file during this time it causes the code to exit and ignore the irrelevent data
      if (lastObjectUrlRef.current !== token) return;
      // Building the metadata
      const metadata = {
        file: selectedFile,
        url: objectUrl,
        duration: tempVideo.duration || 0,
        width: tempVideo.videoWidth || 0,
        height: tempVideo.videoHeight || 0,
        fps:
          typeof fpsInfo.fps === "number"
            ? Number(fpsInfo.fps.toFixed(3))
            : null,
        fpsMode: fpsInfo.mode || null, // either Constant or Variable frame rate
        fpsSource: fpsInfo.source || null, // was the FPS from the source or estimated
        title: titleText,
      };
      setVideoMetadata(metadata);
      onLoaded?.(metadata);
    };
  };

  // Time formater, takes the lap time and formats it in mm:ss:mmm
  const timeFormatter = (lapTime) => {
    if (!lapTime || lapTime < 0) lapTime = 0;
    const minutes = Math.floor(lapTime / 60);
    const seconds = Math.floor(lapTime % 60);
    const milliseconds = Math.floor((lapTime - Math.floor(lapTime)) * 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}.${String(milliseconds).padStart(3, "0")}`;
  };

  // When component unmounts, revoke the last created object
  useEffect(() => () => revokeLastUrl(), []);

  // Preferred display source, external `value` from import
  const displayMeta = value ?? videoMetadata;

  return (
    <div className="upload-container">
      <div className="upload-title">
        <span className="pill">{titleText}</span>

        {hint && (
          <p className="muted" style={{ marginTop: 4 }}>
            {hint}
          </p>
        )}

        <div
          className="upload-actions"
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button className="btn" onClick={openFilePicker}>
            Choose video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            hidden
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {displayMeta?.file?.name || ""}
          </span>
        </div>
      </div>

      <div className="upload-meta" style={{ marginTop: 8 }}>
        {displayMeta ? (
          <div className="meta-grid">
            <div>
              <strong>Duration:</strong> {timeFormatter(displayMeta.duration)}
            </div>
            <div>
              <strong>Resolution:</strong> {displayMeta.width}×
              {displayMeta.height}px
            </div>
            <div>
              <strong>FPS:</strong>{" "}
              {displayMeta.fps ? (
                <>
                  {displayMeta.fps} fps
                  {displayMeta.fpsMode ? ` (${displayMeta.fpsMode})` : ""}
                  {displayMeta.fpsSource === "container" &&
                  displayMeta.isNominal
                    ? " • nominal"
                    : ""}
                  {displayMeta.fpsSource === "playback" ? " - estimated" : ""}
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
        ) : (
          <div className="placeholder">No file selected.</div>
        )}
      </div>
    </div>
  );
}
