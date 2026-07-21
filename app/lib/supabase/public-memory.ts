import { createClient } from "@supabase/supabase-js";

export type SharedMemoryPayload = {
  order: {
    id: string;
    order_number: string;
    pet_name: string;
    breed: string;
    purpose: string;
    message_to_pet: string | null;
    created_at: string;
  };
  delivery: {
    title: string;
    customer_message: string | null;
    video_storage_path: string;
  };
  concept: {
    title: string;
    tone: string;
    summary: string;
    scenes: string[];
  } | null;
  images: Array<{
    id: string;
    storage_path: string;
    caption: string | null;
    sort_order: number;
  }>;
};

const shareTokenPattern = /^[a-f0-9]{64}$/i;

function getPublicMemoryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function getPublicSharedMemory(token: string): Promise<SharedMemoryPayload | null> {
  if (!shareTokenPattern.test(token)) return null;
  const supabase = getPublicMemoryClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_shared_memory", { p_token: token });
  if (error || !data || typeof data !== "object") return null;
  return data as SharedMemoryPayload;
}

export async function getPublicMemoryHeroUrl(memory: SharedMemoryPayload): Promise<string | null> {
  const path = memory.images[0]?.storage_path;
  if (!path) return null;
  const supabase = getPublicMemoryClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from("order-assets").createSignedUrl(path, 90);
  return error ? null : data?.signedUrl ?? null;
}
