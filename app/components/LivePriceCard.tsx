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
  launch_remaining: number;
  campaign_active: boolean;
};

const fallback: Pricing = {
  current_price: MEMORY_FILM_PRICING.launchPrice,
  regular_price: MEMORY_FILM_PRICING.regularPrice,
  launch_limit: MEMORY_FILM_PRICING.launchLimit,
  launch_remaining: MEMORY_FILM_PRICING.launchLimit,
  campaign_active: true,
};

export function LivePriceCard() {
  const [pricing, setPricing] = useState(fallback);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getSupabaseBrowserClient().rpc("get_memory_film_pricing").then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.current_price) setPricing(row as Pricing);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <article className="price-card price-card-featured price-card-single">
      <div className="monitor-offer-head">
        <p className="plan-en">MEMORY FILM</p>
        <span>{APPLICATIONS_OPEN ? (pricing.campaign_active ? `先着${pricing.launch_limit}組 · 残り${pricing.launch_remaining}組` : "通常受付") : "正式公開準備中"}</span>
      </div>
      <h3>メモリーフィルム</h3>
      {pricing.campaign_active && <p className="regular-price">通常価格 <del>¥{formatYen(pricing.regular_price)}（税込）</del></p>}
      <p className="price"><span>¥</span>{formatYen(pricing.current_price)}<small>税込</small></p>
      <p className="price-caption">選んだ映像構成案を、記憶を描く約1分のメモリーフィルムに。</p>
      <p className="monitor-price-note">{pricing.campaign_active ? `初期${pricing.launch_limit}組の受付終了後は、通常価格 ¥${formatYen(pricing.regular_price)}（税込）になります。` : "受付時に内容と納期をご確認いただき、制作を開始します。"}</p>
      <ul><li>3つのエピソードから映像構成案2案</li><li>複数の場面で組み立てる約1分構成</li><li>選んだ1案の詳細構成</li><li>場面イメージの事前確認・調整2回</li><li>実写に近い愛犬と、絵画表現の背景・光</li><li>約1分の思い出映像</li><li>BGM・短い字幕</li><li>映像の修正2回</li><li>専用メモリーサイト</li></ul>
      <p className="price-style-note">完全な実写再現ではありません。AIで新しく制作する場面には、元写真と細部が異なる場合があります。場面イメージをご確認いただいてから映像化します。</p>
      {APPLICATIONS_OPEN ? (
        <StartStoryLink className="button button-primary">{pricing.campaign_active ? "モニター価格で相談する" : "このプランで相談する"}</StartStoryLink>
      ) : (
        <span className="button button-prelaunch" aria-disabled="true">{PRELAUNCH_CTA}</span>
      )}
      <p className="price-payment-note">相談時点では料金は発生しません。内容・納期・キャンセル条件をご確認後、制作開始前にStripeでカード決済となります。通常10〜14営業日でオンライン納品します。<Link href="/legal">販売条件を確認する</Link></p>
    </article>
  );
}
