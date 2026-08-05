#!/usr/bin/env python3
"""Assemble a WAN MEMORY moving storybook from Runway image-to-video clips.

Structure (see docs/MANUAL_PRODUCTION_WORKFLOW.md):
  intro card -> moving storybook pages -> ending card.

Each approved Runway clip is one continuous page. There is no still-photo
hold between pages, so the story never appears to stop. Pages change with a
short page-cover transition (`coverright`), which reads like a new
picture-book page covering the page before it. Total runtime follows the
number of approved clips.

Usage:
  python3 scripts/assemble_film.py \
    --order-dir demo/customer-personas/hinata/WM-2026-3357CF \
    --intro-clip 1 --memory-clips 2,3 4,5 6 --ending-clip 7 \
    --kicker "A MOVING STORYBOOK" \
    --title "ひなたと歩いた、いつもの季節" \
    --ending-text "ひなたへ。\\n特別なことがない日も、\\nあなたと歩くと全部が大切な思い出になります。\\nこれからも季節の匂いを一緒に見つけながら、\\nゆっくり同じ道を歩こうね。" \
    --out demo/customer-personas/hinata/WM-2026-3357CF/final.mp4
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 24
SOURCE_CLIP_SECONDS = 5.0
STORY_CLIP_SECONDS = 7.0
BRIDGE_CLIP_SECONDS = 1.6
PAGE_CURL_SECONDS = 0.95
BRIDGE_DISSOLVE_SECONDS = 0.28
CARD_DISSOLVE_SECONDS = 0.65
ENDING_DISSOLVE_SECONDS = 0.75
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


def wrap_story_text(draw, text, font, max_width):
    """Wrap Japanese story text without relying on whitespace boundaries."""
    lines = []
    current = ""
    for char in text.strip():
        candidate = current + char
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if current and bbox[2] - bbox[0] > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:2]


def make_story_caption_overlay(png_path, text):
    """Draw one quiet picture-book sentence on a translucent paper ribbon."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(MINCHO, 48, index=0)
    lines = wrap_story_text(draw, text, font, 1460)
    line_h = 68
    text_boxes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    text_w = max((box[2] - box[0] for box in text_boxes), default=0)
    panel_w = min(W - 180, text_w + 110)
    panel_h = 54 + line_h * len(lines)
    x0 = (W - panel_w) / 2
    y0 = H - panel_h - 72
    draw.rounded_rectangle(
        (x0, y0, x0 + panel_w, y0 + panel_h),
        radius=18,
        fill=(248, 243, 234, 218),
        outline=(111, 94, 82, 42),
        width=1,
    )
    for index, line in enumerate(lines):
        box = text_boxes[index]
        width = box[2] - box[0]
        draw.text(
            ((W - width) / 2, y0 + 27 + index * line_h),
            line,
            font=font,
            fill=(61, 55, 49, 255),
        )
    img.save(png_path)


def burn_story_captions(video_path, captions, windows, out_path, total_duration, tmp_dir):
    """Burn approved scene sentences into the assembled storybook with soft caption fades."""
    if not any(caption.strip() for caption in captions):
        return
    inputs = ["-i", video_path]
    filters = []
    previous = "0:v"
    overlay_index = 0
    for scene_index, (caption, (start, end)) in enumerate(
        zip(captions, windows), start=1
    ):
        if not caption.strip():
            continue
        overlay_index += 1
        overlay_path = os.path.join(tmp_dir, f"caption_{scene_index}.png")
        make_story_caption_overlay(overlay_path, caption)
        duration = max(end - start, 0.8)
        fade = min(0.45, duration / 3)
        inputs += [
            "-loop", "1", "-framerate", str(FPS), "-t",
            f"{duration:.3f}", "-i", overlay_path,
        ]
        overlay_label = f"caption{scene_index}"
        output_label = f"captioned{scene_index}"
        filters.append(
            f"[{overlay_index}:v]format=rgba,"
            f"fade=t=in:st=0:d={fade:.3f}:alpha=1,"
            f"fade=t=out:st={duration - fade:.3f}:d={fade:.3f}:alpha=1,"
            f"setpts=PTS+{start:.3f}/TB[{overlay_label}]"
        )
        filters.append(
            f"[{previous}][{overlay_label}]overlay=0:0:eof_action=pass[{output_label}]"
        )
        previous = output_label
    run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(filters),
        "-map", f"[{previous}]", "-an", "-t", f"{total_duration:.3f}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
        out_path,
    ])


