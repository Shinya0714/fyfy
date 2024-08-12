# 1.セキュアなファイル共有プラットフォーム
ユーザーがファイルをアップロードし、特定の人と安全に共有できるプラットフォーム。

ファイルは暗号化され、アクセス制御が厳密に管理される。

## 技術
認証:
 - [x] JWT
 - [ ] OAuth 2.0

セキュリティ:
 - [x] AES暗号化
 - [ ] HTTPS
 - [x] CSRF対策

パフォーマンス:
 - [ ] CDN（Content Delivery Network）
 - [x] キャッシュ戦略

フロントエンド:
 - [x] React

バックエンド:
 - [x] Go

ストレージ:
 - [x] AWS S3