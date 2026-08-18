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
            愛犬がよく見える写真を
            <br />1枚入れてください。
          </h2>
          <p>
            担当者が候補から制作に使う1枚を選びます。この案内は初回だけ表示されます。
          </p>
          <ul className="photo-upload-guide-list">
            <li>
              <strong>◎ おすすめ</strong>
              <span>顔・体・毛色が明るく、ピントが合っている</span>
            </li>
            <li>
              <strong>○ 家族写真</strong>
              <span>送れますが、愛犬だけが見える写真も1枚追加</span>
            </li>
            <li>
              <strong>△ 避ける</strong>
              <span>暗い・ぼけている・顔や体が隠れている写真</span>
            </li>
          </ul>
          <aside>
            人物のお顔はAIイラストに使用・生成しません。
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
