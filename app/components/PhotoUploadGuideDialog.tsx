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
            愛犬がはっきり見える写真を
            <br />1枚以上入れてください。
          </h2>
          <p>
            お送りいただいた候補から、担当者が物語の制作に使う1枚を選びます。
            次回から、この案内は表示されません。
          </p>
          <ul className="photo-upload-guide-list">
            <li>
              <strong>おすすめ</strong>
              <span>愛犬の顔・体・毛色が明るく、ピントが合っている写真</span>
            </li>
            <li>
              <strong>家族写真</strong>
              <span>
                一緒に写った写真も送れますが、制作候補には愛犬だけがよく見える写真も1枚入れてください
              </span>
            </li>
            <li>
              <strong>避けたい写真</strong>
              <span>強いぼけ、暗すぎる写真、顔や体が大きく隠れた写真、強い加工や文字入り画像</span>
            </li>
          </ul>
          <aside>
            人物のお顔はAIイラストに使用・生成しません。正面の家族写真だけでは、自然な場面を制作できない場合があります。
          </aside>
        </div>
        <footer>
          <button className="button button-outline" type="button" onClick={onClose}>
            あとで選ぶ
          </button>
          <button className="button button-primary" type="button" onClick={onContinue} autoFocus>
            確認して写真を選ぶ
          </button>
        </footer>
      </section>
    </div>
  );
}
