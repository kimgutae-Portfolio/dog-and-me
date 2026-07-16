import type { Metadata } from "next";
import { AuthPanel } from "./AuthPanel";

export const metadata: Metadata = {
  title: "ログイン・会員登録",
  description: "WAN MEMORYの制作室へログインします。",
};

export default function AuthPage() {
  return <AuthPanel />;
}
