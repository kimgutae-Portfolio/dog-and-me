"use client";

import { useRef, useState } from "react";

export function MiruStorybookPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended) video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
    }
  };

  return (
    <div className="miru-book-player">
      <video
        ref={videoRef}
        src="/film/miru/spring-letter.mp4"
        poster="/film/miru/01-spring-letter.jpg"
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="miru-book-player-shade" aria-hidden="true" />
      <p>春の日、小さな手紙が届きました。</p>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "動く絵本を一時停止" : "動く絵本を再生"}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <span>SCENE 01 · 00:05</span>
    </div>
  );
}
