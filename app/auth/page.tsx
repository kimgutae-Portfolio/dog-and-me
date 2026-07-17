import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "./AuthPanel";

export const metadata: Metadata = {
  title: "ログイン・会員登録",
  description: "WAN MEMORYの制作室へログインします。",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return <Suspense fallback={<div className="wizard-loading">ログイン画面を準備しています…</div>}><AuthPanel /></Suspense>;
}
