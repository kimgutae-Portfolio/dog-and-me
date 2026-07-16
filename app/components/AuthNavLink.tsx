"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function AuthNavLink() {
  const { user, loading } = useAuth();
  if (loading) return <span className="auth-nav-muted">確認中</span>;
  return user ? <Link href="/studio">マイ制作室</Link> : <Link href="/auth">ログイン</Link>;
}
