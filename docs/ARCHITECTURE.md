# アーキテクチャ方針

## 1次商用構成

```text
Browser
  ├─ Web UI / Server API
  │    ├─ 認証・注文・回答
  │    ├─ Stripe Checkout / Webhook
  │    ├─ Signed upload URL発行
  │    └─ 管理画面
  │
  ├─ Supabase
  │    ├─ PostgreSQL + RLS
  │    ├─ Auth
  │    └─ Private Storage
  │
  ├─ Stripe
  └─ Resend

手動制作
  └─ 管理者が完成動画をStorageへアップロード
```

## なぜ動画処理をアプリサーバーで行わないか

注文CRUD、認証、決済、signed URL発行は短時間のI/O処理なのでサーバーレスに適しています。一方、FFmpeg、4Kエンコード、長時間の生成待ちはCPU時間・メモリ・実行時間の制約と相性がよくありません。

動画の自動化を始める時は、ジョブを作成してすぐ応答し、外部ワーカーが処理する構成にします。

```text
API → render_job作成 → Worker起動 → Storageへ保存 → Webhook → 注文状態更新
```

## 本番データモデルの最小セット

- `profiles`: お客様と管理者
- `pets`: 愛犬情報
- `products`: プランと価格
- `orders`: 注文、決済、制作状態、納期
- `order_answers`: ストーリー回答
- `assets`: 写真、動画、完成品のメタデータ
- `scripts`: シナリオとバージョン
- `scenes`: シーンと承認状態
- `revision_requests`: 修正依頼
- `payments`: Stripe決済状態
- `messages`: 制作室メッセージ
- `activity_logs`: 管理操作監査

すべての顧客データはRLSで所有者を分離します。Storageはprivate bucketを使用し、短時間のsigned URLだけを発行します。

## 状態遷移

```text
draft
  → awaiting_materials
  → materials_submitted
  → reviewing_materials
  → script_waiting_customer
  → script_approved
  → scene_waiting_customer
  → scene_approved
  → final_rendering
  → quality_check
  → completed
  → delivered
```

遷移はサーバーで許可リストを検証し、すべて`activity_logs`へ残します。

## Provider境界

AI自動化時も、特定サービスへ直接依存させません。

```ts
interface VideoProvider {
  createJob(input: SceneGenerationInput): Promise<ProviderJob>;
  getJob(jobId: string): Promise<ProviderJobStatus>;
  cancelJob(jobId: string): Promise<void>;
}
```

生成費用、モデル、seed、prompt、source asset、失敗理由を注文単位で記録します。