def image_to_clip(png_path, out_path, duration):
    """Create a static page — used only for the title and ending cards."""
    run(["ffmpeg", "-y", "-loop", "1", "-i", png_path, "-t", str(duration),
         "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
         "-an", out_path])


def normalize_story_clip(src, out_path):
    """Give each story page enough reading time without introducing a freeze.

    The original five-second Runway motion is played slightly slower. Frame
    blending keeps restrained watercolor motion soft instead of juddering.
    """
    speed = STORY_CLIP_SECONDS / SOURCE_CLIP_SECONDS
    run([
        "ffmpeg", "-y", "-i", src, "-t", str(SOURCE_CLIP_SECONDS),
        "-vf",
        (
            f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"setpts={speed:.6f}*PTS,minterpolate=fps={FPS}:mi_mode=blend,"
            "format=yuv420p"
        ),
        "-an", "-t", str(STORY_CLIP_SECONDS), out_path,
    ])


def normalize_bridge_clip(src, out_path):
    """Use a moving bridge only as a brief visual breath, never a full scene."""
    source_offset = max((SOURCE_CLIP_SECONDS - BRIDGE_CLIP_SECONDS) / 2, 0)
    run([
        "ffmpeg", "-y", "-ss", f"{source_offset:.3f}", "-i", src,
        "-t", str(BRIDGE_CLIP_SECONDS),
        "-vf",
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p",
        "-an", out_path,
    ])


def transition_spec(previous_kind, next_kind):
    if previous_kind == "title":
        return "fade", CARD_DISSOLVE_SECONDS
    if next_kind == "ending_card":
        return "fade", ENDING_DISSOLVE_SECONDS
    if previous_kind == "story" and next_kind == "bridge":
        return "page_curl", PAGE_CURL_SECONDS
    if previous_kind == "bridge" and next_kind == "story":
        return "fade", BRIDGE_DISSOLVE_SECONDS
    return "fade", CARD_DISSOLVE_SECONDS


def page_curl_filter(previous_label, input_index, duration, offset, output_label):
    """A bowed paper edge plus a neutral shadow, instead of a PPT-style wipe."""
    boundary = "W*(1-P)+sin(Y/H*PI)*W*0.08*sin(P*PI)"
    expression = (
        f"if(lt(X,{boundary}),A,"
        f"if(lt(X,{boundary}+5),if(eq(PLANE,0),235,128),"
        f"if(lt(X,{boundary}+80),"
        f"if(eq(PLANE,0),B*(0.62+0.38*(X-({boundary}))/80),B),B)))"
    )
    return (
        f"[{previous_label}][{input_index}:v]"
        f"xfade=transition=custom:duration={duration:.3f}:offset={offset:.3f}:"
        f"expr='{expression}'[{output_label}]"
    )


