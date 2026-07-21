# アーキテクチャ方針

## 1次商用構成

```text
Browser
  ├─ Next.js Web UI
  │    ├─ Supabase Auth
  │    ├─ 顧客制作室
  │    └─ 管理画面
  │
  ├─ Supabase
  │    ├─ PostgreSQL + RLS
  │    ├─ Auth
  │    └─ Private Storage
  │
手動制作
  ├─ 管理者が完成前の確認動画をStorageへアップロード
  └─ 顧客確認後に完成動画を最終納品
```

## なぜ動画処理をアプリサーバーで行わないか

注文CRUD、認証、決済、signed URL発行は短時間のI/O処理なのでサーバーレスに適しています。一方、FFmpeg、4Kエンコード、長時間の生成待ちはCPU時間・メモリ・実行時間の制約と相性がよくありません。

動画の自動化を始める時は、ジョブを作成してすぐ応答し、外部ワーカーが処理する構成にします。

```text
API → render_job作成 → Worker起動 → Storageへ保存 → Webhook → 注文状態更新
```

## 現在のMVPデータモデル

- `profiles`: お客様と管理者
- `orders`: 愛犬情報、ストーリー回答、料金、制作状態、納期、修正上限
- `assets`: 顧客写真、確認動画、完成動画のメタデータ
- `concepts`: お客様へ提示する映像コンセプト2案
- `revision_requests`: 修正依頼と対応状態
- `messages`: 制作室メッセージ
- `deliveries`: 最終納品情報
- `share_links`: 家族共有リンク
- `order_events`: 注文・管理操作の監査履歴

すべての顧客データはRLSで所有者を分離します。Storageはprivate bucketを使用し、短時間のsigned URLだけを発行します。

## 状態遷移

```text
awaiting_materials
  → materials_submitted
  → reviewing_materials
  → concepts_ready
  → concept_selected
  → production
  → customer_review
  ├─ revision_requested → production → customer_review（最大2回）
  └─ customer_approve_review → quality_check → delivered
```

管理画面はテーブルを直接更新しません。`admin_update_order`、`admin_publish_concepts`、`admin_register_video_asset`、`admin_deliver_order`などのSecurity Definer RPCだけを使用します。RPCは管理者権限と許可された状態遷移を検証し、変更を`order_events`へ記録します。`concept_selected`はお客様の選択、`customer_review`は確認動画の公開、`quality_check`はお客様本人の`customer_approve_review`だけで進みます。制作以降は`paid`、現在版の同意記録、未対応修正0件をDBで確認します。

相談受付は写真5枚以上をDBでも確認した後に確定します。先着10組の料金枠は`materials_submitted`になった注文だけが使用するため、アップロード途中の下書き注文は枠を消費しません。

## 運用強化版の反映順序

既存の管理画面を止めずに切り替えるため、次の順で反映します。

1. `supabase/migrations`を順番にすべて適用して、列・RPC・検証ルールを追加（`202607210002_operations_lockdown.sql`は空の互換マーカー）
2. 新しいWebアプリをデプロイし、管理画面がRPCを使用する状態へ切り替え
3. `supabase/post_deploy/operations_lockdown_after_admin_deploy.sql`を手動適用して、管理者の直接テーブル更新権限を停止

post-deploy SQLは通常のマイグレーションフォルダー外にあるため、全マイグレーション一括適用で先にロックされません。2番目を確認する前に3番目を適用すると、旧管理画面からの更新が拒否されます。ロールバック時はWebアプリだけを旧版へ戻さず、権限ポリシーとの組み合わせも確認します。

## 保管と自動整理

正式受付前の`awaiting_materials`は作成・更新から7日で失効します。Vercel Cronの`/api/cron/cleanup-drafts`がSecurity Roleで期限切れを確定し、部分アップロード写真、写真メタデータ、自由記述の思い出を削除します。Cronは`CRON_SECRET`のBearer認証が必須で、失敗したStorage削除は次回実行で再試行します。

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
