import Link from "next/link";

const guides = [
  [
    "愛犬の動く絵本",
    "写真と三つの思い出からつくる物語の特徴と制作の流れ",
    "/aiken-omoide-douga",
  ],
  [
    "うちの子記念日の物語",
    "家族になった日を動く絵本に残すヒント",
    "/uchinoko-kinenbi-douga",
  ],
  [
    "絵本の写真選び",
    "お気に入りの代表写真と思い出写真の準備方法",
    "/dog-photo-guide",
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
