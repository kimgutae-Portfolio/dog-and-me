"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
          </span>
        </Link>
        <p className="eyebrow">問題が発生しました</p>
        <h1>読み込みに失敗しました</h1>
        <p className="auth-lead">
          お使いのブラウザで問題が発生しました。Safari や Chrome
          など標準のブラウザで開き直すか、下のボタンをお試しください。
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => reset()}
        >
          もう一度試す
        </button>
      </section>
    </main>
  );
}
