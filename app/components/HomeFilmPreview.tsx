"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function HomeFilmPreview() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <div className="storybook-complete-preview-actions">
        <button
          className="storybook-complete-film-trigger"
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <span className="storybook-complete-film-trigger-image" aria-hidden="true">
            <Image
              src="/film/moka/05-storybook-lantern.webp"
              alt=""
              fill
              sizes="(max-width: 640px) 24vw, 180px"
            />
            <i>▶</i>
          </span>
          <span className="storybook-complete-film-trigger-copy">
            <small>COMPLETE FILM · 00:39</small>
            <strong>動画を見る</strong>
          </span>
          <span className="storybook-complete-film-trigger-arrow" aria-hidden="true">↗</span>
        </button>
        <Link className="storybook-complete-site-trigger" href="/film/moka-demo">
          <span className="storybook-complete-site-trigger-copy">
            <small>MOKA&apos;S WEBSITE</small>
            <strong>ホームページへ</strong>
          </span>
          <span className="storybook-complete-site-trigger-arrow" aria-hidden="true">↗</span>
        </Link>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="storybook-film-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="モカと五つの記憶の完成映像"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div className="storybook-film-dialog-panel">
                <button
                  className="storybook-film-dialog-close"
                  type="button"
                  aria-label="映像を閉じる"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
                <div className="storybook-film-dialog-heading">
                  <span>COMPLETE FILM · 00:39</span>
                  <strong>モカと、五つの記憶</strong>
                </div>
                <video
                  controls
                  autoPlay
                  preload="metadata"
                  playsInline
                  poster="/film/moka/05-storybook-lantern.webp"
                >
                  <source src="/film/moka/complete-film.mp4" type="video/mp4" />
                </video>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
