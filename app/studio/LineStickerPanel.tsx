"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type {
  LineStickerDelivery,
  MemoryOrder,
} from "../lib/supabase/types";

export const LINE_STICKER_CONSENT_VERSION = "2026-08-27-line-sticker-v1";

type Props = {
  order: MemoryOrder;
  delivery: LineStickerDelivery | null;
  previewUrl: string;
  canConsent: boolean;
  onChanged: () => Promise<void>;
};

const statusCopy: Record<LineStickerDelivery["status"], string> = {
  awaiting_consent: "同意内容の確認待ち",
  production: "制作中",
  ready: "完成データを保存しました",
  submitted: "LINE審査中",
  on_sale: "LINE STOREで販売中",
  stopped: "公開を停止しました",
};

export function LineStickerPanel({
  order,
  delivery,
  previewUrl,
  canConsent,
  onChanged,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const consented = Boolean(delivery?.consented_at);
  const completed = Boolean(delivery?.preview_asset_id && previewUrl);

  const acceptConsent = async () => {
    if (!accepted || saving) return;
    setSaving(true);
    setError("");
    const { error: consentError } = await getSupabaseBrowserClient().rpc(
      "accept_line_sticker_consent",
      {
        p_order_id: order.id,
        p_consent_version: LINE_STICKER_CONSENT_VERSION,
        p_accepted: true,
      },
    );
    if (consentError) {
      setError("同意内容を記録できませんでした。もう一度お試しください。");
    } else {
      setAccepted(false);
      setNotice("同意を記録しました。LINEスタンプの制作を進めます。");
      await onChanged();
    }
    setSaving(false);
  };

  return (
    <section className="studio-card line-sticker-card" id="line-stickers">
      <div className="line-sticker-heading">
        <div>
          <p className="eyebrow">UCHINOKO LINE STICKERS</p>
          <h2>{order.pet_name}ちゃんのLINEスタンプ 8種類</h2>
          <p>
            ホームページのミニキャラクターから、毎日使いやすい8種類を制作します。
            お客様からの文章指定や修正確認はありません。
          </p>
        </div>
        <div className="line-sticker-benefit">
          <span>オープン記念特典</span>
          <del>通常 ¥1,480相当</del>
          <strong>追加料金なし</strong>
        </div>
      </div>

      {notice && <p className="line-sticker-notice">{notice}</p>}
      {error && (
        <p className="line-sticker-notice error" role="alert">
          {error}
        </p>
      )}

      {!consented ? (
        <div className="line-sticker-consent">
          <div>
            <strong>制作前に、LINEでの登録・販売についてご確認ください</strong>
            <ul>
              <li>お預かりした写真から作ったキャラクターを、WAN MEMORY名義でLINE Creators Marketへ登録します。</li>
              <li>限定公開でも、販売URLを知っている方は閲覧・購入できます。</li>
              <li>販売管理と売上はWAN MEMORYに帰属し、お客様への分配はありません。</li>
              <li>完成後は、お客様もLINE STOREから別途購入してご利用いただきます。</li>
              <li>販売停止を希望できますが、停止前に購入した方は引き続き利用できます。</li>
            </ul>
          </div>
          {canConsent ? (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  上記内容と、AIで制作したキャラクターをLINEスタンプへ使用することに同意します。
                  <small>同意版 {LINE_STICKER_CONSENT_VERSION}</small>
                </span>
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={!accepted || saving}
                onClick={() => void acceptConsent()}
              >
                {saving ? "記録中…" : "同意して制作を申し込む →"}
              </button>
            </>
          ) : (
            <p className="readonly-preview-note">
              お客様の同意後に制作を開始できます。
            </p>
          )}
        </div>
      ) : (
        <div className={completed ? "line-sticker-result ready" : "line-sticker-result"}>
          {completed ? (
            <figure>
              <img
                src={previewUrl}
                alt={`${order.pet_name}ちゃんのLINEスタンプ8種類`}
              />
              <figcaption>完成した8種類のプレビュー</figcaption>
            </figure>
          ) : (
            <div className="line-sticker-placeholder" aria-hidden="true">
              <span>LINE</span>
              <strong>8</strong>
            </div>
          )}
          <div>
            <span className={`line-sticker-status ${delivery?.status ?? "production"}`}>
              {statusCopy[delivery?.status ?? "production"]}
            </span>
            <h3>
              {completed
                ? `${order.pet_name}ちゃんのスタンプができました。`
                : "キャラクターをもとに制作しています。"}
            </h3>
            <p>
              {completed
                ? "LINEへの審査・販売準備が進むと、この画面でお知らせします。"
                : "完成データが保存されると、ここに8種類のプレビューが表示されます。"}
            </p>
            {delivery?.status === "on_sale" && delivery.store_url && (
              <a
                className="button button-primary"
                href={delivery.store_url}
                target="_blank"
                rel="noreferrer"
              >
                LINE STOREで見る ↗
              </a>
            )}
            <small>
              LINEで利用する際は、LINE STOREでの購入が別途必要です。スタンプ内容の変更・修正受付はありません。
            </small>
          </div>
        </div>
      )}
    </section>
  );
}
