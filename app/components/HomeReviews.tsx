"use client";

import { useState } from "react";
import styles from "./HomeReviews.module.css";

const reviews = [
  {
    id: "mua",
    name: "ムア",
    website: "https://www.wanmemory.com/memory/mua",
    body: "写真を選んで思い出を伝えると、ムアだけの動く絵本になって、とても嬉しかったです。専用のホームページで家族と一緒に見返せるのも気に入っています。完成して終わりではなく、アルバムに新しい写真を追加できるので、これからもムアの思い出を少しずつ残していくのが楽しみです。",
  },
  {
    id: "daifuku",
    name: "だいふく",
    body: "愛犬との大切な思い出を、こんな素敵な形に残すことができて本当に嬉しいです。\n写真だけでは残せない、その時の気持ちや思い出まで一冊に詰まっていて、何度でも見返したくなる特別なアルバムになりました。\n\n今は当たり前のように一緒に過ごしている毎日も、いつか振り返ったときにきっと大切な宝物になると思います。\nいつかのために、そして一生大事にするために残しておきたい、自分だけの特別な一冊です。\n素敵な絵本を作っていただき、本当にありがとうございました。🐶",
  },
] as const;

function ReviewCard({ review }: { review: (typeof reviews)[number] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <figure className={styles["home-review"]}>
      <div className={styles["home-review-work-image"]}>
        <video
          controls playsInline preload="none"
          poster={`/reviews/${review.id}/poster.jpg`}
          aria-label={`${review.name}の動く絵本を再生`}
          onPlay={(event) => {
            const current = event.currentTarget;
            current.closest("section")?.querySelectorAll("video").forEach((video) => {
              if (video !== current) video.pause();
            });
          }}
        >
          <source src={`/reviews/${review.id}/storybook.mp4`} type="video/mp4" />
          お使いのブラウザでは動画を再生できません。
        </video>
      </div>
      <blockquote>
        <p id={`review-${review.id}`} className={expanded ? undefined : styles["home-review-excerpt"]}>{review.body}</p>
        <button type="button" className={styles["home-review-read-more"]}
          aria-expanded={expanded} aria-controls={`review-${review.id}`}
          aria-label={`${review.name}のレビューを${expanded ? "折りたたむ" : "全文読む"}`}
          onClick={() => setExpanded(!expanded)}>{expanded ? "閉じる −" : "続きを読む ＋"}</button>
      </blockquote>
      <figcaption>
        <span className={styles["home-review-character"]} role="img" aria-label={`${review.name}のキャラクター`}
          style={{ backgroundImage: `url(/reviews/${review.id}/character.png)` }} />
        <span>{review.name}のご家族より</span>
      </figcaption>
      {"website" in review && (
        <a className={styles["home-review-website"]} href={review.website}
          target="_blank" rel="noopener noreferrer"
          aria-label={`${review.name}のホームページを見る（新しいタブで開きます）`}>
          <span>{review.name}のホームページを見る</span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </figure>
  );
}

export function HomeReviews() {
  return (
    <section className={`${styles["home-reviews"]} section`} id="reviews" aria-labelledby="reviews-title">
      <div className="shell">
        <div className={styles["home-reviews-heading"]}>
          <h2 id="reviews-title">ご家族の声</h2>
          <span className={styles["home-reviews-swipe"]}>横にスワイプ <span aria-hidden="true">↔</span></span>
        </div>
        <div className={styles["home-reviews-grid"]} tabIndex={0} role="group" aria-label="ご家族のレビュー2件。横にスクロールしてご覧ください。">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      </div>
    </section>
  );
}
