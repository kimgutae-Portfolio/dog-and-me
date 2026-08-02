import Link from "next/link";
import { APPLICATIONS_OPEN, SUPPORT_EMAIL } from "../lib/site";
import { StartStoryLink } from "./StartStoryLink";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              WM
            </span>
            <span className="brand-type">
              WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
            </span>
          </Link>
          <p>愛犬との時間を、動くものがたりに。</p>
        </div>
        <div className="footer-links">
          <div>
            <p>SERVICE</p>
            <Link href="/aiken-omoide-douga">愛犬の動く絵本</Link>
            <Link href="/uchinoko-kinenbi-douga">うちの子記念日の物語</Link>
            <Link href="/film/miru-demo">動くページ</Link>
            <Link href="/#plans">プラン</Link>
            {APPLICATIONS_OPEN ? (
              <StartStoryLink>お申し込み</StartStoryLink>
            ) : (
              <span>お申し込み受付は準備中</span>
            )}
          </div>
          <div>
            <p>SUPPORT</p>
            <Link href="/dog-photo-guide">絵本の写真選び</Link>
            <Link href="/#faq">よくある質問</Link>
            <Link href="/studio">制作室</Link>
            <Link href="/contact">お問い合わせ</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </div>
          <div>
            <p>LEGAL</p>
            <Link href="/terms">利用規約</Link>
            <Link href="/privacy">プライバシーポリシー</Link>
            <Link href="/legal">特定商取引法に基づく表記</Link>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 WAN MEMORY</span>
        <span>Made for every small, precious moment.</span>
      </div>
    </footer>
  );
}
