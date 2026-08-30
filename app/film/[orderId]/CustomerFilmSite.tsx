"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import {
  type AlbumImage,
  PersonalStorybookSite,
} from "../../components/PersonalStorybookSite";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { Delivery, MemoryOrder, OrderAsset } from "../../lib/supabase/types";
import { uploadLifetimeAlbumImages } from "../../lib/supabase/uploads";

const ALBUM_PAGE_SIZE = 30;

function latestSceneStills(assets: OrderAsset[]) {
  const latest = new Map<number, OrderAsset>();
  assets
    .filter((asset) => asset.category === "scene_still")
    .forEach((asset) => {
      const current = latest.get(asset.scene_sort_order);
      if (!current || current.created_at < asset.created_at)
        latest.set(asset.scene_sort_order, asset);
    });
  return [...latest.values()].sort(
    (a, b) =>
      a.scene_sort_order - b.scene_sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

export function CustomerFilmSite() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<MemoryOrder | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<AlbumImage[]>([]);
  const [albumAssets, setAlbumAssets] = useState<OrderAsset[]>([]);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [albumNotice, setAlbumNotice] = useState("");
  const [characterSpriteUrl, setCharacterSpriteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user)
      router.replace(`/auth?next=${encodeURIComponent(`/film/${params.orderId}`)}`);
  }, [authLoading, params.orderId, router, user]);

  const load = useCallback(async () => {
    if (!user || !params.orderId) return;
    const supabase = getSupabaseBrowserClient();
      const [orderResult, deliveryResult, assetsResult, albumResult] = await Promise.all([
        supabase.from("orders").select("*").eq("id", params.orderId).maybeSingle(),
        supabase.from("deliveries").select("*").eq("order_id", params.orderId).maybeSingle(),
        supabase
          .from("assets")
          .select("*")
          .eq("order_id", params.orderId)
          .in("category", ["source_image", "scene_still", "final_video", "character_sprite"])
          .order("created_at"),
        supabase
          .from("assets")
          .select("*", { count: "exact" })
          .eq("order_id", params.orderId)
          .eq("category", "album_photo")
          .eq("album_visible", true)
          .order("album_sort_order")
          .range(0, ALBUM_PAGE_SIZE - 1),
      ]);
      if (!orderResult.data || orderResult.error) {
        setError("このものがたりサイトを表示できません。");
        setLoading(false);
        return;
      }
      const loadedOrder = orderResult.data as MemoryOrder;
      const loadedDelivery = deliveryResult.data as Delivery | null;
      const loadedAssets = (assetsResult.data ?? []) as OrderAsset[];
      const loadedAlbumAssets = (albumResult.data ?? []) as OrderAsset[];
      setOrder(loadedOrder);
      setDelivery(loadedDelivery);

      const finalAsset = loadedDelivery
        ? loadedAssets.find((asset) => asset.id === loadedDelivery.final_asset_id)
        : null;
      const sceneStills = latestSceneStills(loadedAssets);
      const sourceImages = loadedAssets
        .filter((asset) => asset.category === "source_image" && asset.album_visible)
        .sort((a, b) => a.album_sort_order - b.album_sort_order || a.created_at.localeCompare(b.created_at));
      const characterSprite = loadedAssets.find((asset) => asset.category === "character_sprite");
      const albumImages = [...sceneStills, ...sourceImages, ...loadedAlbumAssets];
      const paths = [
        finalAsset?.storage_path,
        ...albumImages.map((asset) => asset.storage_path),
        characterSprite?.storage_path,
      ].filter((path): path is string => Boolean(path));
      const { data: signed } = await supabase.storage.from("order-assets").createSignedUrls(paths, 3600);
      const urlByPath = new Map<string, string>();
      signed?.forEach((item, index) => {
        if (item.signedUrl) urlByPath.set(paths[index], item.signedUrl);
      });
      setVideoUrl(finalAsset ? urlByPath.get(finalAsset.storage_path) ?? "" : "");
      setImages(albumImages.map((asset) => ({
        id: asset.id,
        url: urlByPath.get(asset.storage_path) ?? "",
        caption:
          asset.category === "scene_still"
            ? asset.story_caption || asset.scene_title
            : asset.album_caption,
        kind: asset.category as AlbumImage["kind"],
      })).filter((image) => image.url));
      setAlbumAssets(loadedAlbumAssets);
      setAlbumTotal(sceneStills.length + sourceImages.length + (albumResult.count ?? 0));
      setCharacterSpriteUrl(characterSprite ? urlByPath.get(characterSprite.storage_path) ?? "" : "");
      setLoading(false);
  }, [params.orderId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadMoreAlbum = async () => {
    if (!user || albumBusy) return;
    setAlbumBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: pageError } = await supabase
      .from("assets")
      .select("*")
      .eq("order_id", params.orderId)
      .eq("category", "album_photo")
      .eq("album_visible", true)
      .order("album_sort_order")
      .range(albumAssets.length, albumAssets.length + ALBUM_PAGE_SIZE - 1);
    const nextAssets = (data ?? []) as OrderAsset[];
    if (pageError) {
      setAlbumNotice("続きの写真を読み込めませんでした。もう一度お試しください。");
      setAlbumBusy(false);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("order-assets")
      .createSignedUrls(nextAssets.map((asset) => asset.storage_path), 3600);
    const nextImages = nextAssets.flatMap((asset, index) => {
      const url = signed?.[index]?.signedUrl;
      return url
        ? [{ id: asset.id, url, caption: asset.album_caption, kind: "album_photo" as const }]
        : [];
    });
    setAlbumAssets((current) => [...current, ...nextAssets]);
    setImages((current) => [...current, ...nextImages]);
    setAlbumBusy(false);
  };

  const uploadAlbumPhotos = async (files: File[]) => {
    if (!user || !files.length || albumBusy) return;
    setAlbumBusy(true);
    setAlbumNotice(`0 / ${files.length}枚を追加しています…`);
    try {
      await uploadLifetimeAlbumImages(
        getSupabaseBrowserClient(),
        user.id,
        params.orderId,
        files,
        (completed, total) =>
          setAlbumNotice(`${completed} / ${total}枚を追加しています…`),
      );
      setAlbumNotice(`${files.length}枚の新しい思い出を追加しました。`);
      await load();
    } catch (caught) {
      const message =
        caught && typeof caught === "object" && "message" in caught
          ? String(caught.message)
          : "写真を追加できませんでした。";
      setAlbumNotice(message);
      await load();
    } finally {
      setAlbumBusy(false);
    }
  };

  const deleteAlbumPhoto = async (imageId: string) => {
    const asset = albumAssets.find((item) => item.id === imageId);
    if (!asset || albumBusy) return;
    if (!window.confirm("この写真をアルバムから削除しますか？")) return;
    setAlbumBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage
      .from("order-assets")
      .remove([asset.storage_path]);
    if (storageError) {
      setAlbumNotice("写真を削除できませんでした。もう一度お試しください。");
      setAlbumBusy(false);
      return;
    }
    const { error: recordError } = await supabase.rpc(
      "delete_lifetime_album_photo",
      { p_asset_id: asset.id },
    );
    setAlbumNotice(
      recordError
        ? "写真情報を整理できませんでした。サポートへご連絡ください。"
        : "写真をアルバムから削除しました。",
    );
    await load();
    setAlbumBusy(false);
  };

  if (authLoading || loading || !user)
    return <div className="wizard-loading">大切な映像を準備しています…</div>;
  if (error || !order)
    return (
      <main className="film-private-error">
        <p>{error || "映像が見つかりません。"}</p>
        <Link href="/studio">制作室へ戻る</Link>
      </main>
    );

  return (
    <PersonalStorybookSite
      title={delivery?.title || `${order.pet_name}と、五つの記憶`}
      petName={order.pet_name}
      createdAt={order.created_at}
      metOn={order.met_on}
      message={order.message_to_pet || delivery?.customer_message || "これからも、思い出の中で一緒に。"}
      videoUrl={videoUrl}
      images={images}
      albumTotal={albumTotal}
      canManageAlbum={order.status === "delivered"}
      albumBusy={albumBusy}
      albumNotice={albumNotice}
      onAlbumUpload={uploadAlbumPhotos}
      onAlbumDelete={deleteAlbumPhoto}
      onLoadMore={images.length < albumTotal ? loadMoreAlbum : undefined}
      characterSpriteUrl={characterSpriteUrl}
      backHref={`/studio?order=${order.id}`}
      backLabel="制作室へ戻る ↗"
    />
  );
}
