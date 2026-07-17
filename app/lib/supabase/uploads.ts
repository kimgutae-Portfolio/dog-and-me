"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderAsset } from "./types";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

async function normalizeImage(file: File): Promise<File> {
  if (!HEIC_TYPES.has(file.type) && !HEIC_EXTENSIONS.test(file.name)) return file;

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const jpeg = Array.isArray(converted) ? converted[0] : converted;
  return new File([jpeg], file.name.replace(HEIC_EXTENSIONS, ".jpg"), { type: "image/jpeg" });
}

function safeExtension(file: File) {
  const candidate = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return candidate || (file.type === "image/jpeg" ? "jpg" : "bin");
}

export async function uploadOrderImages(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<OrderAsset[]> {
  const uploaded: OrderAsset[] = [];
  const [{ count: visibleCount }, { data: lastAsset }] = await Promise.all([
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
  ]);
  let nextVisibleIndex = visibleCount ?? 0;
  let nextSortOrder = ((lastAsset as { album_sort_order?: number } | null)?.album_sort_order ?? -1) + 1;

  for (let index = 0; index < files.length; index += 1) {
    const file = await normalizeImage(files[index]);
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
    if (nextVisibleIndex < 30) nextVisibleIndex += 1;
    nextSortOrder += 1;
    onProgress?.(index + 1, files.length);
  }

  return uploaded;
}
