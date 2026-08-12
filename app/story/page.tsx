import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import {
  APPLICATIONS_OPEN,
  PRELAUNCH_COPY,
  PRELAUNCH_TITLE,
} from "../lib/site";
import { StoryWizard } from "./StoryWizard";

export const metadata: Metadata = {
  title: APPLICATIONS_OPEN
    ? "思い出を聞かせてください"
    : "お申し込み受付は準備中",
  description: APPLICATIONS_OPEN
    ? "愛犬との思い出を一つずつ伺う、やさしい申し込みフォームです。"
    : PRELAUNCH_COPY,
  robots: { index: false, follow: false },
};

export default function StoryPage() {
  if (!APPLICATIONS_OPEN) {
    return (
      <InfoPage
        eyebrow="COMING SOON"
        title={PRELAUNCH_TITLE}
        lead={PRELAUNCH_COPY}
      >
        <section>
          <h2>完成デモはご覧いただけます</h2>
          <p>
            お申し込みフォームは現在閉じています。受付開始まで、動く絵本の完成デモとサービス内容をご覧ください。
          </p>
          <div className="info-actions">
            <Link className="button button-primary" href="/film/moka-demo">
              動くページを見る →
            </Link>
            <Link className="button button-outline" href="/">
              サービスサイトへ戻る
            </Link>
          </div>
        </section>
        <section>
          <h2>すでに制作中の方</h2>
          <p>
            進行中のご注文は、これまでどおり制作室から内容をご確認いただけます。
          </p>
          <Link className="button button-outline" href="/studio">
            制作室を開く →
          </Link>
        </section>
      </InfoPage>
    );
  }

  return <StoryWizard />;
}
