"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../lib/site";
import { StartStoryLink } from "./StartStoryLink";

type Pricing = {
  current_price: number;
  regular_price: number;
  launch_limit: number;
  launch_used: number;
  launch_remaining: number;
  campaign_active: boolean;
};

const fallback: Pricing = {
  current_price: MEMORY_FILM_PRICING.launchPrice,
  regular_price: MEMORY_FILM_PRICING.regularPrice,
  launch_limit: MEMORY_FILM_PRICING.launchLimit,
  launch_used: 0,
  launch_remaining: MEMORY_FILM_PRICING.launchLimit,
  campaign_active: true,
};

export function LivePriceCard() {
  const [pricing, setPricing] = useState(fallback);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getSupabaseBrowserClient()
        .rpc("get_memory_film_pricing")
        .then(({ data }) => {
          const row = Array.isArray(data) ? data[0] : data;
          if (row?.current_price) setPricing(row as Pricing);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <article className="price-card price-card-featured price-card-single">
      <div className="monitor-offer-head">
        <p className="plan-en">MOVING STORYBOOK</p>
        <span>
          {APPLICATIONS_OPEN
            ? pricing.campaign_active
              ? pricing.launch_used >= 3
                ? `初期${pricing.launch_limit}組限定 · モニター価格 · 残り${pricing.launch_remaining}組`
                : `初期${pricing.launch_limit}組限定 · モニター受付中`
              : "通常受付"
            : "正式公開準備中"}
        </span>
      </div>
      <h3>うちの子の動く絵本</h3>
      {pricing.campaign_active && (
        <p className="regular-price">
          通常価格 <del>¥{formatYen(pricing.regular_price)}（税込）</del>
        </p>
      )}
      <p className="price">
        <span>¥</span>
        {formatYen(pricing.current_price)}
        <small>税込</small>
      </p>
      <p className="price-caption">
        選んだ物語案を、水彩で描く約40秒の動く絵本に。
      </p>
      <p className="monitor-price-note">
        {!APPLICATIONS_OPEN
          ? "受付開始時の価格と制作枠は、正式公開のお知らせとあわせてご案内します。"
          : pricing.campaign_active
          ? `モニター受付終了後は ¥${formatYen(pricing.regular_price)}（税込）になります。`
          : "受付時に内容と納期をご確認いただき、制作を開始します。"}
      </p>
      <ul>
        <li>5つのエピソードから物語案2案</li>
        <li>選んだ1案の場面構成と文章</li>
        <li>水彩・ガッシュの絵本ページ制作</li>
        <li>全ページの事前確認・絵本3場面まで修正</li>
        <li>約40秒の動く絵本映像（5物語・各5秒）</li>
        <li>BGM・場面ごとの物語字幕</li>
        <li>完成映像も3場面まで修正</li>
        <li>公開期限・月額料金なしの専用ものがたりサイト</li>
      </ul>
      <p className="price-style-note">
        写真をそのまま動かす実写再現ではありません。愛犬の特徴とエピソードをもとに新しい絵本として描き、全ページをご確認いただいてから動きを加えます。
      </p>
      {APPLICATIONS_OPEN ? (
        <StartStoryLink className="button button-primary">
          {pricing.campaign_active
            ? "モニター価格で相談する"
            : "このプランで相談する"}
        </StartStoryLink>
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
