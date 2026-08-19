"use client";

import { useEffect, useRef, useState } from "react";

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
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const closeDialog = () => {
    setPage(0);
    onClose();
  };

  const continueToPhotos = () => {
    setPage(0);
    onContinue();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPage(0);
        onClose();
      }
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
          <span id="photo-upload-guide-title">写真を選ぶ前に</span>
          <button type="button" aria-label="閉じる" onClick={closeDialog}>
            ×
          </button>
        </header>
        <div
          className="photo-guide-content photo-upload-guide-viewport"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (startX === null || endX === undefined) return;
            const distance = endX - startX;
            if (distance < -45) setPage(1);
            if (distance > 45) setPage(0);
          }}
        >
          <div
            className="photo-upload-guide-track"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            <section
              aria-hidden={page !== 0}
              className="photo-upload-guide-slide"
            >
              <p className="eyebrow">FIRST PHOTO GUIDE · 1 / 2</p>
              <h2>
                愛犬だけが写った写真が、
                <br />いちばんきれいに仕上がります。
              </h2>
              <p>
                顔・体・毛色がよく見えるほど、その子らしさを活かして描けます。
              </p>
              <ul className="photo-upload-guide-list">
                <li>
                  <strong>◎ 明るさ</strong>
                  <span>明るく、ピントが合っている</span>
                </li>
                <li>
                  <strong>◎ 見え方</strong>
                  <span>顔と体が隠れず、全体がよく見える</span>
                </li>
              </ul>
              <aside>
                迷ったら、愛犬だけが写った写真を1枚入れてください。
              </aside>
            </section>
            <section
              aria-hidden={page !== 1}
              className="photo-upload-guide-slide"
            >
              <p className="eyebrow">FIRST PHOTO GUIDE · 2 / 2</p>
              <h2>人物と一緒の写真も、<br />お送りいただけます。</h2>
              <p>
                完成作品では人物を除き、愛犬だけの場面として背景を整えます。
              </p>
              <ul className="photo-upload-guide-list">
                <li>
                  <strong>○ 人物</strong>
                  <span>顔・体・服・影まで完成作品には描きません</span>
                </li>
                <li>
                  <strong>△ ご注意</strong>
                  <span>
                    背景が不自然になったり、愛犬が大きく隠れている場合は、その子らしさを十分に再現できないことがあります
                  </span>
                </li>
              </ul>
              <aside>あらかじめご了承ください。</aside>
            </section>
          </div>
        </div>
        <div className="photo-upload-guide-pagination" aria-label="案内 2ページ">
          {[0, 1].map((index) => (
            <button
              aria-label={`${index + 1}ページ目を表示`}
              aria-pressed={page === index}
              className={page === index ? "active" : ""}
              key={index}
              onClick={() => setPage(index)}
              type="button"
            />
          ))}
        </div>
        <footer>
          {page === 0 ? (
            <>
              <button className="button button-outline" type="button" onClick={closeDialog}>
                あとで選ぶ
              </button>
              <button className="button button-primary" type="button" onClick={() => setPage(1)} autoFocus>
                次へ
              </button>
            </>
          ) : (
            <>
              <button className="button button-outline" type="button" onClick={() => setPage(0)}>
                ← 戻る
              </button>
              <button className="button button-primary" type="button" onClick={continueToPhotos}>
                写真を選ぶ
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
