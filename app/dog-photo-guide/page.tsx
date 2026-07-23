import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬のAI動画制作に適した写真の選び方";
const description = "犬の写真からAI動画を制作するときに必要な顔・全身・横向き写真の選び方を解説。外見を保ちやすい写真、避けたい写真、家族が写っている場合の扱いをご案内します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/dog-photo-guide" },
  openGraph: { title: `${title}｜WAN MEMORY`, description, url: "/dog-photo-guide", type: "article", locale: "ja_JP", images: [{ url: "/og.png", width: 1200, height: 630, alt: "愛犬のAI動画制作に適した写真選びガイド" }] },
};

const faqs = [
  ["写真は最低何枚必要ですか？", "WAN MEMORYでは合計5枚以上をお願いしています。思い出は2〜6項目登録でき、それぞれに同じ場面の写真を1〜5枚つなげられます。"],
  ["HEIC形式の写真も送れますか？", "はい。iPhoneで撮影したHEIC写真は、アップロード時に制作で扱えるJPG形式へ変換します。"],
  ["家族と一緒に写った写真も使えますか？", "提出できます。愛犬だけを切り抜く、人物の顔が分からない形で表現する、または元の写真をAIで動かさず使用する方法から選べます。人物の顔をAIで生成・再現する制作は行っていません。"],
] as const;

export default function DogPhotoGuidePage() {
  const structuredData = createGuideStructuredData({ path: "/dog-photo-guide", title, description, faqs });
  return (
    <InfoPage eyebrow="PHOTO GUIDE" title="愛犬の動画制作に適した、写真の選び方。" lead="枚数よりも大切なのは、顔・毛色・体型と、その場面らしさが分かること。外見を保ちやすい写真の基準をまとめました。">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト"><Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬写真の選び方</span></nav>

      <section className="seo-lead-panel"><p>AI動画では、元の写真に写っていない角度や身体の一部を正確に判断できません。異なる役割の写真を揃えることで、顔や体型の変化を抑えやすくなります。</p><ul><li>顔と目が鮮明に見える</li><li>毛色と模様が自然に見える</li><li>身体の一部が大きく切れていない</li><li>過度なフィルターや強い逆光がない</li></ul></section>

      <section><h2>まず揃えたい5種類の写真</h2><ol className="seo-photo-list"><li><span>01</span><div><strong>正面の顔</strong><p>目、鼻、口元、耳の位置がはっきり分かる写真。顔を維持する最も重要な基準です。</p></div></li><li><span>02</span><div><strong>立っている全身</strong><p>脚の長さ、胴体、体格が自然に分かる写真。服で身体が隠れすぎていないものがおすすめです。</p></div></li><li><span>03</span><div><strong>横向きとしっぽ</strong><p>横顔、背中、しっぽの長さと巻き方が分かる写真。余分な脚や長すぎるしっぽを防ぐ参考になります。</p></div></li><li><span>04</span><div><strong>その子らしい表情</strong><p>普段の目つき、首の傾け方、寝顔など、ご家族が「この子らしい」と感じる写真です。</p></div></li><li><span>05</span><div><strong>映像にしたい場面</strong><p>散歩、旅行、誕生日など、入力するエピソードと同じ場所・服・季節の写真を選びます。</p></div></li></ol></section>

      <section><h2>できれば避けたい写真</h2><div className="seo-card-grid"><article><strong>強い加工・フィルター</strong><p>本来の毛色や目の大きさを判断しにくくなります。</p></article><article><strong>身体が隠れている</strong><p>抱っこや毛布で全身が見えない写真だけでは体型を判断できません。</p></article><article><strong>ピントが合っていない</strong><p>顔が小さい、暗い、手ぶれした写真は基準写真に向きません。</p></article></div></section>

      <section><h2>毛の長さや服が写真ごとに違う場合</h2><p>トリミング前後や季節によって毛の長さが違っていても問題ありません。申し込み時に「最近の姿を基準にする」「思い出ごとに当時の姿を使う」「指定した時期の姿で統一する」から選べます。服を着た場面は、同じ服が写った写真をそのエピソードにつなげてください。</p></section>

      <section><h2>人物が写っている写真</h2><p>家族と一緒に写った写真も提出できます。ただしWAN MEMORYでは人物の顔をAIで新しく生成・再現しません。愛犬だけを切り抜く、顔が分からない後ろ姿・手元・足元・シルエットとして表現する、または元の家族写真を動かさず使用する方法を選んでいただきます。</p></section>

      <section className="seo-faq"><h2>写真の準備についてよくある質問</h2>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</section>

      <aside className="seo-cta"><p>申し込み画面でも、写真選びを順番にご案内します。</p><h2>5枚揃ったら、思い出づくりを始められます。</h2><div><StartStoryLink className="button button-primary">制作を相談する →</StartStoryLink><Link className="button button-outline" href="/aiken-omoide-douga">動画制作について見る</Link></div></aside>
      <SeoGuideLinks currentPath="/dog-photo-guide" />
    </InfoPage>
  );
}
