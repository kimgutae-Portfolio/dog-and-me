import Link from "next/link";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../lib/site";
import { StartStoryLink } from "./StartStoryLink";

export function LivePriceCard() {
  return (
    <article className="price-card price-card-featured price-card-single">
      <div className="monitor-offer-head">
        <p className="plan-en">STORYBOOK + WEBSITE</p>
        <span>
          {APPLICATIONS_OPEN ? "制作受付中" : "正式公開準備中"}
        </span>
      </div>
      <h3>うちの子の動く絵本＋専用ホームページ</h3>
      <p className="price">
        <span>¥</span>
        {formatYen(MEMORY_FILM_PRICING.price)}
        <small>税込</small>
      </p>
      <p className="price-caption">
        5つの思い出を、水彩で描く約40秒の動く絵本に。絵本ページと専用ホームページまで一緒にお届けします。
      </p>
      <ul>
        <li>5つのエピソードから物語案2案</li>
        <li>選んだ1案の場面構成と文章</li>
        <li>水彩・ガッシュの絵本ページ5枚</li>
        <li>全ページの事前確認・絵本2場面まで修正</li>
        <li>5つの思い出をつないだ約40秒の動く絵本</li>
        <li>写真を追加して育てられる専用ホームページ（公開期限・月額料金なし）</li>
        <li>BGM・場面ごとの物語字幕</li>
        <li>完成映像は1場面まで修正</li>
        <li className="price-line-sticker-benefit">
          <strong>うちの子LINEスタンプ8種類</strong>
        </li>
      </ul>
      <p className="price-style-note">
        写真をそのまま動かす実写再現ではありません。愛犬の特徴とエピソードをもとに新しい絵本として描き、全ページをご確認いただいてから動きを加えます。
      </p>
      {APPLICATIONS_OPEN ? (
        <div className="consultation-action">
          <p className="consultation-steps">お名前 → 無料登録 → 写真と思い出を入力</p>
          <StartStoryLink className="button button-primary">
            うちの子の制作相談を始める
          </StartStoryLink>
        </div>
      ) : (
        <span className="button button-prelaunch" aria-disabled="true">
          {PRELAUNCH_CTA}
        </span>
      )}
      <p className="price-payment-note">
        {APPLICATIONS_OPEN
          ? "相談時点では料金は発生しません。物語案を選び、内容・納期・キャンセル条件をご確認後、そのままカードでお支払いいただきます。通常10〜14営業日でオンライン納品します。"
          : "現在はお申し込みとお支払いを受け付けていません。受付開始時に、内容・料金・納期・キャンセル条件を改めてご案内します。"}
        <Link href="/legal">販売条件を確認する</Link>
      </p>
    </article>
  );
}
