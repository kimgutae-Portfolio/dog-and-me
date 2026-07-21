"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { Delivery, MemoryOrder, MemoryShare, OrderAsset } from "../lib/supabase/types";

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
  return typeof candidate.token === "string" && typeof candidate.active === "boolean"
    ? { token: candidate.token, active: candidate.active }
    : null;
}

export function MemoryShareManager({ order, delivery, assets, onChanged }: Props) {
  const [share, setShare] = useState<MemoryShare | null>(null);
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const photos = useMemo(() => assets
    .filter((asset) => asset.category === "source_image")
    .sort((a, b) => a.album_sort_order - b.album_sort_order || a.created_at.localeCompare(b.created_at)), [assets]);
  const visiblePhotos = photos.filter((asset) => asset.album_visible);
  const shareUrl = share?.token && origin ? `${origin}/memory/${share.token}` : "";

  useEffect(() => {
    if (!photos.length) return;
    const supabase = getSupabaseBrowserClient();
    supabase.storage.from("order-assets").createSignedUrls(photos.map((asset) => asset.storage_path), 3600)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        data?.forEach((result, index) => {
          if (result.signedUrl) next[photos[index].id] = result.signedUrl;
        });
        setPreviewUrls(next);
      });
  }, [photos]);

  const manageShare = useCallback(async (action: "get" | "enable" | "disable" | "rotate") => {
    const { data, error: shareError } = await getSupabaseBrowserClient().rpc("manage_memory_share", {
      p_order_id: order.id,
      p_action: action,
    });
    if (shareError) throw shareError;
    const next = shareRow(data);
    if (!next) throw new Error("share link was not returned");
    setShare(next);
    return next;
  }, [order.id]);

  useEffect(() => {
    if (!delivery) return;
    const timer = window.setTimeout(() => {
      manageShare("get").catch(() => setError("共有リンクの情報を読み込めませんでした。"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [delivery, manageShare]);

  const updatePhoto = async (asset: OrderAsset, changes: Partial<Pick<OrderAsset, "album_visible" | "album_caption" | "album_sort_order">>) => {
    setWorking(true);
    setError("");
    const { error: updateError } = await getSupabaseBrowserClient().from("assets").update(changes).eq("id", asset.id).eq("order_id", order.id);
    if (updateError) setError(updateError.message.includes("30") ? "アルバムに表示できる写真は30枚までです。" : "写真の設定を保存できませんでした。");
    else await onChanged();
    setWorking(false);
  };

  const togglePhoto = async (asset: OrderAsset) => {
    if (!asset.album_visible && visiblePhotos.length >= 30) {
      setError("アルバムに表示できる写真は30枚までです。");
      return;
    }
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
      supabase.from("assets").update({ album_sort_order: target.album_sort_order }).eq("id", asset.id),
      supabase.from("assets").update({ album_sort_order: asset.album_sort_order }).eq("id", target.id),
    ]);
    if (first.error || second.error) setError("写真の順番を変更できませんでした。");
    else await onChanged();
    setWorking(false);
  };

  const deletePhoto = async (asset: OrderAsset) => {
    if (!window.confirm("この写真を制作室とアルバムから削除しますか？")) return;
    setWorking(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage.from("order-assets").remove([asset.storage_path]);
    if (storageError) setError("写真ファイルを削除できませんでした。");
    else {
      const { error: recordError } = await supabase.from("assets").delete().eq("id", asset.id).eq("order_id", order.id);
      if (recordError) setError("写真情報を削除できませんでした。");
      else { setNotice("写真を削除しました。"); await onChanged(); }
    }
    setWorking(false);
  };

  const changeShare = async (action: "enable" | "disable" | "rotate") => {
    if (action === "rotate" && !window.confirm("現在の共有URLを無効にして、新しいURLを発行しますか？")) return;
    setWorking(true);
    setError("");
    try {
      const next = await manageShare(action);
      setNotice(action === "disable" ? "家族共有を停止しました。" : action === "rotate" ? "新しい共有URLを発行しました。" : "家族共有を開始しました。");
      return next;
    } catch {
      setError("共有設定を変更できませんでした。");
      return null;
    } finally {
      setWorking(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setNotice("共有URLをコピーしました。");
  };

  const openShareSheet = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: `${order.pet_name}との思い出｜WAN MEMORY`,
        text: `${order.pet_name}との大切な時間をまとめた専用メモリーサイトです。`,
        url: shareUrl,
      });
    } else {
      await copyShareUrl();
    }
  };

  return (
    <section className="studio-card memory-share-manager">
      <div className="card-head"><div><p className="eyebrow">MEMORY ALBUM &amp; FAMILY SHARE</p><h2>写真アルバムと家族共有</h2></div><span>{visiblePhotos.length} / 30枚を表示</span></div>
      <p className="memory-manager-lead">アルバムに載せる写真を選び、順番と短い説明を整えられます。編集できるのはお客様だけです。</p>
      {notice && <p className="memory-manager-message">{notice}<button type="button" onClick={() => setNotice("")}>×</button></p>}
      {error && <p className="memory-manager-message error" role="alert">{error}</p>}

      {photos.length ? <div className="album-manager-grid">{photos.map((asset, index) => (
        <article className={asset.album_visible ? "album-manager-item selected" : "album-manager-item"} key={asset.id}>
          <div className="album-manager-image">{previewUrls[asset.id] ? <img src={previewUrls[asset.id]} alt={`${order.pet_name}のアルバム候補`} /> : <span>PHOTO</span>}<button type="button" disabled={working} onClick={() => togglePhoto(asset)}>{asset.album_visible ? "掲載中" : "掲載する"}</button></div>
          <input aria-label="写真の説明" maxLength={120} defaultValue={asset.album_caption ?? ""} placeholder="写真のひとこと（任意）" onBlur={(event) => {
            const caption = event.currentTarget.value.trim() || null;
            if (caption !== asset.album_caption) updatePhoto(asset, { album_caption: caption });
          }} />
          <div className="album-manager-actions"><button type="button" disabled={working || index === 0} onClick={() => movePhoto(asset, -1)}>← 前へ</button><button type="button" disabled={working || index === photos.length - 1} onClick={() => movePhoto(asset, 1)}>次へ →</button><button className="danger" type="button" disabled={working} onClick={() => deletePhoto(asset)}>削除</button></div>
        </article>
      ))}</div> : <p className="album-manager-empty">写真を追加すると、ここでアルバムを編集できます。</p>}

      <div className="family-share-panel">
        <div><p className="eyebrow">FAMILY SHARE LINK</p><h3>家族はログインせずに閲覧できます。</h3><p>共有URLを知っている方だけが、完成映像と選んだ写真を閲覧できます。ページは検索結果に表示されません。</p></div>
        {!delivery ? <div className="family-share-waiting"><strong>映画の納品後に利用できます</strong><small>完成映像が届くと共有URLを発行できます。</small></div> : <div className="family-share-controls">
          <div className="share-status"><span className={share?.active ? "active" : ""}>{share?.active ? "共有中" : "停止中"}</span><code>{shareUrl || "共有URLを準備しています…"}</code></div>
          <div><button className="button button-primary" type="button" disabled={working || !share} onClick={() => changeShare(share?.active ? "disable" : "enable")}>{share?.active ? "共有を停止する" : "家族共有を始める"}</button><button className="button button-outline" type="button" disabled={working || !share?.active} onClick={copyShareUrl}>URLをコピー</button><button className="button button-outline" type="button" disabled={working || !share?.active} onClick={openShareSheet}>LINEなどで共有</button></div>
          <button className="share-rotate" type="button" disabled={working || !share} onClick={() => changeShare("rotate")}>共有URLを新しく発行する</button>
          <small>共有停止後も、すでに開かれている映像は最大15分ほど表示される場合があります。</small>
        </div>}
      </div>
    </section>
  );
}
