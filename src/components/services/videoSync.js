// Waits until a video is ready to play (metadata + decode)
export function videoIsLoaded(video) {
  return new Promise((resolve) => {
    if (!video) return resolve();
    if (video.readyState >= 2) return resolve();
    const onCanPlay = () => {
      video.removeEventListener("canplay", onCanPlay);
      resolve();
    };
    video.addEventListener("canplay", onCanPlay);
  });
}

// snap B to A on the very first decoded frame after resume
export function snapOnFirstFrame(videoA, videoB) {
  if (
    !videoA ||
    !videoB ||
    typeof videoA.requestVideoFrameCallback !== "function"
  )
    return;
  videoA.requestVideoFrameCallback(() => {
    videoB.currentTime = videoA.currentTime;
  });
}

// Playback controls
export async function playBoth(videoA, videoB) {
  if (!videoA || !videoB) return;

  // make sure both have data ready
  await Promise.all([videoIsLoaded(videoA), videoIsLoaded(videoB)]);
  // start from the exact same timestamp
  videoB.currentTime = videoA.currentTime;
  // reset correction state
  videoB.playbackRate = 1;
  // eliminate start jitter on the first decoded frame
  snapOnFirstFrame(videoA, videoB);

  await Promise.allSettled([videoA.play(), videoB.play()]);
}

export function pauseBoth(videoA, videoB) {
  videoA?.pause();
  videoB?.pause();
  if (videoA && videoB) videoB.currentTime = videoA.currentTime;
}

export function resetBoth(videoA, videoB) {
  pauseBoth(videoA, videoB);
  if (videoA) videoA.currentTime = 0;
  if (videoB) videoB.currentTime = 0;
}
