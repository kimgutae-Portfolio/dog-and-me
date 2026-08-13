"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { PersonalStorybookSite } from "../../components/PersonalStorybookSite";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { Delivery, MemoryOrder, OrderAsset } from "../../lib/supabase/types";

type SignedImage = { id: string; url: string; caption: string | null };

export function CustomerFilmSite() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<MemoryOrder | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<SignedImage[]>([]);
  const [characterSpriteUrl, setCharacterSpriteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user)
      router.replace(`/auth?next=${encodeURIComponent(`/film/${params.orderId}`)}`);
  }, [authLoading, params.orderId, router, user]);

  useEffect(() => {
    if (!user || !params.orderId) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const [orderResult, deliveryResult, assetsResult] = await Promise.all([
        supabase.from("orders").select("*").eq("id", params.orderId).maybeSingle(),
        supabase.from("deliveries").select("*").eq("order_id", params.orderId).maybeSingle(),
        supabase.from("assets").select("*").eq("order_id", params.orderId).order("created_at"),
      ]);
      if (!orderResult.data || orderResult.error) {
        setError("このものがたりサイトを表示できません。");
        setLoading(false);
        return;
      }
      const loadedOrder = orderResult.data as MemoryOrder;
      const loadedDelivery = deliveryResult.data as Delivery | null;
      const loadedAssets = (assetsResult.data ?? []) as OrderAsset[];
      setOrder(loadedOrder);
      setDelivery(loadedDelivery);

      const finalAsset = loadedDelivery
        ? loadedAssets.find((asset) => asset.id === loadedDelivery.final_asset_id)
        : null;
      const sourceImages = loadedAssets
        .filter((asset) => asset.category === "source_image" && asset.album_visible)
        .sort((a, b) => a.album_sort_order - b.album_sort_order || a.created_at.localeCompare(b.created_at))
        .slice(0, 30);
      const characterSprite = loadedAssets.find((asset) => asset.category === "character_sprite");
      const paths = [
        finalAsset?.storage_path,
        ...sourceImages.map((asset) => asset.storage_path),
        characterSprite?.storage_path,
      ].filter((path): path is string => Boolean(path));
      const { data: signed } = await supabase.storage.from("order-assets").createSignedUrls(paths, 3600);
      const urlByPath = new Map<string, string>();
      signed?.forEach((item, index) => {
        if (item.signedUrl) urlByPath.set(paths[index], item.signedUrl);
      });
      setVideoUrl(finalAsset ? urlByPath.get(finalAsset.storage_path) ?? "" : "");
      setImages(sourceImages.map((asset) => ({
        id: asset.id,
        url: urlByPath.get(asset.storage_path) ?? "",
        caption: asset.album_caption,
      })).filter((image) => image.url));
      setCharacterSpriteUrl(characterSprite ? urlByPath.get(characterSprite.storage_path) ?? "" : "");
      setLoading(false);
    };
    load();
  }, [params.orderId, user]);

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
      breed={order.breed}
      purpose={order.purpose}
      createdAt={order.created_at}
      message={order.message_to_pet || delivery?.customer_message || "これからも、思い出の中で一緒に。"}
      videoUrl={videoUrl}
      images={images}
      characterSpriteUrl={characterSpriteUrl}
      backHref={`/studio?order=${order.id}`}
      backLabel="制作室へ戻る ↗"
    />
  );
}
