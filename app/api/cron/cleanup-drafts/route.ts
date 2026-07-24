import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "cleanup environment is not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: expiredStoryDrafts, error: storyDraftError } = await supabase
    .from("story_drafts")
    .select("id,user_id")
    .lte("expires_at", new Date().toISOString())
    .limit(50);
  if (storyDraftError) return NextResponse.json({ error: storyDraftError.message }, { status: 500 });

  const expiredStoryDraftIds: string[] = [];
  const storyDraftFailures: Array<{ draftId: string; reason: string }> = [];
  for (const storyDraft of expiredStoryDrafts ?? []) {
    const { data: draftAssets, error: draftAssetError } = await supabase
      .from("story_draft_assets")
      .select("storage_path")
      .eq("draft_id", storyDraft.id);
    if (draftAssetError) {
      storyDraftFailures.push({ draftId: storyDraft.id, reason: draftAssetError.message });
      continue;
    }
    const paths = (draftAssets ?? []).map((asset) => asset.storage_path);
    let removablePaths = paths;
    if (paths.length) {
      const { data: promotedAssets, error: promotedAssetError } = await supabase
        .from("assets")
        .select("storage_path")
        .in("storage_path", paths);
      if (promotedAssetError) {
        storyDraftFailures.push({ draftId: storyDraft.id, reason: promotedAssetError.message });
        continue;
      }
      const promotedPaths = new Set((promotedAssets ?? []).map((asset) => asset.storage_path));
      removablePaths = paths.filter((path) => !promotedPaths.has(path));
    }
    if (removablePaths.length) {
      const { error: storageError } = await supabase.storage.from("order-assets").remove(removablePaths);
      if (storageError) {
        storyDraftFailures.push({ draftId: storyDraft.id, reason: storageError.message });
        continue;
      }
    }
    const { error: deleteError } = await supabase.from("story_drafts").delete().eq("id", storyDraft.id);
    if (deleteError) {
      storyDraftFailures.push({ draftId: storyDraft.id, reason: deleteError.message });
      continue;
    }
    expiredStoryDraftIds.push(storyDraft.id);
  }

  const { data: expiredOrders, error: orderError } = await supabase
    .from("orders")
    .select("id,user_id,status")
    .in("status", ["awaiting_materials", "cancelled"])
    .not("draft_expires_at", "is", null)
    .lte("draft_expires_at", new Date().toISOString())
    .limit(50);

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const expired: string[] = [];
  const failed: Array<{ orderId: string; reason: string }> = [];
  for (const item of expiredOrders ?? []) {
    const { data: assets, error: assetError } = await supabase
      .from("assets")
      .select("id,storage_path")
      .eq("order_id", item.id)
      .eq("category", "source_image");
    if (assetError) {
      failed.push({ orderId: item.id, reason: assetError.message });
      continue;
    }
    const sourcePrefix = `${item.user_id}/${item.id}/source`;
    const { data: storedFiles, error: listError } = await supabase.storage
      .from("order-assets")
      .list(sourcePrefix, { limit: 1000 });
    if (listError) {
      failed.push({ orderId: item.id, reason: listError.message });
      continue;
    }

    if (item.status === "awaiting_materials") {
      const { error: expireError } = await supabase.rpc("expire_memory_order_draft", { p_order_id: item.id });
      if (expireError) {
        failed.push({ orderId: item.id, reason: expireError.message });
        continue;
      }
    }

    const paths = [...new Set([
      ...(assets ?? []).map((asset) => asset.storage_path),
      ...(storedFiles ?? []).map((file) => `${sourcePrefix}/${file.name}`),
    ])];
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("order-assets").remove(paths);
      if (storageError) {
        failed.push({ orderId: item.id, reason: `draft expired, storage cleanup failed: ${storageError.message}` });
        continue;
      }
      const { error: deleteError } = await supabase.from("assets").delete().in("id", (assets ?? []).map((asset) => asset.id));
      if (deleteError) {
        failed.push({ orderId: item.id, reason: `storage deleted, asset metadata cleanup failed: ${deleteError.message}` });
        continue;
      }
    }
    expired.push(item.id);
  }

  return NextResponse.json({
    storyDrafts: {
      checked: expiredStoryDrafts?.length ?? 0,
      expired: expiredStoryDraftIds,
      failed: storyDraftFailures,
    },
    orders: { checked: expiredOrders?.length ?? 0, expired, failed },
  });
}
