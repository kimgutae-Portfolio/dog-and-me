"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { Delivery, FilmConcept, MemoryOrder, OrderAsset } from "../../lib/supabase/types";

type SignedImage = { id: string; url: string; caption: string | null };

export function CustomerFilmSite() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<MemoryOrder | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [concept, setConcept] = useState<FilmConcept | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<SignedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/auth?next=${encodeURIComponent(`/film/${params.orderId}`)}`);
  }, [authLoading, params.orderId, router, user]);

  useEffect(() => {
    if (!user || !params.orderId) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const [orderResult, deliveryResult, assetsResult, conceptsResult] = await Promise.all([
        supabase.from("orders").select("*").eq("id", params.orderId).maybeSingle(),
        supabase.from("deliveries").select("*").eq("order_id", params.orderId).maybeSingle(),
        supabase.from("assets").select("*").eq("order_id", params.orderId).order("created_at"),
        supabase.from("concepts").select("*").eq("order_id", params.orderId).eq("status", "published").order("slot"),
      ]);
      if (!orderResult.data || orderResult.error) {
        setError("このメモリーサイトを表示できません。");
        setLoading(false);
        return;
      }
      const loadedOrder = orderResult.data as MemoryOrder;
      const loadedDelivery = deliveryResult.data as Delivery | null;
      const loadedAssets = (assetsResult.data ?? []) as OrderAsset[];
      const loadedConcepts = (conceptsResult.data ?? []) as FilmConcept[];
      setOrder(loadedOrder);
      setDelivery(loadedDelivery);
      setConcept(loadedConcepts.find((item) => item.slot === loadedOrder.selected_concept_slot) ?? null);

      const finalAsset = loadedDelivery ? loadedAssets.find((asset) => asset.id === loadedDelivery.final_asset_id) : null;
      if (finalAsset) {
        const { data } = await supabase.storage.from("order-assets").createSignedUrl(finalAsset.storage_path, 3600);
        setVideoUrl(data?.signedUrl ?? "");
      }
      const sourceImages = loadedAssets
        .filter((asset) => asset.category === "source_image" && asset.album_visible)
        .sort((a, b) => a.album_sort_order - b.album_sort_order || a.created_at.localeCompare(b.created_at))
        .slice(0, 30);
      const { data: signedImages } = await supabase.storage.from("order-assets").createSignedUrls(sourceImages.map((asset) => asset.storage_path), 3600);
      setImages(sourceImages.map((asset, index) => ({ id: asset.id, url: signedImages?.[index]?.signedUrl ?? "", caption: asset.album_caption })).filter((item) => item.url));
      setLoading(false);
    };
    load();
  }, [params.orderId, user]);

  if (authLoading || loading || !user) return <div className="wizard-loading">大切な映画を準備しています…</div>;
  if (error || !order) return <main className="film-private-error"><p>{error || "映画が見つかりません。"}</p><Link href="/studio">制作室へ戻る</Link></main>;

  return (
    <main className="private-film-page">
      <header className="private-film-nav"><Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>PRIVATE MEMORY SITE</small></span></Link><Link href={`/studio?order=${order.id}`}>制作室へ戻る</Link></header>
      <section className="private-film-hero"><div className="private-film-glow" /><div><p>PRIVATE MEMORY FILM · {order.order_number}</p><h1>{delivery?.title || `${order.pet_name}との映画`}</h1><span>{order.breed} · {order.purpose}</span></div></section>

      <section className="private-film-section"><div className="private-film-heading"><div><p>YOUR FILM</p><h2>一緒に過ごした時間を、<br />一本の映画に。</h2></div><span>閲覧専用 · 有効期限付き表示</span></div><div className="private-video-frame">{videoUrl ? <video src={videoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline onContextMenu={(event) => event.preventDefault()} /> : <div>完成映像を準備しています</div>}</div><p className="private-video-note">ダウンロード操作は提供していません。画面録画などを技術的に完全に防ぐことはできません。</p></section>

      <section className="private-film-quote"><p>FOR {order.pet_name.toUpperCase()}</p><blockquote>「{order.message_to_pet || delivery?.customer_message || "これからも、思い出の中で一緒に。"}」</blockquote></section>

      {concept && <section className="private-film-section private-film-story"><div className="private-film-heading"><div><p>THE STORY</p><h2>{concept.title}</h2></div><span>{concept.tone}</span></div><p className="private-film-summary">{concept.summary}</p><ol>{concept.scenes.map((scene, index) => <li key={`${concept.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{scene}</strong></li>)}</ol></section>}

      {images.length > 0 && <section className="private-film-section private-film-gallery"><div className="private-film-heading"><div><p>PHOTO MEMORIES</p><h2>映画になる前の、<br />大切な一枚一枚。</h2></div><span>{images.length} PHOTOS</span></div><div>{images.map((image) => <figure key={image.id}><img src={image.url} alt={`${order.pet_name}の思い出写真`} draggable={false} onContextMenu={(event) => event.preventDefault()} /><figcaption>{image.caption || `${order.pet_name}との思い出`}</figcaption></figure>)}</div></section>}

      <footer className="private-film-footer"><div><span className="brand-mark">WM</span><p>WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></p></div><span>{order.pet_name} · {new Date(order.created_at).getFullYear()}</span></footer>
    </main>
  );
}
