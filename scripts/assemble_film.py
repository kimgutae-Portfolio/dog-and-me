#!/usr/bin/env python3
"""Assemble a WAN MEMORY customer film from Runway image-to-video clips.

Structure (see docs/MANUAL_PRODUCTION_WORKFLOW.md):
  intro card -> [photo hold -> clip] for the intro clip -> memory blocks
  ([photo hold -> clip] for each clip in the block) -> [photo hold -> clip]
  for the ending clip -> ending card.

Before every clip, its own source still (N.png, the Runway generation
reference for N-video.mp4) holds for PHOTO_HOLD_SECONDS and then crossfades
into that same clip starting to move — "the photo comes alive" — instead of
padding block length with a frozen/zoomed hold. Total runtime is therefore
no longer a fixed 60s; it follows however many clips each memory block has.

Usage:
  python3 scripts/assemble_film.py \
    --order-dir demo/customer-personas/hinata/WM-2026-3357CF \
    --intro-clip 1 --memory-clips 2,3 4,5 6 --ending-clip 7 \
    --kicker "A MEMORY FILM" \
    --title "ひなたと歩いた、いつもの季節" \
    --ending-text "ひなたへ。\\n特別なことがない日も、\\nあなたと歩くと全部が大切な思い出になります。\\nこれからも季節の匂いを一緒に見つけながら、\\nゆっくり同じ道を歩こうね。" \
    --out demo/customer-personas/hinata/WM-2026-3357CF/final.mp4
"""
import argparse
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 24
XFADE = 0.5
CLIP_SECONDS = 5.0
PHOTO_HOLD_SECONDS = 1.5
INTRO_CARD_SECONDS = 3.0
ENDING_CARD_SECONDS = 7.0

CREAM = (244, 240, 232)
INK = (37, 37, 31)
RUST = (157, 92, 62)

MINCHO = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
GOTHIC = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def text_center(draw, text, font, y, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((W - w) / 2, y), text, font=font, fill=fill)


def make_title_card(png_path, kicker, title):
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    f_kicker = ImageFont.truetype(GOTHIC, 28)
    f_title = ImageFont.truetype(MINCHO, 68, index=2)
    text_center(draw, kicker, f_kicker, H * 0.42, RUST)
    text_center(draw, title, f_title, H * 0.42 + 66, INK)
    img.save(png_path)


def make_ending_card(png_path, lines, mark):
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    f_body = ImageFont.truetype(MINCHO, 42, index=0)
    f_mark = ImageFont.truetype(GOTHIC, 24)
    line_h = 70
    total_h = line_h * len(lines)
    y0 = (H - total_h) / 2
    for i, line in enumerate(lines):
        text_center(draw, line, f_body, y0 + i * line_h, INK)
    text_center(draw, mark, f_mark, y0 + len(lines) * line_h + 50, RUST)
    img.save(png_path)


def image_to_clip(png_path, out_path, duration):
    """Static hold — used for title/ending cards and pre-clip photo holds."""
    run(["ffmpeg", "-y", "-loop", "1", "-i", png_path, "-t", str(duration),
         "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
         "-an", out_path])


def normalize_clip(src, out_path, duration=CLIP_SECONDS):
    run(["ffmpeg", "-y", "-i", src, "-t", str(duration),
         "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
         "-an", out_path])


def concat_with_xfade(segments, durations, out_path, letterbox_pct=0.0, film_look=False):
    n = len(segments)
    inputs = []
    for s in segments:
        inputs += ["-i", s]
    filter_parts = []
    prev_label = "0:v"
    cum = durations[0]
    for i in range(1, n):
        offset = cum - XFADE
        label = f"v{i}"
        filter_parts.append(
            f"[{prev_label}][{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}[{label}]"
        )
        cum = cum + durations[i] - XFADE
        prev_label = label
    if letterbox_pct > 0:
        bar = round(H * letterbox_pct / 100)
        filter_parts.append(
            f"[{prev_label}]drawbox=x=0:y=0:w={W}:h={bar}:color=black:t=fill,"
            f"drawbox=x=0:y={H - bar}:w={W}:h={bar}:color=black:t=fill[lb]"
        )
        prev_label = "lb"
    if film_look:
        # unify color across clips/cards (warm, gently desaturated), then
        # vignette + subtle temporal grain for a filmic texture
        filter_parts.append(
            f"[{prev_label}]eq=contrast=1.02:saturation=0.95:gamma=1.0:brightness=0.0,"
            f"colorbalance=rs=0.02:bs=-0.02:rm=0.01:bm=-0.01,"
            f"vignette=PI/3.2,noise=alls=6:allf=t[fl]"
        )
        prev_label = "fl"
    filter_complex = ";".join(filter_parts)
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_complex,
        "-map", f"[{prev_label}]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
        out_path,
    ]
    run(cmd)
    return cum


