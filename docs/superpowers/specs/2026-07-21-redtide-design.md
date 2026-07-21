# 赤潮データ機能 設計仕様書

- 作成日: 2026-07-21
- ブランチ: `redtide`
- 対象: 養殖漁業管理システム（バニラJS / sql.js / Chart.js）

## 1. 目的

クライアント要望に基づき、赤潮の発生記録を管理する機能を追加する。従来の5カテゴリ（水質・環境・生物・運営・経済）とは切り離した**独立ビュー**として設置し、赤潮が**どの海域で発生し、どれだけ広がったか**を**地図上**で日付ごとに確認できるようにする。

## 2. 意思決定サマリ（確定事項）

| 論点 | 決定 |
|------|------|
| ページ形式 | 独立ビュー（ヘッダーのボタンで全画面切替、「戻る」で復帰） |
| 地図ライブラリ | **Leaflet.js**（CDN・OpenStreetMapタイル・APIキー不要）を新規外部依存として追加 |
| 「広がり」の表現 | **円（中心＋半径km）で近似**（ポリゴン描画はしない） |
| オフライン対応 | 現時点では不要（オンラインのタイル取得を許容） |
| マーカー描画 | 画像アセットを使わず Leaflet の `circle` / `circleMarker` で描画（追加アセット依存なし） |

## 3. 画面設計

### 3.1 エントリ（ボタン）
- ヘッダー（`#mainApp` 内）に `🌊 赤潮データ` ボタンを追加。
- 押下で `#mainApp` のメイン領域（タブ＋各カテゴリ）を隠し、`#redtideView` を表示。
- `← 戻る` ボタンでメインに復帰。
- ログイン状態・ヘッダーのユーザー情報は共有（別画面ではなく同一 `#mainApp` 内のビュー切替）。

### 3.2 赤潮ビュー（`#redtideView`）構成（上から）
1. ビューヘッダー：`← 戻る` / タイトル `🌊 赤潮データ`
2. アクション：`📝 データ追加` / `📊 CSVエクスポート`
3. **年月日フィルタ**：日付の絞り込み（後述 3.4）
4. **地図**（`#redtideMap`）：フィルタ対象の全記録をマーカー＋範囲円で表示
5. 統計カード（`#redtide-stats`）
6. 折れ線グラフ（`#redtideChart`）：細胞密度・溶存酸素・水温
7. データテーブル（`#redtide-table-body`）＋ページネーション（`#redtide-pagination`）

### 3.3 データ追加/編集モーダル
- 既存の `#addModal` / `#editModal` のフォーム生成ロジックを流用。
- 赤潮カテゴリのときは、フォーム内に**ミニ地図（位置ピッカー）**を表示：
  - 地図クリックで発生地点を指定 → 緯度・経度フィールドに自動入力、マーカー表示。
  - 半径スライダー（0.1〜50km 目安）で範囲円を表示、`radiusKm` に反映。
  - 未指定のまま保存は不可（緯度・経度必須）。
- 写真添付はなし（赤潮カテゴリには `image` 型フィールドを持たない）。

### 3.4 年月日フィルタ
- 既定は「全期間」。日付（`<input type="date">`）で単日、または期間（開始〜終了）で絞り込み。
- フィルタ変更時に、地図マーカー・統計・グラフ・テーブルを再描画。
- 実装簡素化のため、フィルタは `dataStore.redtide` を JS 側で期間フィルタする（SQL 再クエリはしない）。

## 4. データモデル

### 4.1 フィールド定義（`dataFields.redtide`）

| name | label | type | 備考 |
|------|-------|------|------|
| species | プランクトン種類 | select | シャットネラ/カレニア/夜光虫/ヘテロカプサ/その他 |
| cellDensity | 細胞密度(cells/mL) | number (step 1) | 主指標 |
| oxygen | 溶存酸素(mg/L) | number (step 0.1) | |
| waterTemp | 水温(℃) | number (step 0.1) | |
| seaColor | 海水の色 | select | 正常/褐色/赤褐色/緑褐色 |
| deadCount | 斃死数(尾) | number (step 1) | 被害状況 |
| response | 対応措置 | select | なし/給餌停止/生簀移動/曝気/その他 |
| latitude | 緯度 | number (step 0.000001) | 地図クリックで自動入力・必須 |
| longitude | 経度 | number (step 0.000001) | 地図クリックで自動入力・必須 |
| radiusKm | 広がり半径(km) | number (step 0.1) | スライダー入力 |

- 共通カラム：`id REAL PRIMARY KEY`, `timestamp TEXT`（既存カテゴリと同一方針）。
- ID生成は既存同様 `Date.now() + Math.random()`。

### 4.2 SQLiteテーブル（`createTables()` に追加）

