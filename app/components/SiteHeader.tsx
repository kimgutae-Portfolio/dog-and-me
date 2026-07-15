import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="きみとの映画 トップへ">
          <span className="brand-mark" aria-hidden="true">き</span>
          <span className="brand-type">きみとの映画<small>OUR PAW FILM</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <a href="/#films">作品</a>
          <a href="/#flow">制作の流れ</a>
          <a href="/#plans">プラン</a>
          <a href="/#faq">よくある質問</a>
          <Link href="/studio">制作室</Link>
        </nav>
        <Link className="header-cta" href="/story">思い出をつくる <span aria-hidden="true">↗</span></Link>
        <details className="mobile-nav">
          <summary aria-label="メニューを開く"><span /><span /></summary>
          <nav aria-label="モバイルナビゲーション">
            <a href="/#films">作品</a><a href="/#flow">制作の流れ</a><a href="/#plans">プラン</a><a href="/#faq">よくある質問</a><Link href="/studio">制作室</Link><Link href="/story">思い出をつくる</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
