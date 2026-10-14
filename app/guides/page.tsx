import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { guides } from "../components/SeoGuideLinks";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の思い出ガイド｜写真の整理・動画・記念日の残し方";
const description = "犬との思い出作り、写真の整理と保存、思い出動画、誕生日やうちの子記念日。愛犬との時間を残すためのWAN MEMORYガイドをテーマ別にご紹介します。";
export const metadata: Metadata = { title, description, alternates: { canonical: "/guides" } };

const topics = [
  { title: "毎日の思い出を作る・残す", paths: ["/inu-omoide-zukuri", "/aiken-omoide-douga", "/pet-loss-aiken-omoide"] },
  { title: "写真を整理して、作品にする", paths: ["/aiken-shashin-seiri", "/dog-photo-guide", "/aiken-shashin-douga"] },
  { title: "誕生日・うちの子記念日", paths: ["/dog-birthday-message", "/uchinoko-kinenbi-douga"] },
];

export default function GuidesPage() {
  return <InfoPage eyebrow="WAN MEMORY GUIDE" title="愛犬の思い出ガイド" lead="何気ない毎日も、特別な記念日も。写真と言葉を、ご家族が見返したくなる形に残すためのヒントをまとめました。">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(createGuideStructuredData({ path: "/guides", title, description })).replace(/</g, "\\u003c") }} />
    {topics.map(topic => <section key={topic.title}>
      <h2>{topic.title}</h2>
      <nav className="seo-guide-links" aria-label={topic.title}><div>
        {guides.filter(([, , path]) => topic.paths.includes(path)).map(([heading, copy, path]) => <Link href={path} key={path}><span>{heading}</span><small>{copy}</small><i aria-hidden="true">→</i></Link>)}
      </div></nav>
    </section>)}
    <section><h2>写真と思い出が、どんな作品になるのか</h2><p>ガイドを読んだあとは、モカの公開サンプルで絵本ページと完成映像をご覧いただけます。モカはサービスの内容を紹介するためのサンプルです。</p><Link className="text-link" href="/film/moka-demo">動く絵本と専用ホームページの制作例を見る →</Link></section>
  </InfoPage>;
}
