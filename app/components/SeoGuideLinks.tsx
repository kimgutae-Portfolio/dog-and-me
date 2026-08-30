import Link from "next/link";

const guides = [
  [
    "愛犬の動く絵本",
    "5つの物語と場面写真からつくる制作の流れ",
    "/aiken-omoide-douga",
  ],
  [
    "うちの子記念日の物語",
    "家族になった日を動く絵本に残すヒント",
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
