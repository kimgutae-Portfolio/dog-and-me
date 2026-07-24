"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderAsset, StoryDraftAsset } from "./types";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

async function normalizeImage(file: File): Promise<File> {
  if (!HEIC_TYPES.has(file.type) && !HEIC_EXTENSIONS.test(file.name)) return file;

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const jpeg = Array.isArray(converted) ? converted[0] : converted;
  return new File([jpeg], file.name.replace(HEIC_EXTENSIONS, ".jpg"), { type: "image/jpeg" });
}

export type UploadedStoryDraftImage = {
  asset: StoryDraftAsset;
  file: File;
};

export async function uploadStoryDraftImage(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  clientKey: string,
  originalFile: File,
  sortOrder: number,
): Promise<UploadedStoryDraftImage> {
  const file = await normalizeImage(originalFile);
  const path = `${userId}/drafts/${draftId}/${clientKey}.${safeExtension(file)}`;

  const { data: existing } = await supabase
    .from("story_draft_assets")
    .select("*")
    .eq("draft_id", draftId)
    .eq("client_key", clientKey)
    .maybeSingle();

  if (existing?.storage_path) {
    await supabase.storage.from("order-assets").remove([existing.storage_path]);
  }

  const { data: metadata, error: metadataError } = await supabase
    .from("story_draft_assets")
    .upsert({
      draft_id: draftId,
      user_id: userId,
      client_key: clientKey,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      sort_order: sortOrder,
    }, { onConflict: "draft_id,client_key" })
    .select("*")
    .single();
  if (metadataError) throw metadataError;

  const { error: uploadError } = await supabase.storage
    .from("order-assets")
    .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) {
    await supabase.from("story_draft_assets").delete().eq("id", metadata.id);
    throw uploadError;
  }

  return { asset: metadata as StoryDraftAsset, file };
}

export async function deleteStoryDraftImage(
  supabase: SupabaseClient,
  asset: StoryDraftAsset,
) {
  const { error: storageError } = await supabase.storage
    .from("order-assets")
    .remove([asset.storage_path]);
  if (storageError) throw storageError;
  const { error: metadataError } = await supabase
    .from("story_draft_assets")
    .delete()
    .eq("id", asset.id);
  if (metadataError) throw metadataError;
}

function safeExtension(file: File) {
  const candidate = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return candidate || (file.type === "image/jpeg" ? "jpg" : "bin");
}

export class OrderImageUploadError extends Error {
  fileName: string;

  constructor(fileName: string, cause?: unknown) {
    super(`${fileName} の送信に失敗しました。この写真だけ、もう一度送信できます。`, { cause });
    this.name = "OrderImageUploadError";
    this.fileName = fileName;
  }
}

export async function uploadOrderImages(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  memoryId: string | null = null,
): Promise<OrderAsset[]> {
  const uploaded: OrderAsset[] = [];
  const [{ count: visibleCount }, { data: lastAsset }, { data: existingAssets }] = await Promise.all([
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .eq("category", "source_image")
      .eq("album_visible", true),
    supabase
      .from("assets")
      .select("album_sort_order")
      .eq("order_id", orderId)
      .eq("category", "source_image")
      .order("album_sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assets")
      .select("*")
      .eq("order_id", orderId)
      .eq("category", "source_image"),
  ]);
  const existingByKey = new Map(
    ((existingAssets ?? []) as OrderAsset[]).map((asset) => [`${asset.original_filename}:${asset.file_size}`, asset]),
  );
  let nextVisibleIndex = visibleCount ?? 0;
  let nextSortOrder = ((lastAsset as { album_sort_order?: number } | null)?.album_sort_order ?? -1) + 1;

  for (let index = 0; index < files.length; index += 1) {
    const originalFile = files[index];
    try {
      const file = await normalizeImage(originalFile);
      const fileKey = `${file.name}:${file.size}`;
      const existingAsset = existingByKey.get(fileKey);
      if (existingAsset) {
        uploaded.push(existingAsset);
        onProgress?.(index + 1, files.length);
        continue;
      }
      const path = `${userId}/${orderId}/source/${crypto.randomUUID()}.${safeExtension(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("order-assets")
        .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: metadataError } = await supabase
        .from("assets")
        .insert({
          order_id: orderId,
          user_id: userId,
          category: "source_image",
          memory_id: memoryId,
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          album_visible: nextVisibleIndex < 30,
          album_sort_order: nextSortOrder,
        })
        .select("*")
        .single();

      if (metadataError) {
        await supabase.storage.from("order-assets").remove([path]);
        throw metadataError;
      }

      uploaded.push(data as OrderAsset);
      existingByKey.set(fileKey, data as OrderAsset);
      if (nextVisibleIndex < 30) nextVisibleIndex += 1;
      nextSortOrder += 1;
      onProgress?.(index + 1, files.length);
    } catch (error) {
      if (error instanceof OrderImageUploadError) throw error;
      throw new OrderImageUploadError(originalFile.name, error);
    }
  }

  return uploaded;
}
