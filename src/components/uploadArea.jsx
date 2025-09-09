import { useEffect, useRef, useState } from "react";

// Responsible for the Upload section, allows the user to add the two videos
// and pulls all the meta data from the videos, it then sends the data to preview and stats

export default function UploadArea({ label = "Car", hint, onLoaded }) {
  // fileInputRef used to call the input
  const fileInputRef = useRef(null);
  // Store the vidoe metadata
  const [videoMetadata, setVideoMetadata] = useState(null);
  // Sore the title of the video
  const [titleText, setTitleText] = useState(label);

  useEffect(() => {
    setTitleText(label);
  }, [label]);

  // Open and choose video from computer
  const openFilePicker = () => fileInputRef.current?.click();
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) {
      setVideoMetadata(null);
      onLoaded?.(null);
      return;
    }

    // Video meta data
    const objectUrl = URL.createObjectURL(selectedFile);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const metadata = {
        file: selectedFile,
        url: objectUrl,
        duration: tempVideo.duration || 0,
        width: tempVideo.videoWidth || 0,
        height: tempVideo.videoHeight || 0,
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
            {videoMetadata?.file?.name}
          </span>
        </div>
      </div>

      <div className="upload-meta" style={{ marginTop: 8 }}>
        {videoMetadata ? (
          <div className="meta-grid">
            <div>
              <strong>Duration:</strong> {timeFormatter(videoMetadata.duration)}
            </div>
            <div>
              <strong>Resolution:</strong> {videoMetadata.width}×
              {videoMetadata.height}px
            </div>
          </div>
        ) : (
          <div className="placeholder">No file selected.</div>
        )}
      </div>
    </div>
  );
}
