"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PersonalStorybookSite } from "../../components/PersonalStorybookSite";
import {
  getPublicMemoryClient,
  type SharedMemoryPayload,
} from "../../lib/supabase/public-memory";

type SharedImage = SharedMemoryPayload["images"][number] & { url: string };

export function SharedMemorySite({
  customerSlug,
  petSlug,
  initialMemory,
}: {
  customerSlug?: string;
  petSlug?: string;
  initialMemory?: SharedMemoryPayload | null;
} = {}) {
  const params = useParams<{ shareId: string }>();
  const [memory, setMemory] = useState<SharedMemoryPayload | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [images, setImages] = useState<SharedImage[]>([]);
  const [loadedImageCount, setLoadedImageCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [characterSpriteUrl, setCharacterSpriteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSharedMemory = useCallback(async (
    rpc: string,
    rpcParams: Record<string, string>,
    preloaded?: SharedMemoryPayload | null,
  ) => {
    const supabase = getPublicMemoryClient();
    if (!supabase) {
      setError("ページ情報を読み込めませんでした。時間をおいてもう一度お試しください。");
      setLoading(false);
      return;
    }
    let loaded = preloaded ?? null;
    if (!loaded) {
      const { data, error: memoryError } = await supabase.rpc(rpc, rpcParams);
      if (memoryError) {
        setError("ページ情報を読み込めませんでした。時間をおいてもう一度お試しください。");
        setLoading(false);
        return;
      }
      if (!data) {
        setError("このものがたりサイトは現在公開されていません。");
        setLoading(false);
        return;
      }
      loaded = data as SharedMemoryPayload;
    }
    const paths = [loaded.delivery.video_storage_path, ...loaded.images.map((image) => image.storage_path), loaded.character?.storage_path]
      .filter((path): path is string => Boolean(path));
    const { data: signed } = await supabase.storage.from("order-assets").createSignedUrls(paths, 900);
    const urlByPath = new Map<string, string>();
    signed?.forEach((item, index) => {
      if (item.signedUrl) urlByPath.set(paths[index], item.signedUrl);
    });
    const finalVideoUrl = urlByPath.get(loaded.delivery.video_storage_path) ?? "";
    if (!finalVideoUrl) {
      setError("映像を表示できません。専用URLの公開状態をご確認ください。");
      setLoading(false);
      return;
    }
    setMemory(loaded);
    setVideoUrl(finalVideoUrl);
    setImages(loaded.images.map((image) => ({ ...image, url: urlByPath.get(image.storage_path) ?? "" })).filter((image) => image.url));
    setLoadedImageCount(loaded.images.length);
    setCharacterSpriteUrl(loaded.character?.storage_path ? urlByPath.get(loaded.character.storage_path) ?? "" : "");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialMemory) {
        loadSharedMemory("", {}, initialMemory);
        return;
      }
      if (customerSlug && petSlug) {
        loadSharedMemory("get_shared_memory_by_slug", {
          p_customer_slug: customerSlug,
          p_pet_slug: petSlug,
        });
        return;
      }
      if (params.shareId)
        loadSharedMemory("get_shared_memory_by_code", { p_share_code: params.shareId });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customerSlug, initialMemory, loadSharedMemory, params.shareId, petSlug]);

  const loadMoreImages = async () => {
    if (!memory || loadingMore || loadedImageCount >= memory.album_total) return;
    setLoadingMore(true);
    const supabase = getPublicMemoryClient();
    if (!supabase) {
      setLoadingMore(false);
      return;
    }
    const rpc = customerSlug && petSlug
      ? "get_shared_album_page_by_slug"
      : "get_shared_album_page_by_code";
    const rpcParams = customerSlug && petSlug
      ? {
          p_customer_slug: customerSlug,
          p_pet_slug: petSlug,
          p_offset: loadedImageCount,
          p_limit: 30,
        }
      : {
          p_share_code: params.shareId,
          p_offset: loadedImageCount,
          p_limit: 30,
        };
    const { data, error: pageError } = await supabase.rpc(rpc, rpcParams);
    const page = Array.isArray(data)
      ? (data as SharedMemoryPayload["images"])
      : [];
    if (!pageError && page.length) {
      const { data: signed } = await supabase.storage
        .from("order-assets")
        .createSignedUrls(page.map((image) => image.storage_path), 900);
      const next = page.flatMap((image, index) => {
        const url = signed?.[index]?.signedUrl;
        return url ? [{ ...image, url }] : [];
      });
      setImages((current) => [...current, ...next]);
      setLoadedImageCount((current) => current + page.length);
    }
    setLoadingMore(false);
  };

  if (loading) return <div className="wizard-loading">大切な思い出を準備しています…</div>;
  if (error || !memory)
    return (
      <main className="film-private-error shared-memory-error">
        <p className="eyebrow">PRIVATE MEMORY</p>
        <h1>ページを表示できません。</h1>
        <p>{error}</p>
        <Link className="button button-primary" href="/">WAN MEMORYへ戻る</Link>
      </main>
    );

  return (
    <PersonalStorybookSite
      title={memory.delivery.title}
      petName={memory.order.pet_name}
      breed={memory.order.breed}
      purpose={memory.order.purpose}
      createdAt={memory.order.created_at}
      message={memory.order.message_to_pet || memory.delivery.customer_message || "これからも、思い出の中で一緒に。"}
      videoUrl={videoUrl}
      images={images}
      albumTotal={memory.album_total}
      albumBusy={loadingMore}
      onLoadMore={loadedImageCount < memory.album_total ? loadMoreImages : undefined}
      albumManageHref={`/studio?order=${encodeURIComponent(memory.order.id)}`}
      characterSpriteUrl={characterSpriteUrl}
      backHref={`/studio?order=${encodeURIComponent(memory.order.id)}`}
      backLabel="ホームページを管理する ↗"
    />
  );
}
