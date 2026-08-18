"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ChangeEvent } from "react";
import { CustomerCharacterGuide } from "../film/[orderId]/CustomerCharacterGuide";

export type AlbumImage = {
  id: string;
  url: string;
  caption: string | null;
  kind: "scene_still" | "source_image" | "album_photo";
};

type Props = {
  title: string;
  petName: string;
  breed: string;
  purpose: string;
  createdAt: string;
  message: string;
  videoUrl: string;
  images: AlbumImage[];
  albumTotal?: number;
  canManageAlbum?: boolean;
  albumBusy?: boolean;
  albumNotice?: string;
  onAlbumUpload?: (files: File[]) => void;
  onAlbumDelete?: (imageId: string) => void;
  onLoadMore?: () => void;
  characterSpriteUrl?: string;
  backHref?: string;
  backLabel?: string;
};

export function PersonalStorybookSite({
  title,
  petName,
  breed,
  purpose,
  createdAt,
  message,
  videoUrl,
  images,
  albumTotal = images.length,
  canManageAlbum = false,
  albumBusy = false,
  albumNotice = "",
  onAlbumUpload,
  onAlbumDelete,
  onLoadMore,
  characterSpriteUrl = "",
  backHref = "/",
  backLabel = "WAN MEMORYへ戻る ↗",
}: Props) {
  const heroImage = images[0]?.url;
  const hasMoreImages = images.length < albumTotal;
  const chooseAlbumPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) onAlbumUpload?.(files);
  };

  return (
    <main className="moka-demo personal-storybook-site">
      <header className="moka-nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOK</small>
          </span>
        </Link>
        <span>PERSONAL STORYBOOK SITE</span>
        <Link href={backHref}>{backLabel}</Link>
      </header>

      <section className={`moka-cover${heroImage ? "" : " personal-storybook-cover-empty"}`}>
        {heroImage && (
          <img
            src={heroImage}
            alt={`${petName}の思い出写真`}
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
          />
        )}
        <div className="moka-cover-wash" aria-hidden="true" />
        <div className="moka-cover-copy">
          <p>A STORY FOR {petName.toUpperCase()}</p>
          <h1>{title}</h1>
          <span>{breed} · {purpose}</span>
          <a href="#complete-film">作品を再生する <i aria-hidden="true">↓</i></a>
        </div>
      </section>

      <section className="moka-complete-film" id="complete-film">
        <div className="moka-shell">
          <div className="moka-heading">
            <div>
              <p>01 / COMPLETE FILM</p>
              <h2>大切な時間を、<br />一冊の映像に。</h2>
            </div>
            <span>画面を大きくしてお楽しみください。</span>
          </div>
          <div className="moka-main-player personal-storybook-player">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                poster={heroImage}
                onContextMenu={(event) => event.preventDefault()}
                aria-label={`${petName}の完成映像`}
              />
            ) : (
              <div>動く絵本を準備しています</div>
            )}
          </div>
          <p className="moka-note">その子との思い出を、何度でも見返せる一つの物語としてつないでいます。</p>
        </div>
      </section>

      {(images.length > 0 || canManageAlbum) && (
        <section className="moka-album" id="photo-album">
          <div className="moka-shell">
            <div className="moka-heading">
              <div>
                <p>02 / {petName.toUpperCase()}&apos;S PHOTO ALBUM</p>
                <h2>{petName}の時間を、<br />一つの写真帖に。</h2>
              </div>
              <span>{albumTotal}枚の思い出</span>
            </div>
            <div className="lifetime-album-head">
              <p className="moka-album-intro">
                物語のために描いた場面から始まり、制作に使った写真、完成後の日々の写真へ。これからも育っていく、その子だけのアルバムです。
              </p>
              {canManageAlbum && (
                <label className={albumBusy ? "lifetime-album-upload busy" : "lifetime-album-upload"}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    disabled={albumBusy}
                    onChange={chooseAlbumPhotos}
                  />
                  <strong>{albumBusy ? "写真を追加しています…" : "新しい思い出を追加"}</strong>
                  <small>1枚20MBまで · 一度に50枚まで</small>
                </label>
              )}
            </div>
            {albumNotice && (
              <p className="lifetime-album-notice" role="status" aria-live="polite">
                {albumNotice}
              </p>
            )}
            <ol className="moka-album-grid" aria-label={`${petName}の写真アルバム。スマートフォンでは左右にスワイプできます。`}>
              {images.map((image, index) => (
                <li key={image.id}>
                  <figure>
                    <img
                      src={image.url}
                      alt={`${petName}の思い出写真 ${index + 1}`}
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(event) => event.preventDefault()}
                    />
                    <figcaption>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span className="album-photo-copy">
                        <em>
                          {image.kind === "scene_still"
                            ? "STORYBOOK PAGE"
                            : image.kind === "album_photo"
                              ? "NEW MEMORY"
                              : "MEMORY PHOTO"}
                        </em>
                        {image.caption || `${petName}との思い出`}
                      </span>
                    </figcaption>
                    {canManageAlbum && image.kind === "album_photo" && (
                      <button
                        className="lifetime-album-delete"
                        type="button"
                        disabled={albumBusy}
                        onClick={() => onAlbumDelete?.(image.id)}
                      >
                        この写真を削除
                      </button>
                    )}
                  </figure>
                </li>
              ))}
            </ol>
            {hasMoreImages && onLoadMore && (
              <button
                className="button button-outline lifetime-album-more"
                type="button"
                disabled={albumBusy}
                onClick={onLoadMore}
              >
                続きの写真を見る（残り{albumTotal - images.length}枚）
              </button>
            )}
          </div>
        </section>
      )}

      <section className="moka-letter">
        <p>03 / A LETTER FOR {petName.toUpperCase()}</p>
        <blockquote>{message}</blockquote>
        <span>FROM YOUR FAMILY</span>
      </section>

      <footer className="moka-footer">
        <div>
          <span className="brand-mark" aria-hidden="true">WM</span>
          <p>THIS STORY WAS DRAWN FOR {petName.toUpperCase()}<br /><small>© WAN MEMORY</small></p>
        </div>
        <span className="personal-storybook-year">
          {petName} · {new Date(createdAt).getFullYear()}
        </span>
      </footer>

      {characterSpriteUrl && (
        <CustomerCharacterGuide
          spriteUrl={characterSpriteUrl}
          petName={petName}
        />
      )}
    </main>
  );
}
