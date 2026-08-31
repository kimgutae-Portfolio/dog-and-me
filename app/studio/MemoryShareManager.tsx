"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PHOTO_BATCH_SIZE = 30;

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
  const [metOnDraft, setMetOnDraft] = useState(order.met_on ?? "");
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(PHOTO_BATCH_SIZE);
  const loadMorePhotosRef = useRef<HTMLButtonElement>(null);

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
  const managedPhotos = useMemo(
    () => [...photos, ...addedPhotos],
    [addedPhotos, photos],
  );
  const visiblePhotos = useMemo(
    () => managedPhotos.slice(0, visiblePhotoCount),
    [managedPhotos, visiblePhotoCount],
  );
  const hasMorePhotos = visiblePhotoCount < managedPhotos.length;
  const shareUrl =
    share?.customer_slug && share?.pet_slug && origin
      ? `${origin}/${encodeURIComponent(share.customer_slug)}/${encodeURIComponent(share.pet_slug)}`
      : "";
  const siteReady = order.status === "delivered" && Boolean(delivery);
  const today = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!copyPopup) return;
    const timer = window.setTimeout(() => setCopyPopup(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copyPopup]);

  useEffect(() => {
    const pendingPhotos = visiblePhotos.filter(
      (asset) => !previewUrls[asset.id],
    );
    if (!pendingPhotos.length) return;
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    supabase.storage
      .from("order-assets")
      .createSignedUrls(
        pendingPhotos.map((asset) => asset.storage_path),
        3600,
      )
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        data?.forEach((result, index) => {
          if (result.signedUrl)
            next[pendingPhotos[index].id] = result.signedUrl;
        });
        setPreviewUrls((current) => ({ ...current, ...next }));
      });
    return () => {
      cancelled = true;
    };
  }, [previewUrls, visiblePhotos]);

  useEffect(() => {
    const target = loadMorePhotosRef.current;
    if (!target || !hasMorePhotos) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisiblePhotoCount((current) =>
          Math.min(current + PHOTO_BATCH_SIZE, managedPhotos.length),
        );
      },
      { rootMargin: "0px 240px 240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMorePhotos, managedPhotos.length]);

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

  const saveMetOn = async () => {
    if (!siteReady || working || metOnDraft === (order.met_on ?? "")) return;
    if (metOnDraft && metOnDraft > today) {
      setError("出会った日は今日以前の日付を選んでください。");
      return;
    }
    setWorking(true);
    setError("");
    const { error: saveError } = await getSupabaseBrowserClient().rpc(
      "set_personal_site_met_on",
      {
        p_order_id: order.id,
        p_met_on: metOnDraft || null,
      },
    );
    if (saveError) {
      setError("出会った日を保存できませんでした。もう一度お試しください。");
    } else {
      setNotice(
        metOnDraft
          ? "出会った日を保存しました。ホームページのD-dayへ反映されます。"
          : "出会った日の表示を外しました。",
      );
      await onChanged();
    }
    setWorking(false);
  };

  const togglePhoto = async (asset: OrderAsset) => {
    await updatePhoto(asset, { album_visible: !asset.album_visible });
  };

  const movePhoto = async (asset: OrderAsset, direction: -1 | 1) => {
    const siblings = asset.category === "album_photo" ? addedPhotos : photos;
    const index = siblings.findIndex((item) => item.id === asset.id);
    const target = siblings[index + direction];
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
              写真の追加は下の写真アルバムから行えます。公開期限や月額料金なく、このURLをそのまま使い続けられます。
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
      <div className="studio-lifetime-album" id="studio-album-manager">
      <div className="card-head">
        <div>
          <p className="eyebrow">PHOTO ALBUM</p>
          <h2>写真アルバムと家族共有</h2>
        </div>
        <span>写真 {managedPhotos.length}枚を管理</span>
      </div>
      {siteReady && (
        <div className="studio-meeting-day-setting">
          <div>
            <p className="eyebrow">THE DAY WE MET</p>
            <strong>出会った日をホームページに残す</strong>
            <small>保存すると、専用ホームページの最初の画面にD-dayが表示されます。</small>
          </div>
          <label>
            <span>出会った日</span>
            <input
              type="date"
              value={metOnDraft}
              max={today}
              disabled={working}
              onChange={(event) => setMetOnDraft(event.currentTarget.value)}
            />
          </label>
          <button
            className="button button-primary"
            type="button"
            disabled={working || metOnDraft === (order.met_on ?? "")}
            onClick={() => void saveMetOn()}
          >
            {working ? "保存中…" : "日付を保存"}
          </button>
        </div>
      )}
      <div className="studio-album-intro-row">
        <p className="memory-manager-lead">
          制作に使った写真も、完成後に追加した写真もここでまとめて管理します。変更内容は専用ホームページの写真帖へ反映されます。
        </p>
        {siteReady && (
          <label className="button studio-album-upload-button">
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
            <small>1枚20MBまで · 一度に50枚まで</small>
          </label>
        )}
      </div>

      {managedPhotos.length ? (
        <div className="album-manager-grid">
          {visiblePhotos.map((asset) => {
            const siblings =
              asset.category === "album_photo" ? addedPhotos : photos;
            const index = siblings.findIndex((item) => item.id === asset.id);
            return (
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
                  {asset.category === "source_image" && (
                    <button
                      className="album-manager-visibility"
                      type="button"
                      disabled={working}
                      onClick={() => togglePhoto(asset)}
                    >
                      {asset.album_visible ? "外す" : "載せる"}
                    </button>
                  )}
                  {index > 0 && (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => movePhoto(asset, -1)}
                    >
                      ← 前へ
                    </button>
                  )}
                  {index < siblings.length - 1 && (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => movePhoto(asset, 1)}
                    >
                      次へ →
                    </button>
                  )}
                  <button
                    className="danger"
                    type="button"
                    disabled={working}
                    onClick={() =>
                      asset.category === "album_photo"
                        ? void deleteAddedPhoto(asset)
                        : void deletePhoto(asset)
                    }
                  >
                    写真を削除
                  </button>
                </div>
              </article>
            );
          })}
          {hasMorePhotos && (
            <button
              ref={loadMorePhotosRef}
              className="album-manager-load-more"
              type="button"
              onClick={() =>
                setVisiblePhotoCount((current) =>
                  Math.min(current + PHOTO_BATCH_SIZE, managedPhotos.length),
                )
              }
            >
              次の写真を読み込む
              <small>
                {Math.min(PHOTO_BATCH_SIZE, managedPhotos.length - visiblePhotoCount)}枚
              </small>
            </button>
          )}
        </div>
      ) : (
        <p className="album-manager-empty">
          写真を追加すると、ここでアルバムを編集できます。
        </p>
      )}
      </div>
    </section>
  );
}