def mux_bgm(video_path, bgm_path, out_path, total_duration, ending_card_start):
    """BGM fades in at the start and fades fully to silence so it finishes
    exactly as the ending card appears — the ending plays with no music,
    not just a quieter version of it."""
    fade_out_dur = min(4.0, max(ending_card_start, 0))
    fade_out_start = max(ending_card_start - fade_out_dur, 0)
    af = (
        f"afade=t=in:st=0:d=1.5,"
        f"afade=t=out:st={fade_out_start:.2f}:d={fade_out_dur:.2f}"
    )
    run(["ffmpeg", "-y", "-i", video_path, "-i", bgm_path,
         "-filter_complex", f"[1:a]{af}[a]",
         "-map", "0:v", "-map", "[a]", "-t", str(total_duration),
         "-c:v", "copy", "-c:a", "aac", "-shortest", out_path])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--order-dir", required=True)
    ap.add_argument("--intro-clip", required=True, type=int)
    ap.add_argument("--memory-clips", required=True, nargs="+",
                     help='e.g. "2,3" "4,5" "6" — one group per memory block')
    ap.add_argument("--ending-clip", required=True, type=int)
    ap.add_argument("--kicker", default="A MEMORY FILM")
    ap.add_argument("--title", required=True)
    ap.add_argument("--ending-text", required=True, help="use \\n for line breaks")
    ap.add_argument("--ending-mark", default="WAN MEMORY")
    ap.add_argument("--bgm", default=None)
    ap.add_argument("--letterbox", action="store_true",
                     help="add cinematic black bars top/bottom")
    ap.add_argument("--letterbox-pct", type=float, default=6.0,
                     help="bar height as %% of frame height, each side (default 6.0)")
    ap.add_argument("--film-look", action="store_true",
                     help="unify color grade + vignette + subtle grain across the whole film")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    memory_groups = [[int(x) for x in g.split(",")] for g in args.memory_clips]
    order_dir = args.order_dir

    def clip_path(n):
        return os.path.join(order_dir, f"{n}-video.mp4")

    def photo_path(n):
        return os.path.join(order_dir, f"{n}.png")

    # Total clips drives the progress percentages below: intro + memories + ending.
    total_clips = 1 + sum(len(g) for g in memory_groups) + 1
    clips_done = 0

    def progress(percent, label):
        """Machine-readable progress on stderr for /api/admin/render to parse.

        Purely informational — it does not touch any ffmpeg invocation, so the
        rendered file is byte-identical with or without a reader attached.
        """
        print(f"[progress] {int(percent)} {label}", file=sys.stderr, flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        segments = []
        durations = []

        def add_photo_then_clip(n, tag):
            nonlocal clips_done
            hold_mp4 = os.path.join(tmp, f"seg_{tag}_photo.mp4")
            image_to_clip(photo_path(n), hold_mp4, PHOTO_HOLD_SECONDS)
            segments.append(hold_mp4)
            durations.append(PHOTO_HOLD_SECONDS)

            clip_mp4 = os.path.join(tmp, f"seg_{tag}_clip.mp4")
            normalize_clip(clip_path(n), clip_mp4)
            segments.append(clip_mp4)
            durations.append(CLIP_SECONDS)

            clips_done += 1
            progress(10 + 40 * clips_done / total_clips,
                     f"場面を整えています {clips_done}/{total_clips}")

        progress(5, "タイトルカードを作成中")

        # 1. Intro card
        intro_png = os.path.join(tmp, "intro.png")
        make_title_card(intro_png, args.kicker, args.title)
        intro_card_mp4 = os.path.join(tmp, "seg_intro_card.mp4")
        image_to_clip(intro_png, intro_card_mp4, INTRO_CARD_SECONDS)
        segments.append(intro_card_mp4)
        durations.append(INTRO_CARD_SECONDS)

        # 2. Intro clip (photo holds, then comes alive)
        add_photo_then_clip(args.intro_clip, "intro")

        # 3. Memory blocks
        for gi, group in enumerate(memory_groups):
            for clip_no in group:
                add_photo_then_clip(clip_no, f"mem{gi}_{clip_no}")

        # 4. Ending clip (photo holds, then comes alive)
        add_photo_then_clip(args.ending_clip, "ending")

        # 5. Ending card
        ending_lines = args.ending_text.split("\\n")
        ending_png = os.path.join(tmp, "ending.png")
        make_ending_card(ending_png, ending_lines, args.ending_mark)
        ending_card_mp4 = os.path.join(tmp, "seg_ending_card.mp4")
        image_to_clip(ending_png, ending_card_mp4, ENDING_CARD_SECONDS)
        segments.append(ending_card_mp4)
        durations.append(ENDING_CARD_SECONDS)

        print(f"[assemble] {len(segments)} segments, raw total "
              f"{sum(durations):.1f}s, after {len(segments)-1} crossfades "
              f"~{sum(durations) - XFADE*(len(segments)-1):.1f}s", file=sys.stderr)

        # The single concat call is most of the wall time — say so, because the
        # UI will otherwise look frozen here for minutes.
        progress(55, "全体をつなげています（数分かかります）")

        silent_out = os.path.join(tmp, "silent.mp4") if args.bgm else args.out
        letterbox_pct = args.letterbox_pct if args.letterbox else 0.0
        total_duration = concat_with_xfade(segments, durations, silent_out, letterbox_pct, args.film_look)

        if args.bgm:
            progress(92, "BGMを合わせています")
            ending_card_start = total_duration - ENDING_CARD_SECONDS
            mux_bgm(silent_out, args.bgm, args.out, total_duration, ending_card_start)

    progress(100, "編集が完了しました")
    print(f"[assemble] done -> {args.out} ({total_duration:.1f}s)", file=sys.stderr)


if __name__ == "__main__":
    main()
