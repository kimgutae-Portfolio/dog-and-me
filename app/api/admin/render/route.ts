import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import type {
  RenderClipRole,
  RenderProgressEvent,
} from "../../../lib/supabase/types";

export const runtime = "nodejs";
// Irrelevant while this runs on the operator's own machine; becomes the real
// ceiling if the assembly is ever moved onto deployed Vercel functions.
export const maxDuration = 300;

const BUCKET = "order-assets";
const BGM_DIR = path.join(process.cwd(), "assets", "bgm");
const ASSEMBLE_SCRIPT = path.join(process.cwd(), "scripts", "assemble_film.py");

type RequestItem = { clipAssetId: string; role: RenderClipRole };

type ClipRow = {
  id: string;
  order_id: string;
  category: string;
  storage_path: string;
  scene_sort_order: number;
  source_still_asset_id: string | null;
};

function ndjson(event: RenderProgressEvent) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

/** Reject anything that could escape assets/bgm/ or name a non-audio file. */
function safeBgmName(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value !== path.basename(value)) return null;
  return /\.(mp3|m4a|aac|wav|flac)$/i.test(value) ? value : null;
}

async function downloadTo(
  supabase: SupabaseClient,
  storagePath: string,
  destination: string,
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data)
    throw new Error(`ダウンロードに失敗しました: ${storagePath}`);
  await writeFile(destination, Buffer.from(await data.arrayBuffer()));
}

/**
 * Runs the existing scripts/assemble_film.py unchanged and forwards its
 * `[progress] <percent> <label>` stderr lines to `onProgress`.
 */
