"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { uploadLifetimeAlbumImages } from "../lib/supabase/uploads";
import type {
  Delivery,
  MemoryOrder,
  MemoryShare,
  OrderAsset,
} from "../lib/supabase/types";

type Props = {
  order: MemoryOrder;
  delivery: Delivery | null;
  assets: OrderAsset[];
  onChanged: () => Promise<void>;
};

function shareRow(data: unknown): MemoryShare | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<MemoryShare>;
  return typeof candidate.code === "string" &&
    typeof candidate.active === "boolean" &&
    typeof candidate.customer_slug === "string" &&
    typeof candidate.pet_slug === "string"
    ? {
        code: candidate.code,
        active: candidate.active,
        customer_slug: candidate.customer_slug,
        pet_slug: candidate.pet_slug,
      }
    : null;
}

export function MemoryShareManager({
  order,
  delivery,
  assets,
  onChanged,
}: Props) {
  const [share, setShare] = useState<MemoryShare | null>(null);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [copyPopup, setCopyPopup] = useState(false);
  const [error, setError] = useState("");

  const photos = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "source_image")
        .sort(
          (a, b) =>
            a.album_sort_order - b.album_sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const visiblePhotos = photos.filter((asset) => asset.album_visible);
  const addedPhotos = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "album_photo")
        .sort(
          (a, b) =>
            a.album_sort_order - b.album_sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const previewPhotos = useMemo(
    () => [...photos, ...addedPhotos],
    [addedPhotos, photos],
  );
  const shareUrl =
    share?.customer_slug && share?.pet_slug && origin
      ? `${origin}/${encodeURIComponent(share.customer_slug)}/${encodeURIComponent(share.pet_slug)}`
      : "";
  const siteReady = order.status === "delivered" && Boolean(delivery);

  useEffect(() => {
    if (!copyPopup) return;
    const timer = window.setTimeout(() => setCopyPopup(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copyPopup]);

  useEffect(() => {
    if (!previewPhotos.length) return;
    const supabase = getSupabaseBrowserClient();
    supabase.storage
      .from("order-assets")
      .createSignedUrls(
        previewPhotos.map((asset) => asset.storage_path),
        3600,
      )
      .then(({ data }) => {
        const next: Record<string, string> = {};
        data?.forEach((result, index) => {
          if (result.signedUrl)
            next[previewPhotos[index].id] = result.signedUrl;
        });
        setPreviewUrls(next);
      });
  }, [previewPhotos]);

  const manageShare = useCallback(
    async (action: "get" | "enable" | "disable" | "rotate") => {
      const { data, error: shareError } = await getSupabaseBrowserClient().rpc(
        "manage_memory_site",
        {
          p_order_id: order.id,
          p_action: action,
        },
      );
      if (shareError) throw shareError;
      const next = shareRow(data);
      if (!next) throw new Error("share link was not returned");
      setShare(next);
      return next;
    },
    [order.id],
  );

  useEffect(() => {
    if (!siteReady) return;
    const timer = window.setTimeout(() => {
      manageShare("get").catch(() =>
        setError("共有リンクの情報を読み込めませんでした。"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [siteReady, manageShare]);

  const updatePhoto = async (
    asset: OrderAsset,
    changes: Partial<
      Pick<OrderAsset, "album_visible" | "album_caption" | "album_sort_order">
    >,
  ) => {
    setWorking(true);
    setError("");
    const { error: updateError } = await getSupabaseBrowserClient()
      .from("assets")
      .update(changes)
      .eq("id", asset.id)
      .eq("order_id", order.id);
    if (updateError)
      setError("写真の設定を保存できませんでした。");
    else await onChanged();
    setWorking(false);
  };

  const togglePhoto = async (asset: OrderAsset) => {
    await updatePhoto(asset, { album_visible: !asset.album_visible });
  };

  const movePhoto = async (asset: OrderAsset, direction: -1 | 1) => {
    const index = photos.findIndex((item) => item.id === asset.id);
    const target = photos[index + direction];
    if (!target) return;
    setWorking(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const [first, second] = await Promise.all([
      supabase
        .from("assets")
        .update({ album_sort_order: target.album_sort_order })
        .eq("id", asset.id),
      supabase
        .from("assets")
        .update({ album_sort_order: asset.album_sort_order })
        .eq("id", target.id),
    ]);
    if (first.error || second.error)
      setError("写真の順番を変更できませんでした。");
    else await onChanged();
    setWorking(false);
  };

  const deletePhoto = async (asset: OrderAsset) => {
    if (!window.confirm("この写真を制作室とアルバムから削除しますか？")) return;
    setWorking(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage
      .from("order-assets")
      .remove([asset.storage_path]);
    if (storageError) setError("写真ファイルを削除できませんでした。");
    else {
      const { error: recordError } = await supabase
        .from("assets")
        .delete()
        .eq("id", asset.id)
        .eq("order_id", order.id);
      if (recordError) setError("写真情報を削除できませんでした。");
      else {
        setNotice("写真を削除しました。");
        await onChanged();
      }
    }
    setWorking(false);
  };

  const uploadAlbumPhotos = async (files: File[]) => {
    if (!files.length || working || !siteReady) return;
    setWorking(true);
    setError("");
    setNotice(`0 / ${files.length}枚を追加しています…`);
    setUploadProgress(0);
    try {
      await uploadLifetimeAlbumImages(
        getSupabaseBrowserClient(),
        order.user_id,
        order.id,
        files,
        (completed, total) => {
          setUploadProgress(Math.round((completed / total) * 100));
          setNotice(`${completed} / ${total}枚を追加しています…`);
        },
      );
      setNotice(`${files.length}枚の新しい思い出を追加しました。`);
      await onChanged();
    } catch (caught) {
      setError(
        caught && typeof caught === "object" && "message" in caught
          ? String(caught.message)
          : "写真を追加できませんでした。",
      );
    } finally {
      setWorking(false);
      setUploadProgress(0);
    }
  };

  const deleteAddedPhoto = async (asset: OrderAsset) => {
    if (!window.confirm("この写真をアルバムから削除しますか？")) return;
    setWorking(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage
      .from("order-assets")
      .remove([asset.storage_path]);
    const { error: recordError } = storageError
      ? { error: storageError }
      : await supabase.rpc("delete_lifetime_album_photo", {
          p_asset_id: asset.id,
        });
    if (storageError || recordError)
      setError("写真を削除できませんでした。もう一度お試しください。");
    else {
      setNotice("写真をアルバムから削除しました。");
      await onChanged();
    }
    setWorking(false);
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyPopup(true);
    } catch {
      setError("URLをコピーできませんでした。URLを長押ししてコピーしてください。");
    }
  };

  const openShareSheet = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: `${order.pet_name}との思い出｜WAN MEMORY`,
        text: `${order.pet_name}の動く絵本を見られる専用ものがたりサイトです。`,
        url: shareUrl,
      });
    } else {
      await copyShareUrl();
    }
  };

  return (
    <section className="studio-card memory-share-manager">
      {copyPopup && (
        <div className="share-copy-popup" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>URLをコピーしました</strong>
            <small>ご家族へそのまま送れます。</small>
          </div>
        </div>
      )}
      <div className="family-share-panel" id="personal-homepage">
        <div>
          <p className="eyebrow">YOUR DOG&apos;S WEBSITE</p>
          <h3>このURLが、その子だけのホームページです。</h3>
          <p>
            ご家族も同じURLから、ログインせずに完成映像・写真・キャラクターを楽しめます。検索結果には表示されません。
          </p>
        </div>
        {!siteReady ? (
          <div className="family-share-waiting">
            <strong>完成映像の納品後に利用できます</strong>
            <small>完成すると、専用ホームページが自動で公開されます。</small>
          </div>
        ) : (
          <div className="family-share-controls">
            <div className="share-status">
              <span className="active">公開中</span>
              <code>{shareUrl || "専用URLを準備しています…"}</code>
            </div>
            <div>
              <label className="button album-manage-button">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  disabled={working}
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                    void uploadAlbumPhotos(files);
                  }}
                />
                <span>
                  {working && uploadProgress > 0
                    ? `写真を追加中 ${uploadProgress}%`
                    : "新しい写真を追加"}
                </span>
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={working || !shareUrl}
                onClick={copyShareUrl}
              >
                URLをコピー
              </button>
              <button
                className="button button-outline"
                type="button"
                disabled={working || !shareUrl}
                onClick={openShareSheet}
              >
                LINEなどで共有
              </button>
              {shareUrl && (
                <a
                  className="button button-cream"
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  ホームページを開く ↗
                </a>
              )}
            </div>
            <small>
              写真の追加はログイン中のご本人だけが行えます。公開期限や月額料金なく、このURLをそのまま使い続けられます。
            </small>
          </div>
        )}
      </div>
      {notice && (
        <p className="memory-manager-message">
          {notice}
          <button type="button" onClick={() => setNotice("")}>
            ×
          </button>
        </p>
      )}
      {error && (
        <p className="memory-manager-message error" role="alert">
          {error}
        </p>
      )}
      {siteReady && (
        <div className="studio-lifetime-album" id="studio-album-manager">
          <div className="card-head">
            <div>
              <p className="eyebrow">GROWING PHOTO ALBUM</p>
              <h2>完成後の写真を、この制作室で管理</h2>
            </div>
            <span>追加した写真 {addedPhotos.length}枚</span>
          </div>
          <p className="memory-manager-lead">
            上の「新しい写真を追加」から、その後の日々も残せます。追加した写真は専用ホームページの写真帖へ自動で反映されます。
          </p>
          {addedPhotos.length ? (
            <div className="album-manager-grid">
              {addedPhotos.map((asset) => (
                <article className="album-manager-item selected" key={asset.id}>
                  <div className="album-manager-image">
                    {previewUrls[asset.id] ? (
                      <img
                        src={previewUrls[asset.id]}
                        alt={`${order.pet_name}の追加した思い出`}
                      />
                    ) : (
                      <span>PHOTO</span>
                    )}
                  </div>
                  <input
                    aria-label="追加した写真の説明"
                    maxLength={120}
                    defaultValue={asset.album_caption ?? ""}
                    placeholder="写真のひとこと（任意）"
                    onBlur={(event) => {
                      const caption = event.currentTarget.value.trim() || null;
                      if (caption !== asset.album_caption)
                        void updatePhoto(asset, { album_caption: caption });
                    }}
                  />
                  <div className="album-manager-actions added-photo-actions">
                    <button
                      className="danger"
                      type="button"
                      disabled={working}
                      onClick={() => void deleteAddedPhoto(asset)}
                    >
                      写真を削除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="album-manager-empty">
              まだ完成後の写真はありません。最初の一枚をここから追加できます。
            </p>
          )}
        </div>
      )}
      <div className="card-head">
        <div>
          <p className="eyebrow">STORY SOURCE PHOTOS</p>
          <h2>制作に使用した写真</h2>
        </div>
        <span>制作時の写真 {visiblePhotos.length}枚を表示</span>
      </div>
      <p className="memory-manager-lead">
        制作に使った写真の掲載順と短い説明を整えられます。完成後の新しい写真も、この制作室からいつでも追加できます。
      </p>

      {photos.length ? (
        <div className="album-manager-grid">
          {photos.map((asset, index) => (
            <article
              className={
                asset.album_visible
                  ? "album-manager-item selected"
                  : "album-manager-item"
              }
              key={asset.id}
            >
              <div className="album-manager-image">
                {previewUrls[asset.id] ? (
                  <img
                    src={previewUrls[asset.id]}
                    alt={`${order.pet_name}のアルバム候補`}
                  />
                ) : (
                  <span>PHOTO</span>
                )}
                <button
                  type="button"
                  disabled={working}
                  onClick={() => togglePhoto(asset)}
                >
                  {asset.album_visible ? "掲載中" : "掲載する"}
                </button>
              </div>
              <input
                aria-label="写真の説明"
                maxLength={120}
                defaultValue={asset.album_caption ?? ""}
                placeholder="写真のひとこと（任意）"
                onBlur={(event) => {
                  const caption = event.currentTarget.value.trim() || null;
                  if (caption !== asset.album_caption)
                    updatePhoto(asset, { album_caption: caption });
                }}
              />
              <div className="album-manager-actions">
                <button
                  type="button"
                  disabled={working || index === 0}
                  onClick={() => movePhoto(asset, -1)}
                >
                  ← 前へ
                </button>
                <button
                  type="button"
                  disabled={working || index === photos.length - 1}
                  onClick={() => movePhoto(asset, 1)}
                >
                  次へ →
                </button>
                <button
                  className="danger"
                  type="button"
                  disabled={working}
                  onClick={() => deletePhoto(asset)}
                >
                  削除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="album-manager-empty">
          写真を追加すると、ここでアルバムを編集できます。
        </p>
      )}

    </section>
  );
}
