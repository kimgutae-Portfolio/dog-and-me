import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "./SiteFooter";

type Props = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

export function InfoPage({ eyebrow, title, lead, children }: Props) {
  return (
    <main className="info-page">
      <header className="info-header">
        <div className="shell">
          <Link className="brand" href="/" aria-label="WAN MEMORY トップへ">
            <span className="brand-mark" aria-hidden="true">WM</span>
            <span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span>
          </Link>
          <Link href="/">トップへ戻る</Link>
        </div>
      </header>
      <article className="info-shell">
        <div className="info-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
        <div className="info-content">{children}</div>
      </article>
      <SiteFooter />
    </main>
  );
}
