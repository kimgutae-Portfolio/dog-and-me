import type { Metadata } from "next";
import { AdminStudio } from "./AdminStudio";

export const metadata: Metadata = {
  title: "運営管理",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminStudio />;
}
