"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { CustomerCharacterGuide } from "../film/[orderId]/CustomerCharacterGuide";

type AlbumImage = {
  id: string;
  url: string;
  caption: string | null;
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
  characterSpriteUrl = "",
  backHref = "/",
  backLabel = "WAN MEMORYへ戻る ↗",
}: Props) {
  const heroImage = images[0]?.url;

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

      {images.length > 0 && (
        <section className="moka-album">
          <div className="moka-shell">
            <div className="moka-heading">
              <div>
                <p>02 / {petName.toUpperCase()}&apos;S PHOTO ALBUM</p>
                <h2>{petName}の時間を、<br />一つの写真帖に。</h2>
              </div>
              <span>{images.length}枚の思い出</span>
            </div>
            <p className="moka-album-intro">
              ご家族が選んだ大切な写真を、その子だけのアルバムとして並べています。
            </p>
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
                      {image.caption || `${petName}との思い出`}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ol>
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
