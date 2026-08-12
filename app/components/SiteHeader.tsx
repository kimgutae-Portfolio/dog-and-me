import Link from "next/link";
import { AuthNavLink } from "./AuthNavLink";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../lib/site";
import { StartStoryLink } from "./StartStoryLink";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ">
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <Link href="/#story-preview">絵本の世界</Link>
          <Link href="/film/moka-demo">動くページ</Link>
          <Link href="/#flow">制作の流れ</Link>
          <Link href="/#plans">プラン</Link>
          <Link href="/#faq">よくある質問</Link>
          <AuthNavLink />
        </nav>
        {APPLICATIONS_OPEN ? (
          <StartStoryLink className="header-cta">
            物語をつくる <span aria-hidden="true">↗</span>
          </StartStoryLink>
        ) : (
          <span
            className="header-cta header-prelaunch"
            aria-label={PRELAUNCH_CTA}
          >
            現在準備中
          </span>
        )}
        <details className="mobile-nav">
          <summary aria-label="メニューを開閉">
            <span />
            <span />
          </summary>
          <nav aria-label="モバイルナビゲーション">
            <Link href="/#story-preview">絵本の世界</Link>
            <Link href="/film/moka-demo">動くページ</Link>
            <Link href="/#flow">制作の流れ</Link>
            <Link href="/#plans">プラン</Link>
            <Link href="/#faq">よくある質問</Link>
            <AuthNavLink />
            {APPLICATIONS_OPEN ? (
              <StartStoryLink>物語をつくる</StartStoryLink>
            ) : (
              <span className="mobile-prelaunch-link">
                お申し込み受付は準備中
              </span>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
