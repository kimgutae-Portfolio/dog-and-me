import { Fragment } from "react";
import { DEFAULT_SITE_ORIGIN } from "../lib/site";

function readableUrl(value: string) {
  try { return decodeURI(value); } catch { return value; }
}

/** Render links as React text, never interpret a message as HTML. */
export function MessageText({ body }: { body: string }) {
  return body.split("\n").map((line, lineIndex) => {
    // Older delivery messages sometimes contain only a relative pet-site path.
    const text = /^\/[^\s/]+\/[^\s/]+\/?$/.test(line.trim())
      ? `${DEFAULT_SITE_ORIGIN}${line.trim()}`
      : line;
    return <Fragment key={lineIndex}>
      {lineIndex > 0 && "\n"}
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
        if (!/^https?:\/\//.test(part)) return part;
        let url: URL;
        try { url = new URL(part); } catch { return part; }
        const isPetSite = ["wanmemory.com", "www.wanmemory.com"].includes(url.hostname)
          && /^\/[^/]+\/[^/]+\/?$/.test(url.pathname)
          && !url.pathname.startsWith("/api/");
        return <a key={index} href={url.href} target="_blank" rel="noopener noreferrer"
          className="chat-message-link">
          {isPetSite ? "専用ホームページを見る ↗" : readableUrl(part)}
        </a>;
      })}
    </Fragment>;
  });
}
