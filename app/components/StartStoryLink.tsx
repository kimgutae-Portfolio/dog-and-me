"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { START_STORY_HREF } from "../lib/site";
import { useAuth } from "./AuthProvider";

type StartStoryLinkProps = {
  children: ReactNode;
  className?: string;
};

export function StartStoryLink({ children, className }: StartStoryLinkProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [queued, setQueued] = useState(false);
  const href = user ? "/story" : START_STORY_HREF;

  useEffect(() => {
    if (!queued || loading) return;
    router.push(user ? "/story" : START_STORY_HREF);
  }, [loading, queued, router, user]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!loading) return;
    event.preventDefault();
    setQueued(true);
  };

  return (
    <Link className={className} href={href} onClick={handleClick} aria-busy={queued || undefined}>
      {children}
    </Link>
  );
}
