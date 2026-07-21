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

  return NextResponse.json({ checked: expiredOrders?.length ?? 0, expired, failed });
}
