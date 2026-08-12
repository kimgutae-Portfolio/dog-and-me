"use client";

import { useRef, useState } from "react";

type MiruBeforeAfterProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

export function MiruBeforeAfter({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
}: MiruBeforeAfterProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = (clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const next = ((clientX - bounds.left) / bounds.width) * 100;
    setPosition(Math.max(0, Math.min(100, next)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) updateFromClientX(event.clientX);
  };

  const handlePointerUp = () => setDragging(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPosition((current) => Math.max(0, current - step));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((current) => Math.min(100, current + step));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div
      ref={frameRef}
      className={`miru-before-after${dragging ? " is-dragging" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label={`${beforeAlt}と${afterAlt}の比較`}
    >
      <img className="miru-before-after-image" src={afterSrc} alt={afterAlt} />
      <div
        className="miru-before-after-before"
        style={{ width: `${position}%` }}
        aria-hidden="true"
      >
        <img
          className="miru-before-after-image"
          src={beforeSrc}
          alt=""
          style={{ width: position > 0 ? `${10000 / position}%` : "100%" }}
        />
      </div>
      <div
        className="miru-before-after-label miru-before-after-label-before"
        aria-hidden="true"
      >
        CUSTOMER PHOTO
        <small>元の写真</small>
      </div>
      <div
        className="miru-before-after-label miru-before-after-label-after"
        aria-hidden="true"
      >
        STORYBOOK PAGE
        <small>絵本の一ページ</small>
      </div>
      <div
        className="miru-before-after-divider"
        style={{ left: `${position}%` }}
        role="slider"
        tabIndex={0}
        aria-label="元写真と絵本ページの比較位置"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
      >
        <span aria-hidden="true">↔</span>
      </div>
    </div>
  );
}
