"use client";
import { useRef, useState } from "react";
export type ClipZoom = { x: number; y: number; scale: number };
export const DEFAULT_ZOOM: ClipZoom = { x: 0.5, y: 0.5, scale: 1 };
export function ClipZoomEditor({ src, value, disabled, onChange }: { src: string; value: ClipZoom; disabled: boolean; onChange: (value: ClipZoom) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [ratio, setRatio] = useState(16 / 9);
  const [selecting, setSelecting] = useState(false);
  const scale = 1 + (value.scale - 1) * progress;
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ position: "relative", overflow: "hidden", aspectRatio: ratio, background: "#000" }}>
      <video ref={video} src={src} playsInline preload="metadata"
        style={{ width: "100%", height: "100%", display: "block", transform: selecting ? "none" : `scale(${scale})`, transformOrigin: `${value.x * 100}% ${value.y * 100}%` }}
        onLoadedMetadata={e => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight || 16 / 9)}
        onTimeUpdate={e => { setProgress(Math.min(1, e.currentTarget.currentTime / 5)); if (e.currentTarget.currentTime >= 5) e.currentTarget.pause(); }} />
      {selecting && <button type="button" aria-label="拡大する位置を選択" disabled={disabled}
        style={{ position: "absolute", inset: 0, width: "100%", border: 0, background: "transparent", cursor: "crosshair" }}
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onChange({ ...value, x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }); }}>
        <span style={{ position: "absolute", left: `${value.x * 100}%`, top: `${value.y * 100}%`, transform: "translate(-50%, -50%)", color: "white", textShadow: "0 0 3px black", fontSize: 28 }}>＋</span>
      </button>}
    </div>
    <label>再生位置
      <input aria-label="ズームプレビューの再生位置" type="range" min="0" max="5" step="0.01" value={progress * 5} disabled={disabled} style={{ width: "100%" }} onChange={e => { const t = Number(e.target.value); setProgress(t / 5); if (video.current) { video.current.pause(); video.current.currentTime = Math.min(t, video.current.duration || 5); } }} />
    </label>
    <label>徐々にズーム · 1倍 → {value.scale.toFixed(1)}倍
      <input aria-label="終了時の拡大倍率" type="range" min="1" max="2" step="0.1" value={value.scale} disabled={disabled} onChange={e => onChange({ ...value, scale: Number(e.target.value) })} style={{ width: "100%" }} />
    </label>
    <button type="button" className="button button-outline" disabled={disabled} onClick={() => { video.current?.pause(); setSelecting(!selecting); }}>{selecting ? "位置を確定" : "拡大する位置を選ぶ"}</button>
    {selecting && <small>映像の中をクリック・タップして位置を指定してください。</small>}
    <button type="button" className="button button-outline" disabled={disabled} onClick={() => { setSelecting(false); setProgress(0); if (video.current) { video.current.currentTime = 0; void video.current.play().catch(() => {}); } }}>ズームをプレビュー</button>
    <small>5秒かけて指定位置へ拡大します。1倍でズームなし。設定はこのブラウザに保存され、次の編集結果に反映されます。</small>
  </div>;
}
