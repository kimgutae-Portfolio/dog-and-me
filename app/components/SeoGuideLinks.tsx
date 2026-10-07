import Link from "next/link";

const guides = [
  [
    "ペットロスと愛犬の思い出の残し方",
    "写真・メモリアルグッズ・物語という選択肢",
    "/pet-loss-aiken-omoide",
  ],
  [
    "愛犬の誕生日メッセージ例文8選",
    "その子らしい言葉の書き方と、写真・動画への残し方",
    "/dog-birthday-message",
  ],
  [
    "愛犬の思い出を残す方法",
    "写真・動画・日記・動く絵本の選び方",
    "/aiken-omoide-douga",
  ],
  [
    "うちの子記念日のプレゼント",
    "記念品の選び方と、動く絵本の準備・納期",
    "/uchinoko-kinenbi-douga",
  ],
  [
    "絵本の写真選び",
    "物語ごとの基準写真と補助写真の準備方法",
    "/dog-photo-guide",
  ],
  [
    "愛犬の写真を動画にする方法",
    "写真選びから構成まで、思い出動画づくりの基本",
    "/aiken-shashin-douga",
  ],
  [
    "愛犬の写真を整理・保存する方法",
    "増え続ける写真を無理なく残す整理と保存のコツ",
    "/aiken-shashin-seiri",
  ],
] as const;

export function SeoGuideLinks({ currentPath }: { currentPath?: string }) {
  return (
    <nav className="seo-guide-links" aria-label="愛犬の動く絵本ガイド">
      <p>WAN MEMORY GUIDE</p>
      <div>
        {guides
          .filter(([, , path]) => path !== currentPath)
          .map(([title, copy, path]) => (
            <Link href={path} key={path}>
              <span>{title}</span>
              <small>{copy}</small>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
      </div>
    </nav>
  );
}
