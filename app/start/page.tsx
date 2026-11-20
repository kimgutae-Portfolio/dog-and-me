import type { Metadata } from "next";
import { StoryStart } from "./StoryStart";
import { isMemoryPlanId } from "../lib/pricing";

export const metadata: Metadata = {
  title: "物語づくりを始める",
  description: "愛犬のお名前と、残したい思いを教えてください。登録だけでは料金は発生しません。",
  robots: { index: false, follow: false },
};

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { plan } = await searchParams;
  return <StoryStart initialPlanId={isMemoryPlanId(plan) ? plan : undefined} />;
}