```sql
CREATE TABLE IF NOT EXISTS redtide (
    id REAL PRIMARY KEY, timestamp TEXT,
    species TEXT, cellDensity REAL, oxygen REAL, waterTemp REAL,
    seaColor TEXT, deadCount REAL, response TEXT,
    latitude REAL, longitude REAL, radiusKm REAL
);
```

- `IF NOT EXISTS` により既存DBへも冪等にマイグレーション（`initDB()` の `createTables()` 再呼び出しで新テーブルが追加される）。

### 4.3 dataStore
- `dataStore.redtide = []` を追加。
- `reloadAllCategories()` は `Object.keys(dataStore)` を回すため自動対応。ただし `loadCategory` は `dataFields[category]` を参照するため、両者に redtide を追加すれば整合する。
- ページネーション状態 `currentPage.redtide = 1` を追加。

## 5. 地図実装（Leaflet）

### 5.1 依存追加
- `index.html` に CDN を追加：
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- タイル：OpenStreetMap 標準タイル（`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`、帰属表示を付与）。

### 5.2 一覧地図（`#redtideMap`）
- 赤潮ビュー表示時に初期化（初回のみ `L.map`、以降は再利用し `invalidateSize()`）。
- フィルタ後の各記録について、中心マーカー（`circleMarker`）＋範囲円（`L.circle` 半径 `radiusKm * 1000` m）を描画。
- 円の色は海テーマの赤系アクセント（赤潮＝赤褐色）を用い、`seaColor` により濃淡を変えてもよい（実装時に調整可）。
- マーカークリックでポップアップ：日時・種類・細胞密度・斃死数などの要約。
- 記録が1件以上あれば `fitBounds` で全体が収まるようズーム。0件なら日本近海のデフォルト表示。

### 5.3 ミニ地図（位置ピッカー）
- モーダル内 `#redtidePickerMap`。
- `click` で `marker`（またはドラッグ可能な circleMarker）を置き、`latitude`/`longitude` を更新。
- 半径スライダー変更でプレビュー円を更新。
- モーダルを開くたびに再初期化 or 再利用（表示直後に `invalidateSize()` が必要）。

## 6. セキュリティ / 既存規約の遵守

- ユーザー入力（種類・色・対応措置・ポップアップ表示）は既存 `escapeHtml()` を通す。
- CSVは既存 `escapeCSVCell()` でRFC 4180準拠。
- CRUD後は `saveDB()` → `reloadDataStoreCategory('redtide')` の順。
- グローバル変数は既存の `dataStore` / `dataFields` / `charts` / `currentPage` に redtide キーを足す範囲に収める。地図インスタンスは専用の状態（例 `redtideMaps` オブジェクト）を1つ追加。
- インラインスタイルは避け `styles.css` に集約（モーダル内の一時調整は例外）。
- 緯度・経度は数値範囲（緯度 -90〜90、経度 -180〜180）を保存前に検証。

## 7. 影響ファイル

| ファイル | 変更内容 |
|----------|----------|
| `index.html` | Leaflet CDN、ヘッダーの赤潮ボタン、`#redtideView`（地図/統計/グラフ/テーブル/ページネーション）、モーダルの位置ピッカー領域 |
| `styles.css` | 赤潮ビュー・地図コンテナ・フィルタ・ピッカーのスタイル（海テーマ準拠、赤系アクセント） |
| `app.js` | `dataFields.redtide` / `dataStore.redtide` / `currentPage.redtide`、`createTables` にredtide、ビュー切替、地図描画（一覧・ピッカー）、フィルタ、CRUD/統計/グラフ/CSVのredtide対応 |
| `CLAUDE.md` | Leaflet.js を許可外部依存として追記、赤潮カテゴリの説明 |

## 8. 非対象（YAGNI）

- ポリゴンによる範囲描画（円で近似）。
- オフラインでのタイルキャッシュ。
- 赤潮の予測・アラート通知。
- 地図の作図（heatmap等）高度可視化。

## 9. テスト観点

- 赤潮ボタン→ビュー表示→戻るの往復。
- データ追加：地図クリックで緯度経度入力、半径スライダー反映、保存後に一覧地図・統計・グラフ・テーブルへ反映。
- 編集・削除後の再描画と `saveDB()` 永続化（リロード後も保持）。
- 年月日フィルタで地図・統計・グラフ・テーブルが連動。
- 既存DB（redtideテーブル無し）を開いても `createTables()` で新テーブルが作られ、既存5カテゴリが壊れない。
- XSS：種類/色/対応措置に記号を入れてもポップアップ・テーブルで無害化される。
- CSVエクスポートのRFC 4180準拠（緯度経度・半径含む）。
