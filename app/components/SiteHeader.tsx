import Link from "next/link";
import { AuthNavLink } from "./AuthNavLink";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA, START_STORY_HREF } from "../lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ">
          <span className="brand-mark" aria-hidden="true">WM</span>
          <span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <Link href="/#memory-story">物語体験</Link>
          <Link href="/film/momo-demo">完成デモ</Link>
          <Link href="/#flow">制作の流れ</Link>
          <Link href="/#plans">プラン</Link>
          <Link href="/#faq">よくある質問</Link>
          <AuthNavLink />
        </nav>
        {APPLICATIONS_OPEN ? (
          <Link className="header-cta" href={START_STORY_HREF}>思い出をつくる <span aria-hidden="true">↗</span></Link>
        ) : (
          <span className="header-cta header-prelaunch" aria-label={PRELAUNCH_CTA}>現在準備中</span>
        )}
        <details className="mobile-nav">
          <summary aria-label="メニューを開閉"><span /><span /></summary>
          <nav aria-label="モバイルナビゲーション">
            <Link href="/#memory-story">物語体験</Link><Link href="/film/momo-demo">完成デモ</Link><Link href="/#flow">制作の流れ</Link><Link href="/#plans">プラン</Link><Link href="/#faq">よくある質問</Link><AuthNavLink />{APPLICATIONS_OPEN ? <Link href={START_STORY_HREF}>思い出をつくる</Link> : <span className="mobile-prelaunch-link">お申し込み受付は準備中</span>}
          </nav>
        </details>
      </div>
    </header>
  );
}
