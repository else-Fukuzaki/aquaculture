# 養殖漁業管理システム - CLAUDE.md

## プロジェクト概要

養殖漁業の現場データを一元管理するWebアプリケーション。水質・環境・生物・運営・経済の5カテゴリにわたるデータを記録・可視化・エクスポートできる。

**前提：スマートフォンでの利用が主（モバイルファースト）**
`deploy100` 配下のアプリ・ソフトはすべて、スマートフォンで使うことが前提。現場（船上・生簀のそば）でスマホから入力する使い方を想定しているため、以下を必須とする。

- 実装・修正時は **狭幅端末（375〜390px 幅）で操作できるか** を必ず確認する。PCブラウザだけの確認で完了としない
- すべての操作要素（ボタン・タブ・入力欄・スライダー）は **タップ領域を最低44×44px** 確保する
- 入力欄の `font-size` は **16px以上**（iOS Safariが自動ズームしてしまうため）
- 地図・グラフなど指ドラッグを奪う要素は、**ページスクロールを妨げない**こと
- モーダルは狭幅・低い画面高でも **送信/キャンセルボタンに到達できる**こと

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
- 外部ライブラリはCDN経由の Chart.js と **Leaflet.js（赤潮データの地図）** のみ許可
- 新たな外部依存を追加する場合は必ず確認を取る

### セキュリティ
- ユーザー入力を画面に表示する際は必ず `escapeHtml()` を通す
- `innerHTML` に直接ユーザー入力を渡さない
- CSVエクスポート時は `escapeCSVCell()` でRFC 4180に準拠する

### JavaScript
- グローバル変数は `dataStore`・`dataFields`・`charts`・`currentPage` に限定する（赤潮の地図インスタンス保持のため `redtideMaps` のみ例外として追加）
- 新しいデータカテゴリを追加する場合は `dataStore`・`dataFields`・HTML（タブ＋テーブル＋ページネーション）をセットで追加する
- 関数は単一責任を意識し、肥大化させない

### HTML / CSS
- スタイルはすべて `styles.css` に記述し、インラインスタイルは避ける（モーダル内の一時的なレイアウト調整は例外）
- クラス名は BEM に準拠しなくてよいが、意味のある名前をつける
- 入力欄の `font-size` は16px以上を維持する（下げると iOS Safari がフォーカス時に自動ズームする）
- 操作要素は `min-height: 44px` 以上を確保する
- モーダルの `.modal-actions` は `position: sticky` で常時表示する。地図を含むモーダルは中身が画面高の2倍以上になり、スクロールしないと送信ボタンに届かないため
- レスポンシブ指定は赤潮セクションより前の `@media` に書くと赤潮用クラスへ効かない。赤潮向けは赤潮セクション末尾の `@media` に書く

### モバイル対応（タッチ操作）
- Leaflet は1本指ドラッグを地図パンに使うため、地図の上ではページもモーダルもスクロールできない。スマホでは `touchSafeMapOptions()` で `dragging: false` にし、`.map-lock-btn`（「地図を動かす」）で明示的に切り替える
- 地図を追加する場所には必ずこのボタンをセットで置く（`setupMapLockBtn()` を初期化時に呼ぶ）
- 入力フォームのモーダル（追加・編集）は外側タップで閉じない。スマホでは誤タップで入力が全消えするため。閉じるのは「キャンセル」ボタンのみ。写真ビューアーは失うものがないので外側タップで閉じてよい
- モーダルを開くときは `setBodyScrollLock(true)`、閉じるときは `false` を必ず呼ぶ
- 検証はクリックイベントではなく実際のタッチイベントで行う（Playwright の `devices['iPhone 13']` ＋ CDP `Input.dispatchTouchEvent`）。クリックだけでは Leaflet のタッチ挙動を見逃す

### データ
- データは **sql.js（WebAssembly SQLite）** で管理する
- DBファイルはBase64化して `localStorage` の `aquacultureDB` キーに保存する
- CRUD後は必ず `saveDB()` → `reloadDataStoreCategory(category)` の順に呼ぶ
- `dataStore` はSQLiteのインメモリキャッシュ。描画関数はこちらを参照する
- 写真データはBase64テキストとしてSQLiteのTEXT型カラムに保存する
- データIDは `Date.now() + Math.random()` を利用して生成する（REAL型）
- Capacitor移行時は sql.js を `@capacitor-community/sqlite` に置き換える
- 赤潮データ（`redtide`）は独立ビュー。緯度・経度・広がり半径はモーダルの Leaflet 地図ピッカー＋半径スライダーで入力し、`REDTIDE_PICKER_FIELDS` で汎用フォームから除外する
- 赤潮の統計・グラフは汎用の `renderStats`/`renderChart` を使わず専用の `renderRedtideStats`/`renderRedtideChart` を使う（描画は `renderRedtideView()` に集約）
- 赤潮グラフは2軸1枚にせず、細胞密度と溶存酸素・水温を別々の単軸グラフに分ける（軸スケールによる誤読を避けるため）
- `timestamp` は ISO(UTC・シード) と `datetime-local`(ローカル) が混在するため、日付比較は文字列切り出しではなく `toLocalDateStr()` を通す

### Git
- コミットメッセージは日本語で記述する
- 機能追加・バグ修正・リファクタリングを明確に区別する
