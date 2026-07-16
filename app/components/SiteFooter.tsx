import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">WM</span>
            <span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span>
          </Link>
          <p>愛犬との時間を、一本の実写映画に。</p>
        </div>
        <div className="footer-links">
          <div><p>SERVICE</p><Link href="/film/momo-demo">完成デモ</Link><Link href="/#flow">制作の流れ</Link><Link href="/#plans">プラン</Link><Link href="/story">お申し込み</Link></div>
          <div><p>SUPPORT</p><Link href="/#faq">よくある質問</Link><Link href="/studio">制作室</Link><span>お問い合わせ</span></div>
          <div><p>LEGAL</p><span>利用規約</span><span>プライバシーポリシー</span><span>特定商取引法に基づく表記</span></div>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 WAN MEMORY</span><span>Made for every small, precious moment.</span></div>
    </footer>
  );
}
