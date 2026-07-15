import type { Metadata } from "next";
import { StoryWizard } from "./StoryWizard";

export const metadata: Metadata = {
  title: "思い出を聞かせてください",
  description: "愛犬との思い出を一つずつ伺う、やさしい申し込みフォームです。",
};

export default function StoryPage() {
  return <StoryWizard />;
}
