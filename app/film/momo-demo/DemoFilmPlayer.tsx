"use client";

import { useEffect, useState } from "react";

const scenes = [
  { label: "SCENE 01", title: "小さな君が、家族になった春。", time: "00:08" },
  { label: "SCENE 02", title: "名前を呼ぶと、いつも振り向いた。", time: "00:22" },
  { label: "SCENE 03", title: "季節が変わっても、散歩道は一緒。", time: "00:41" },
  { label: "ENDING", title: "これからも一緒に、ゆっくり歩こうね。", time: "01:02" },
] as const;

export function DemoFilmPlayer() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (scene < scenes.length - 1) setScene((current) => current + 1);
      else setPlaying(false);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [playing, scene]);

  const togglePlayback = () => {
    if (!playing && scene === scenes.length - 1) setScene(0);
    setPlaying((current) => !current);
  };

  const current = scenes[scene];

  return (
    <div className="demo-film-player" data-scene={scene + 1}>
      <div className="demo-film-scene" aria-hidden="true" />
      <div className="demo-film-shade" aria-hidden="true" />
      <div className="demo-film-memory-wash" key={`wash-${scene}`} aria-hidden="true" />
      <div className="demo-film-floating-dust" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="demo-film-top"><span>WAN MEMORY · SAMPLE FILM</span><span>{current.time} / 01:02</span></div>
      <div className="demo-film-caption" key={current.label} aria-live="polite"><small>{current.label}</small><p>{current.title}</p></div>
      <button type="button" className={playing ? "demo-film-control playing" : "demo-film-control"} onClick={togglePlayback} aria-label={playing ? "デモ映像を一時停止" : "デモ映像を再生"}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="demo-film-progress" aria-hidden="true"><span style={{ width: `${((scene + 1) / scenes.length) * 100}%` }} /></div>
    </div>
  );
}