def concat_with_xfade(
    segments, durations, kinds, out_path, letterbox_pct=0.0, film_look=False
):
    n = len(segments)
    inputs = []
    for s in segments:
        inputs += ["-i", s]
    filter_parts = []
    prev_label = "0:v"
    cum = durations[0]
    segment_starts = [0.0]
    transition_durations = []
    for i in range(1, n):
        transition, transition_duration = transition_spec(kinds[i - 1], kinds[i])
        offset = cum - transition_duration
        label = f"v{i}"
        if transition == "page_curl":
            filter_parts.append(
                page_curl_filter(
                    prev_label, i, transition_duration, offset, label
                )
            )
        else:
            filter_parts.append(
                f"[{prev_label}][{i}:v]xfade=transition=fade:"
                f"duration={transition_duration:.3f}:offset={offset:.3f}[{label}]"
            )
        segment_starts.append(offset)
        transition_durations.append(transition_duration)
        cum = cum + durations[i] - transition_duration
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
    return cum, segment_starts, transition_durations


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
    ap.add_argument("--bridge-clips", nargs="*", type=int, default=[])
    ap.add_argument("--kicker", default="A MOVING STORYBOOK")
    ap.add_argument("--title", required=True)
    ap.add_argument("--ending-text", required=True, help="use \\n for line breaks")
    ap.add_argument("--ending-mark", default="WAN MEMORY")
    ap.add_argument("--captions-json", default=None,
                    help="JSON array with one approved story sentence per scene")
    ap.add_argument("--bgm", default=None)
    ap.add_argument("--letterbox", action="store_true",
                     help="add cinematic black bars top/bottom")
    ap.add_argument("--letterbox-pct", type=float, default=6.0,
                     help="bar height as %% of frame height, each side (default 6.0)")
    ap.add_argument("--film-look", action="store_true",
                     help="unify color grade + vignette + subtle grain across the whole film")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    captions = []
    if args.captions_json:
        with open(args.captions_json, "r", encoding="utf-8") as handle:
            captions = json.load(handle)
        if not isinstance(captions, list) or not all(
            isinstance(item, str) for item in captions
        ):
            raise ValueError("captions JSON must be a string array")
        captions = [item.strip() for item in captions]

    memory_groups = [[int(x) for x in g.split(",")] for g in args.memory_clips]
    bridge_clip_numbers = set(args.bridge_clips)
    order_dir = args.order_dir

    def clip_path(n):
        return os.path.join(order_dir, f"{n}-video.mp4")

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
        segment_kinds = []

        def add_storybook_clip(n, tag):
            nonlocal clips_done
            clip_mp4 = os.path.join(tmp, f"seg_{tag}_clip.mp4")
            if n in bridge_clip_numbers:
                normalize_bridge_clip(clip_path(n), clip_mp4)
                clip_duration = BRIDGE_CLIP_SECONDS
                clip_kind = "bridge"
            else:
                normalize_story_clip(clip_path(n), clip_mp4)
                clip_duration = STORY_CLIP_SECONDS
                clip_kind = "story"
            segments.append(clip_mp4)
            durations.append(clip_duration)
            segment_kinds.append(clip_kind)

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
        segment_kinds.append("title")

        # 2. Intro clip — the first moving picture-book page.
        add_storybook_clip(args.intro_clip, "intro")

        # 3. Memory blocks
        for gi, group in enumerate(memory_groups):
            for clip_no in group:
                add_storybook_clip(clip_no, f"mem{gi}_{clip_no}")

        # 4. Ending clip — still moving continuously before the final page.
        add_storybook_clip(args.ending_clip, "ending")

        # 5. Ending card
        ending_lines = args.ending_text.split("\\n")
        ending_png = os.path.join(tmp, "ending.png")
        make_ending_card(ending_png, ending_lines, args.ending_mark)
        ending_card_mp4 = os.path.join(tmp, "seg_ending_card.mp4")
        image_to_clip(ending_png, ending_card_mp4, ENDING_CARD_SECONDS)
        segments.append(ending_card_mp4)
        durations.append(ENDING_CARD_SECONDS)
        segment_kinds.append("ending_card")

        if captions and len(captions) != total_clips:
            raise ValueError(f"expected {total_clips} scene captions, received {len(captions)}")

        # The single concat call is most of the wall time — say so, because the
        # UI will otherwise look frozen here for minutes.
        progress(55, "全体をつなげています（数分かかります）")

        needs_post_process = bool(args.bgm or captions)
        assembled_out = os.path.join(tmp, "assembled.mp4") if needs_post_process else args.out
        letterbox_pct = args.letterbox_pct if args.letterbox else 0.0
        total_duration, segment_starts, transition_durations = concat_with_xfade(
            segments,
            durations,
            segment_kinds,
            assembled_out,
            letterbox_pct,
            args.film_look,
        )

        caption_windows = []
        for index in range(total_clips):
            clip_index = 1 + index
            transition_in = transition_durations[clip_index - 1]
            transition_out = (
                transition_durations[clip_index]
                if clip_index < len(transition_durations)
                else 0
            )
            caption_windows.append((
                segment_starts[clip_index] + transition_in + 0.18,
                segment_starts[clip_index]
                + durations[clip_index]
                - transition_out
                - 0.18,
            ))

        print(
            f"[assemble] {len(segments)} segments, raw total "
            f"{sum(durations):.1f}s, after {len(transition_durations)} "
            f"editorial transitions ~{total_duration:.1f}s",
            file=sys.stderr,
        )

        video_for_audio = assembled_out
        if captions:
            progress(86, "物語の文章を重ねています")
            captioned_out = os.path.join(tmp, "captioned.mp4") if args.bgm else args.out
            burn_story_captions(
                assembled_out, captions, caption_windows, captioned_out,
                total_duration, tmp,
            )
            video_for_audio = captioned_out

        if args.bgm:
            progress(92, "BGMを合わせています")
            ending_card_start = total_duration - ENDING_CARD_SECONDS
            mux_bgm(video_for_audio, args.bgm, args.out, total_duration, ending_card_start)

    progress(100, "編集が完了しました")
    print(f"[assemble] done -> {args.out} ({total_duration:.1f}s)", file=sys.stderr)


if __name__ == "__main__":
    main()
