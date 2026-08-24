import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const CONFIRMATION_TEXT = "退会する";
const STORAGE_BUCKET = "order-assets";

type StorageEntry = {
  id?: string | null;
  name: string;
};

async function listStorageFiles(
  supabase: SupabaseClient,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    const entries = (data ?? []) as StorageEntry[];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) files.push(path);
      else files.push(...(await listStorageFiles(supabase, path)));
    }
    if (entries.length < 1000) break;
    offset += entries.length;
  }

  return files;
}

async function removeStorageFiles(
  supabase: SupabaseClient,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization");

  if (
    !supabaseUrl ||
    !publishableKey ||
    !serviceRoleKey ||
    !authorization?.startsWith("Bearer ")
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { password?: unknown; confirmation?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  const confirmation =
    typeof payload.confirmation === "string" ? payload.confirmation.trim() : "";
  if (!password || confirmation !== CONFIRMATION_TEXT) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  const accessToken = authorization.slice(7);
  const customerClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } =
    await customerClient.auth.getUser(accessToken);
  const customer = authData.user;
  if (authError || !customer?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await customerClient
    .from("profiles")
    .select("role")
    .eq("id", customer.id)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  if (profile.role !== "customer") {
    return NextResponse.json({ error: "admin_account_forbidden" }, { status: 403 });
  }

  const verificationClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verification, error: verificationError } =
    await verificationClient.auth.signInWithPassword({
      email: customer.email,
      password,
    });
  if (verificationError || verification.user?.id !== customer.id) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const storagePaths = await listStorageFiles(admin, customer.id);
    await removeStorageFiles(admin, storagePaths);

    const { error: prepareError } = await admin.rpc(
      "prepare_customer_account_deletion",
      { p_user_id: customer.id },
    );
    if (prepareError) throw prepareError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(
      customer.id,
      false,
    );
    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "deletion_failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
