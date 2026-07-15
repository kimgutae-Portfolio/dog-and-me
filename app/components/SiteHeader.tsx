import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ">
          <span className="brand-mark" aria-hidden="true">WM</span>
          <span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span>
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
