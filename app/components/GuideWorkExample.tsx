import Image from "next/image";
import { GuideWorkLink } from "./GuideWorkLink";

export function GuideWorkExample({ location }: { location: string }) {
  return <section>
    <h2>写真と思い出が、どんな絵本になるのか</h2>
    <p>公開サンプル「モカと、五つの記憶」では、秋の散歩道を一枚の絵本ページにしています。モカはサービス紹介用のサンプルで、お客様の実体験やレビューではありません。</p>
    <div className="guide-example-images">
      <figure><Image src="/film/moka/09-autumn-ginkgo.webp" alt="秋の銀杏の散歩道を歩くモカのサンプル写真" width={1447} height={1087} sizes="(max-width: 640px) 90vw, 400px" /><figcaption>元の写真：秋の散歩道</figcaption></figure>
      <figure><Image src="/film/moka/04-storybook-autumn.webp" alt="銀杏色の道とモカを水彩で描いた完成絵本ページ" width={1672} height={941} sizes="(max-width: 640px) 90vw, 400px" /><figcaption>完成した絵本ページ：銀杏色の散歩道</figcaption></figure>
    </div>
    <p>写真に残る毛色や姿、季節や場所を手がかりに、新しい絵本の場面として描きます。実際の制作では、ご家族から伺った出来事と気持ちを物語の文章にまとめ、絵と文章をご確認いただいてから動きを加えます。</p>
    <p>完成映像では、5つの場面を文章とBGMでつなぎます。写真を順番に表示するスライドショーとの違いは、実際の作品でご確認ください。</p>
    <GuideWorkLink className="button button-primary" location={location}>写真と思い出が、どんな作品になるか見る →</GuideWorkLink>
  </section>;
}
