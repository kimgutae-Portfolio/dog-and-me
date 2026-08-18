"use client";

import { useEffect } from "react";

const PHOTO_UPLOAD_GUIDE_STORAGE_KEY =
  "wan-memory:photo-upload-guide-seen:v1";

export function hasSeenPhotoUploadGuide() {
  try {
    return window.localStorage.getItem(PHOTO_UPLOAD_GUIDE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberPhotoUploadGuide() {
  try {
    window.localStorage.setItem(PHOTO_UPLOAD_GUIDE_STORAGE_KEY, "1");
  } catch {
    // Private browsing can block storage. The upload still continues safely.
  }
}

export function PhotoUploadGuideDialog({
  open,
  onClose,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="photo-guide-backdrop" role="presentation">
      <section
        aria-labelledby="photo-upload-guide-title"
        aria-modal="true"
        className="photo-guide-dialog photo-upload-first-guide"
        role="dialog"
      >
        <header>
          <span>写真を選ぶ前に</span>
          <button type="button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="photo-guide-content">
          <p className="eyebrow">FIRST PHOTO GUIDE</p>
          <h2 id="photo-upload-guide-title">
            愛犬だけが写った写真が、
            <br />いちばんきれいに仕上がります。
          </h2>
          <p>
            顔・体・毛色がよく見える写真ほど、その子らしさを活かして描けます。
          </p>
          <ul className="photo-upload-guide-list">
            <li>
              <strong>◎ いちばんおすすめ</strong>
              <span>愛犬だけが明るく、はっきり写っている写真</span>
            </li>
            <li>
              <strong>○ 人物と一緒</strong>
              <span>人物を除き、愛犬だけの場面として制作します</span>
            </li>
            <li>
              <strong>△ ご注意</strong>
              <span>人物で隠れた部分や背景の再構成が不自然になる場合があります</span>
            </li>
          </ul>
          <aside>
            迷ったら、愛犬だけが写った写真を1枚入れてください。
          </aside>
        </div>
        <footer>
          <button className="button button-outline" type="button" onClick={onClose}>
            あとで選ぶ
          </button>
          <button className="button button-primary" type="button" onClick={onContinue} autoFocus>
            写真を選ぶ
          </button>
        </footer>
      </section>
    </div>
  );
}
