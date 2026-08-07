"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body>
        <main className="auth-page">
          <section className="auth-card">
            <p className="eyebrow">WAN MEMORY</p>
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
      </body>
    </html>
  );
}
