"use client";

import { useEffect, useRef, useState } from "react";

const FILM_SRC = "/film/hinata/film.mp4";
const FILM_POSTER = "/film/hinata/film-poster.jpg";

// Approximate start times (seconds) within the assembled film — see
// scripts/assemble_film.py's crossfade offsets for how these are derived.
const scenes = [
  { label: "OPENING", title: "ひなたと歩いた、いつもの季節", time: 0 },
  { label: "SCENE 01", title: "桜の花びらを追いかけた日", time: 8 },
  { label: "SCENE 02", title: "玄関で待っていてくれる夕方", time: 19 },
  { label: "SCENE 03", title: "水辺をゆっくり歩く休日", time: 30 },
  { label: "ENDING", title: "ひなたへ、大切な思い出を。", time: 41 },
] as const;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DemoFilmPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      let next = 0;
      for (let i = 0; i < scenes.length; i += 1) {
        if (video.currentTime >= scenes[i].time) next = i;
      }
      setSceneIndex(next);
    };
    const onLoadedMetadata = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended) video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
    }
  };

  const scene = scenes[sceneIndex];
  const total = duration || 48;

  return (
    <div className="demo-film-player" data-scene={sceneIndex + 1}>
      <video
        ref={videoRef}
        className="demo-film-video"
        src={FILM_SRC}
        poster={FILM_POSTER}
        playsInline
        preload="metadata"
      />
      <div className="demo-film-shade" aria-hidden="true" />
      <div className="demo-film-memory-wash" key={`wash-${sceneIndex}`} aria-hidden="true" />
      <div className="demo-film-floating-dust" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="demo-film-top"><span>WAN MEMORY · SAMPLE FILM</span><span>{formatTime(currentTime)} / {formatTime(total)}</span></div>
      <div className="demo-film-caption" key={scene.label} aria-live="polite"><small>{scene.label}</small><p>{scene.title}</p></div>
      <button type="button" className={playing ? "demo-film-control playing" : "demo-film-control"} onClick={togglePlayback} aria-label={playing ? "デモ映像を一時停止" : "デモ映像を再生"}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="demo-film-progress" aria-hidden="true"><span style={{ width: `${total ? (currentTime / total) * 100 : 0}%` }} /></div>
    </div>
  );
}
