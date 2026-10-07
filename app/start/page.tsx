import type { Metadata } from "next";
import { StoryStart } from "./StoryStart";

export const metadata: Metadata = {
  title: "物語づくりを始める",
  description: "愛犬のお名前と、残したい思いを教えてください。登録だけでは料金は発生しません。",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <StoryStart />;
}
