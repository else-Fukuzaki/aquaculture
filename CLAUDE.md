# 養殖漁業管理システム - CLAUDE.md

## プロジェクト概要

養殖漁業の現場データを一元管理するWebアプリケーション。水質・環境・生物・運営・経済の5カテゴリにわたるデータを記録・可視化・エクスポートできる。

**技術スタック**
- フロントエンドのみ（バックエンドなし）
- HTML / CSS / Vanilla JavaScript
- Chart.js 4.4.0（CDN経由）
- sql.js 1.10.2（WebAssembly版SQLite、CDN経由）
- データ永続化: SQLiteバイナリをBase64化して `localStorage` に保存

## ファイル構成

```
aquaculture/
├── index.html          # HTML構造（タブ・テーブル・モーダル）
├── styles.css          # CSSスタイル
├── app.js              # ロジック全体（データ管理・描画・エクスポート）
└── aqua_profile/
    └── aquaculture-app20260204.html  # 元ファイル（バックアップ）
```

## 主要機能

- 5カテゴリのデータ追加・編集・削除
- ページネーション（1ページ20件）
- Chart.jsによる時系列グラフ表示
- CSVエクスポート（RFC 4180準拠）
- 生物データへの個体写真添付（Base64保存）
- XSS対策（`escapeHtml` によるサニタイズ）

## 開発ロードマップ

### フェーズ1: Apple Store公開（現在進行中）
- 既存のHTML/CSS/JSアプリを **Capacitor** でiOSアプリ化
- データ永続化は引き続き `localStorage` を使用
- Apple Developer登録・審査手続きと並行して進める
- CDN経由のChart.jsはCapacitor環境でも動作確認が必要

### フェーズ2: Supabaseバックエンド連携（App Store公開後）
- `localStorage` を **Supabase（PostgreSQL）** に移行
- 複数デバイス間のデータ同期が可能になる
- Supabase Authによるユーザー認証の導入を検討
- 写真データはSupabase Storageへの移行を検討（Base64からURLベースへ）

---

## 開発ルール・コーディング規約

### 全般
- フレームワーク・ビルドツールは使用しない（バニラJS・直書きHTML/CSS）
- 外部ライブラリはCDN経由のChart.jsのみ許可
- 新たな外部依存を追加する場合は必ず確認を取る

### セキュリティ
- ユーザー入力を画面に表示する際は必ず `escapeHtml()` を通す
- `innerHTML` に直接ユーザー入力を渡さない
- CSVエクスポート時は `escapeCSVCell()` でRFC 4180に準拠する

### JavaScript
- グローバル変数は `dataStore`・`dataFields`・`charts`・`currentPage` に限定する
- 新しいデータカテゴリを追加する場合は `dataStore`・`dataFields`・HTML（タブ＋テーブル＋ページネーション）をセットで追加する
- 関数は単一責任を意識し、肥大化させない

### HTML / CSS
- スタイルはすべて `styles.css` に記述し、インラインスタイルは避ける（モーダル内の一時的なレイアウト調整は例外）
- クラス名は BEM に準拠しなくてよいが、意味のある名前をつける

### データ
- データは **sql.js（WebAssembly SQLite）** で管理する
- DBファイルはBase64化して `localStorage` の `aquacultureDB` キーに保存する
- CRUD後は必ず `saveDB()` → `reloadDataStoreCategory(category)` の順に呼ぶ
- `dataStore` はSQLiteのインメモリキャッシュ。描画関数はこちらを参照する
- 写真データはBase64テキストとしてSQLiteのTEXT型カラムに保存する
- データIDは `Date.now() + Math.random()` を利用して生成する（REAL型）
- Capacitor移行時は sql.js を `@capacitor-community/sqlite` に置き換える

### Git
- コミットメッセージは日本語で記述する
- 機能追加・バグ修正・リファクタリングを明確に区別する
