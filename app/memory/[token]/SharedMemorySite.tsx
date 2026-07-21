"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import type { SharedMemoryPayload } from "../../lib/supabase/public-memory";

type SharedImage = SharedMemoryPayload["images"][number] & { url: string };

export function SharedMemorySite() {
  const params = useParams<{ token: string }>();
  const [memory, setMemory] = useState<SharedMemoryPayload | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<SharedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.token) return;
    const supabase = getSupabaseBrowserClient();
    const load = async () => {
      const { data, error: memoryError } = await supabase.rpc("get_shared_memory", { p_token: params.token });
      if (memoryError || !data) {
        setError("このメモリーサイトは現在公開されていません。");
        setLoading(false);
        return;
      }
      const loaded = data as SharedMemoryPayload;
      const paths = [loaded.delivery.video_storage_path, ...loaded.images.map((image) => image.storage_path)].filter(Boolean);
      const { data: signed } = await supabase.storage.from("order-assets").createSignedUrls(paths, 900);
      const urlByPath = new Map<string, string>();
      signed?.forEach((item, index) => { if (item.signedUrl) urlByPath.set(paths[index], item.signedUrl); });
      const finalVideoUrl = urlByPath.get(loaded.delivery.video_storage_path) ?? "";
      if (!finalVideoUrl) {
        setError("映像を表示できません。専用URLの有効状態をご確認ください。");
        setLoading(false);
        return;
      }
      setMemory(loaded);
      setVideoUrl(finalVideoUrl);
      setImages(loaded.images.map((image) => ({ ...image, url: urlByPath.get(image.storage_path) ?? "" })).filter((image) => image.url));
      setLoading(false);
    };
    load();
  }, [params.token]);

  if (loading) return <div className="wizard-loading">大切な思い出を準備しています…</div>;
  if (error || !memory) return <main className="film-private-error shared-memory-error"><p className="eyebrow">PRIVATE MEMORY</p><h1>ページを表示できません。</h1><p>{error}</p><Link className="button button-primary" href="/">WAN MEMORYへ戻る</Link></main>;

  const { order, delivery, concept } = memory;
  const heroImage = images[0]?.url;

  return (
    <main className="private-film-page shared-memory-page">
      <header className="private-film-nav"><Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>PRIVATE MEMORY SITE</small></span></Link><span className="shared-memory-badge">専用メモリーサイト</span></header>
      <section className="private-film-hero shared-memory-hero">{heroImage && <div className="shared-memory-hero-photo" style={{ backgroundImage: `url(${heroImage})` }} />}<div className="private-film-glow" /><div><p>PRIVATE MEMORY FILM</p><h1>{delivery.title}</h1><span>{order.pet_name} · {order.breed}</span></div></section>

      <section className="private-film-section"><div className="private-film-heading"><div><p>YOUR FILM</p><h2>一緒に過ごした時間を、<br />一本の映画に。</h2></div><span>閲覧専用 · 専用URL</span></div><div className="private-video-frame"><video src={videoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline onContextMenu={(event) => event.preventDefault()} /></div><p className="private-video-note">ダウンロード操作は提供していません。画面録画などを技術的に完全に防ぐことはできません。</p></section>

      <section className="private-film-quote"><p>FOR {order.pet_name.toUpperCase()}</p><blockquote>「{order.message_to_pet || delivery.customer_message || "これからも、思い出の中で一緒に。"}」</blockquote></section>

      {concept && <section className="private-film-section private-film-story"><div className="private-film-heading"><div><p>THE STORY</p><h2>{concept.title}</h2></div><span>{concept.tone}</span></div><p className="private-film-summary">{concept.summary}</p><ol>{concept.scenes.map((scene, index) => <li key={`${index}-${scene}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{scene}</strong></li>)}</ol></section>}

      {images.length > 0 && <section className="private-film-section private-film-gallery"><div className="private-film-heading"><div><p>PHOTO MEMORIES</p><h2>何度でも開ける、<br />思い出のアルバム。</h2></div><span>{images.length} PHOTOS</span></div><div>{images.map((image) => <figure key={image.id}><img src={image.url} alt={`${order.pet_name}の思い出写真`} draggable={false} onContextMenu={(event) => event.preventDefault()} /><figcaption>{image.caption || `${order.pet_name}との思い出`}</figcaption></figure>)}</div></section>}

      <footer className="private-film-footer"><div><span className="brand-mark">WM</span><p>WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></p></div><span>{order.pet_name} · {new Date(order.created_at).getFullYear()}</span></footer>
    </main>
  );
}
