import Link from "next/link";

const guides = [
  ["愛犬の思い出動画", "写真からつくるオーダーメイド動画の特徴と制作の流れ", "/aiken-omoide-douga"],
  ["うちの子記念日動画", "家族になった日や誕生日を約1分の映像に残すヒント", "/uchinoko-kinenbi-douga"],
  ["愛犬写真の選び方", "顔・全身・横向きなど、制作に適した写真の準備方法", "/dog-photo-guide"],
] as const;

export function SeoGuideLinks({ currentPath }: { currentPath?: string }) {
  return (
    <nav className="seo-guide-links" aria-label="愛犬の思い出動画ガイド">
      <p>WAN MEMORY GUIDE</p>
      <div>
        {guides.filter(([, , path]) => path !== currentPath).map(([title, copy, path]) => (
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
