"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

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
        <span>{pricing.campaign_active ? `先着${pricing.launch_limit}組 · 残り${pricing.launch_remaining}組` : "通常受付"}</span>
      </div>
      <h3>メモリーフィルム</h3>
      {pricing.campaign_active && <p className="regular-price">通常価格 <del>¥{formatYen(pricing.regular_price)}</del></p>}
      <p className="price"><span>¥</span>{formatYen(pricing.current_price)}<small>税込</small></p>
      <p className="price-caption">選んだコンセプトを、約1分の映画に。</p>
      <p className="monitor-price-note">{pricing.campaign_active ? `初期${pricing.launch_limit}組の受付終了後は、通常価格 ¥${formatYen(pricing.regular_price)}（税込）になります。` : "受付時に内容と納期をご確認いただき、制作を開始します。"}</p>
      <ul><li>映像コンセプト2案</li><li>映画タイプ別の共通エンディング</li><li>選んだ1案の詳細構成</li><li>約1分の実写風映像</li><li>ナレーション・字幕</li><li>修正2回</li><li>専用メモリーサイト</li></ul>
      <Link className="button button-primary" href="/story">{pricing.campaign_active ? "モニター価格で相談する" : "このプランで相談する"}</Link>
    </article>
  );
}
