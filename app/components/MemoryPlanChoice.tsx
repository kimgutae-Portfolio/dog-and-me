"use client";

import {
  formatYen,
  getMemoryPlan,
  type MemoryPlanId,
} from "../lib/pricing";
import styles from "./MemoryPlanChoice.module.css";

const planIds: MemoryPlanId[] = ["video-only", "memory-film"];

type Props = {
  planId: MemoryPlanId;
  onChange: (planId: MemoryPlanId) => void;
  disabled?: boolean;
};

export function MemoryPlanChoice({ planId, onChange, disabled = false }: Props) {
  return (
    <fieldset className={styles.root} disabled={disabled}>
      <legend>制作プランを選ぶ</legend>
      <p>どちらも、五つの思い出から約40秒の動く絵本を制作します。</p>
      <div className={styles.options}>
        {planIds.map((id) => {
          const plan = getMemoryPlan(id);
          return (
            <label className={planId === id ? styles.selected : undefined} key={id}>
              <input
                type="radio"
                name="memory-plan"
                value={id}
                checked={planId === id}
                onChange={() => onChange(id)}
              />
              <span className={styles.content}>
                <strong>{plan.name}</strong>
                <span className={styles.price}>¥{formatYen(plan.price)}<small>税込</small></span>
                <span className={styles.description}>
                  {plan.includesWebsite
                    ? "完成動画・絵本ページ5枚・専用ホームページ・キャラクター・LINEスタンプ8種類"
                    : "完成動画をMP4でお届け。スマホに保存して、何度でも楽しめます。"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
