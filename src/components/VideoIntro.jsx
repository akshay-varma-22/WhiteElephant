import { useEffect, useRef } from 'react';

const SRC = '/videos/interior-loop.mp4';
const POSTER = '/videos/interior-loop-poster.webp';
const LABEL =
  'Studio showreel: a softly lit bedroom, a living room, floor plans with material samples and the White Elephant Creative Studio logo';

/**
 * "Video intro": the studio's own clip, playing silently on a loop with no buttons.
 * It plays while it is on screen and rests while it is not, and visitors who ask their device for less motion
 * (prefers-reduced-motion) see its first frame instead. The words in the clip are part of the video itself.
 * To change the clip, replace public/videos/interior-loop.mp4 and interior-loop-poster.webp (see docs/OWNER_GUIDE.md).
 */
export default function VideoIntro() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let onScreen = typeof IntersectionObserver === 'undefined';
    let blocked = false;

    // Autoplay is only allowed for silent video, and React does not always write the muted attribute, so set it here.
    video.defaultMuted = true;
    video.muted = true;

    const play = () => {
      const started = video.play();
      if (started && started.catch) {
        started.catch((error) => {
          // A call to pause() cancelling a pending play() is normal; a refusal (data saver, low-power mode) is not.
          if (error && error.name === 'NotAllowedError') blocked = true;
        });
      }
    };
    const sync = () => {
      if (onScreen && !reduceMotion.matches) play();
      else video.pause();
    };
    // If the browser refused to start the clip by itself, the visitor touching it starts it.
    const retry = () => {
      if (blocked && !reduceMotion.matches) {
        blocked = false;
        play();
      }
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              onScreen = entry.isIntersecting;
              sync();
            },
            { threshold: 0.25 },
          );
    observer?.observe(video);
    reduceMotion.addEventListener('change', sync);
    video.addEventListener('pointerdown', retry);
    sync();

    return () => {
      observer?.disconnect();
      reduceMotion.removeEventListener('change', sync);
      video.removeEventListener('pointerdown', retry);
    };
  }, []);

  return (
    <section id="video" aria-label="Video introduction" className="video-intro">
      <div className="video-card">
        <video
          ref={videoRef}
          className="video-media"
          src={SRC}
          poster={POSTER}
          preload="metadata"
          loop
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          aria-label={LABEL}
        />
      </div>
    </section>
  );
}