function runAssembler(
  args: string[],
  onProgress: (percent: number, label: string) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [ASSEMBLE_SCRIPT, ...args], {
      cwd: process.cwd(),
    });
    let stderrTail = "";

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = `${stderrTail}${text}`.slice(-4000);
      for (const line of text.split("\n")) {
        const match = /^\[progress\]\s+(\d+)\s+(.*)$/.exec(line.trim());
        if (match) onProgress(Number(match[1]), match[2]);
      }
    });

    child.on("error", (cause) =>
      reject(new Error(`python3 を起動できませんでした: ${cause.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `編集処理が失敗しました (exit ${code})\n${stderrTail.trim().slice(-1200)}`,
          ),
        );
    });
  });
}

export async function GET() {
  // Used by the admin screen to populate the BGM dropdown.
  if (process.env.WM_LOCAL_RENDER !== "1") {
    return Response.json({ available: false, tracks: [] });
  }
  try {
    const entries = await readdir(BGM_DIR);
    const tracks = entries.filter((name) => safeBgmName(name)).sort();
    return Response.json({ available: true, tracks });
  } catch {
    return Response.json({ available: true, tracks: [] });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.WM_LOCAL_RENDER !== "1") {
    return Response.json(
      {
        error: "local_only",
        message:
          "映像の編集はローカルの制作環境でのみ実行できます。`npm run dev:operator` で起動してください。",
      },
      { status: 501 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return Response.json({ error: "server_not_configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = payload.orderId;
  if (!isUuid(orderId))
    return Response.json({ error: "invalid_order" }, { status: 400 });

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items: RequestItem[] = [];
  for (const raw of rawItems) {
    const item = raw as Partial<RequestItem>;
    if (!isUuid(item.clipAssetId))
      return Response.json({ error: "invalid_clip" }, { status: 400 });
    if (
      item.role !== "intro" &&
      item.role !== "memory" &&
      item.role !== "transition" &&
      item.role !== "ending"
    ) {
      return Response.json({ error: "invalid_role" }, { status: 400 });
    }
    items.push({ clipAssetId: item.clipAssetId, role: item.role });
  }
  if (items.length !== 9) {
    return Response.json({ error: "invalid_item_count" }, { status: 400 });
  }
  if (
    items[0].role !== "intro" ||
    items.filter((i) => i.role === "intro").length !== 1
  ) {
    return Response.json({ error: "invalid_intro" }, { status: 400 });
  }
  if (
    items[items.length - 1].role !== "ending" ||
    items.filter((i) => i.role === "ending").length !== 1
  ) {
    return Response.json({ error: "invalid_ending" }, { status: 400 });
  }
  if (new Set(items.map((i) => i.clipAssetId)).size !== items.length) {
    return Response.json({ error: "duplicate_clip" }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const kicker =
    typeof payload.kicker === "string"
      ? payload.kicker.trim()
      : "A MOVING STORYBOOK";
  const endingText =
    typeof payload.endingText === "string" ? payload.endingText.trim() : "";
  const endingMark =
    typeof payload.endingMark === "string"
      ? payload.endingMark.trim()
      : "WAN MEMORY";
  if (!title || title.length > 80)
    return Response.json({ error: "invalid_title" }, { status: 400 });
  if (!endingText || endingText.length > 600)
    return Response.json({ error: "invalid_ending_text" }, { status: 400 });

  const letterboxPct =
    typeof payload.letterboxPct === "number" ? payload.letterboxPct : 0;
  if (letterboxPct < 0 || letterboxPct > 15)
    return Response.json({ error: "invalid_letterbox" }, { status: 400 });
  const filmLook = payload.filmLook === true;
  const bgmFile = safeBgmName(payload.bgmFile);

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !authData.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS already restricts this to admins, but fail fast with a clear reason.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: clipRows, error: clipError } = await supabase
    .from("assets")
    .select(
      "id, order_id, category, storage_path, scene_sort_order, source_still_asset_id",
    )
    .eq("order_id", orderId)
    .in("category", ["render_clip", "transition_clip"]);
  if (clipError)
    return Response.json({ error: "clip_lookup_failed" }, { status: 400 });

  const clipById = new Map(
    ((clipRows as ClipRow[] | null) ?? []).map((row) => [row.id, row]),
  );
  const ordered: ClipRow[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const clip = clipById.get(item.clipAssetId);
    if (!clip)
      return Response.json({ error: "clip_not_in_order" }, { status: 400 });
    if (item.role === "transition") {
      const expectedTransitionIndex = (index - 1) / 2;
      if (
        index % 2 !== 1 ||
        clip.category !== "transition_clip" ||
        clip.source_still_asset_id ||
        clip.scene_sort_order !== expectedTransitionIndex
      )
        return Response.json(
          { error: "invalid_transition_clip" },
          { status: 400 },
        );
    } else {
      const expectedStoryIndex = index / 2;
      const expectedRole =
        index === 0
          ? "intro"
          : index === items.length - 1
            ? "ending"
            : "memory";
      if (
        index % 2 !== 0 ||
        item.role !== expectedRole ||
        clip.category !== "render_clip" ||
        !clip.source_still_asset_id ||
        clip.scene_sort_order !== expectedStoryIndex
      ) {
        return Response.json({ error: "clip_missing_still" }, { status: 400 });
      }
    }
    ordered.push(clip);
  }

  const stillIds = ordered
    .filter((clip) => clip.category === "render_clip")
    .map((clip) => clip.source_still_asset_id as string);
  const { data: stillRows, error: stillError } = await supabase
    .from("assets")
    .select("id, storage_path, category, order_id, story_caption")
    .in("id", stillIds);
  if (stillError)
    return Response.json({ error: "still_lookup_failed" }, { status: 400 });
  const stillById = new Map(
    (
      (stillRows as
        | {
            id: string;
            storage_path: string;
            category: string;
            order_id: string;
            story_caption: string | null;
          }[]
        | null) ?? []
    ).map((row) => [row.id, row]),
  );
  for (const id of stillIds) {
    const still = stillById.get(id);
    if (
      !still ||
      still.category !== "scene_still" ||
      still.order_id !== orderId
    ) {
      return Response.json({ error: "still_not_in_order" }, { status: 400 });
    }
    if (!still.story_caption?.trim()) {
      return Response.json({ error: "story_caption_missing" }, { status: 400 });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RenderProgressEvent) =>
        controller.enqueue(ndjson(event));
      let workDir: string | null = null;
      let uploadedPath: string | null = null;

      try {
        workDir = await mkdtemp(path.join(tmpdir(), "wan-memory-render-"));

        // assemble_film.py addresses clips positionally as N.png / N-video.mp4,
        // so lay the downloads out in that shape and keep the CLI untouched.
        send({
          type: "progress",
          step: "download",
          message: "素材を読み込んでいます",
        });
        for (let index = 0; index < ordered.length; index += 1) {
          const clip = ordered[index];
          const n = index + 1;
          if (clip.category === "render_clip") {
            const still = stillById.get(clip.source_still_asset_id as string)!;
            await downloadTo(
              supabase,
              still.storage_path,
              path.join(workDir, `${n}.png`),
            );
          }
          await downloadTo(
            supabase,
            clip.storage_path,
            path.join(workDir, `${n}-video.mp4`),
          );
          send({
            type: "progress",
            step: "download",
            message: `素材を読み込んでいます ${index + 1}/${ordered.length}`,
          });
        }

        const outPath = path.join(workDir, "final.mp4");
        const captionsPath = path.join(workDir, "captions.json");
        await writeFile(
          captionsPath,
          JSON.stringify(
            ordered.map((clip) =>
              clip.category === "render_clip"
                ? stillById
                    .get(clip.source_still_asset_id as string)!
                    .story_caption!.trim()
                : "",
            ),
          ),
          "utf8",
        );
        const memoryClips = ordered
          .slice(1, -1)
          .map((_, index) => String(index + 2));
        const args = [
          "--order-dir",
          workDir,
          "--intro-clip",
          "1",
          "--memory-clips",
          ...(memoryClips.length ? memoryClips : ["1"]),
          "--ending-clip",
          String(ordered.length),
          "--kicker",
          kicker,
          "--title",
          title,
          "--ending-text",
          endingText.replace(/\n/g, "\\n"),
          "--ending-mark",
          endingMark,
          "--captions-json",
          captionsPath,
          "--out",
          outPath,
        ];
        if (letterboxPct > 0)
          args.push("--letterbox", "--letterbox-pct", String(letterboxPct));
        if (filmLook) args.push("--film-look");
        if (bgmFile) args.push("--bgm", path.join(BGM_DIR, bgmFile));

        await runAssembler(args, (percent, label) => {
          send({
            type: "progress",
            step: "assemble",
            message: `${label} (${percent}%)`,
          });
        });

        send({
          type: "progress",
          step: "upload",
          message: "完成した映像を保存しています",
        });
        const { size } = await stat(outPath);
        const { readFile } = await import("node:fs/promises");
        const bytes = await readFile(outPath);
        // Operator namespace — never the customer's uid folder. See the note at
        // the top of supabase/migrations/202607280001_render_clips.sql.
        const storagePath = `admin/${orderId}/render/assembled_film-${randomUUID()}.mp4`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, bytes, {
            contentType: "video/mp4",
            upsert: false,
          });
        if (uploadError)
          throw new Error(`保存に失敗しました: ${uploadError.message}`);
        uploadedPath = storagePath;

        // The local assembler uses one 5s moving page per Runway clip, with
        // a 0.7s picture-book page cover at every join. There are no frozen
        // photo holds between pages.
        const durationSeconds =
          3.0 + ordered.length * 5.0 + 7.0 - 0.7 * (ordered.length + 1);
        const { data: assetId, error: registerError } = await supabase.rpc(
          "admin_register_assembled_film",
          {
            p_order_id: orderId,
            p_storage_path: storagePath,
            p_original_filename: `${title}.mp4`,
            p_mime_type: "video/mp4",
            p_file_size: size,
            p_duration_seconds: durationSeconds,
          },
        );
        if (registerError) {
          // Storage first, RPC second, remove on failure — same invariant the
          // admin upload handlers keep, so no orphan objects accumulate.
          await supabase.storage.from(BUCKET).remove([storagePath]);
          uploadedPath = null;
          throw new Error(`登録に失敗しました: ${registerError.message}`);
        }

        send({
          type: "done",
          assetId: assetId as string,
          durationSeconds,
          fileSize: size,
        });
      } catch (cause) {
        if (uploadedPath)
          await supabase.storage
            .from(BUCKET)
            .remove([uploadedPath])
            .catch(() => {});
        send({
          type: "error",
          message:
            cause instanceof Error ? cause.message : "編集に失敗しました",
        });
      } finally {
        if (workDir)
          await rm(workDir, { recursive: true, force: true }).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
