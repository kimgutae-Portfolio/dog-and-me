import Link from "next/link";
import { formatYen, getMemoryPlan, type MemoryPlanId } from "../lib/pricing";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../lib/site";
import { StartStoryLink } from "./StartStoryLink";

export function LivePriceCard({ planId = "memory-film" }: { planId?: MemoryPlanId }) {
  const plan = getMemoryPlan(planId);
  return (
    <article className={`price-card price-card-single ${plan.includesWebsite ? "price-card-featured" : "price-card-video"}`}>
      <div className="monitor-offer-head">
        <p className="plan-en">{plan.includesWebsite ? "STORYBOOK + WEBSITE" : "STORYBOOK MOVIE"}</p>
        <span>
          {APPLICATIONS_OPEN ? "制作受付中" : "正式公開準備中"}
        </span>
      </div>
      <h3>{plan.name}</h3>
      <p className="price">
        <span>¥</span>
        {formatYen(plan.price)}
        <small>税込</small>
      </p>
      <p className="price-caption">
        {plan.includesWebsite
          ? "動く絵本と絵本ページを、その子だけのホームページで。完成後の写真も増やせます。"
          : "5つの思い出を、約40秒の動く絵本に。完成したMP4をスマートフォンに保存して楽しめます。"}
      </p>
      <ul>
        <li>5つの思い出から物語案2案</li>
        <li>約40秒のMP4・BGM・物語字幕</li>
        <li>動画化する全ページを事前確認</li>
        <li>絵と文章2場面・映像1場面まで修正</li>
        {plan.includesIllustrations && <li>水彩・ガッシュの絵本ページ5枚を納品</li>}
        {plan.includesWebsite && <li>専用ホームページ・写真アルバム・ミニキャラクター（公開期限・月額料金なし）</li>}
        {plan.includesLineStickers && <li className="price-line-sticker-benefit">
          <strong>うちの子LINEスタンプ8種類</strong>
        </li>}
      </ul>
      <p className="price-style-note">
        {plan.includesWebsite
          ? "LINEでの利用には、LINE STOREのスタンプ購入代金が別途必要です。"
          : "納品物は完成動画MP4です。絵本ページは動画化の前に制作室でご確認いただきます。"}
      </p>
      {APPLICATIONS_OPEN ? (
        <div className="consultation-action">
          <StartStoryLink className="button button-primary" planId={plan.planId} ctaLocation={`plan_${plan.planId}`}>
            このプランで制作を相談する
          </StartStoryLink>
        </div>
      ) : (
        <span className="button button-prelaunch" aria-disabled="true">
          {PRELAUNCH_CTA}
        </span>
      )}
      <p className="price-payment-note">
        {APPLICATIONS_OPEN
          ? "相談・物語案の確認後に決済。通常10〜14営業日で納品します。"
          : "現在はお申し込みとお支払いを受け付けていません。受付開始時に、内容・料金・納期・キャンセル条件を改めてご案内します。"}
        <Link href="/legal">販売条件を確認する</Link>
      </p>
    </article>
  );
}
