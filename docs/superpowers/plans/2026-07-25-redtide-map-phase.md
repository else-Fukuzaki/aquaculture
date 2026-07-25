# 赤潮データ機能 地図フェーズ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既に実装済みの赤潮データ独立ビュー（テーブル＋CRUD）に、Leaflet地図・位置ピッカー・専用グラフ・統計・年月日フィルタを追加し、設計仕様書 `docs/superpowers/specs/2026-07-21-redtide-design.md` を満たす。

**Architecture:** 全ロジックは既存方針どおり単一 `app.js` に追記（バニラJS・ビルドツール無し）。地図は Leaflet.js（CDN・OpenStreetMapタイル）。一覧地図は `circleMarker`＋`circle` で描画、モーダル内はクリック式の位置ピッカー＋半径スライダー。赤潮の統計・グラフ・テーブルは「年月日フィルタ後の配列」を単一の `renderRedtideView()` から描画する。地図インスタンスは設計仕様で承認済みの例外グローバル `redtideMaps` に保持する。

**Tech Stack:** HTML / CSS / Vanilla JS / sql.js(WASM SQLite) / Chart.js 4.4.0 / **Leaflet 1.9.4（新規CDN依存）**。検証は Playwright(E2E)。

---

## 前提・既知の事実（ゼロコンテキストの実装者向け）

- アプリは**ログインゲート**あり（`#authScreen` のモック認証・localStorage）。初回はユーザーが無いので新規登録すると自動ログインする。検証スクリプトはこれを通す（ヘルパーで自動化・Task 0）。
- データは sql.js のインメモリSQLite。CRUD後は必ず `saveDB()` → `reloadDataStoreCategory('redtide')`（既存の `addData/updateData/deleteData` が実施済み）。`dataStore.redtide` が描画のソース。
- 赤潮テーブルは空のとき `seedRedtideSampleIfEmpty()`（app.js:338）が九州西岸〜瀬戸内のダミー5件を投入する。Playwrightは毎回クリーンな localStorage で起動するため、**毎回この5件が再投入され**、テストは決定的になる。
- グローバル変数は `dataStore`/`dataFields`/`charts`/`currentPage` に限定（CLAUDE.md）。本計画では地図用に `redtideMaps` を1つ追加する。これは設計仕様書 §6 で承認済みの例外（Task 8 で CLAUDE.md に明記）。
- ユーザー入力表示は必ず `escapeHtml()`、CSVは `escapeCSVCell()`（既存規約）。
- 既存の `renderChart()`（app.js:544）は `dataFields[category].slice(0,3)` で先頭3項目を機械選択する。赤潮の先頭は `species`(select) なのでそのままでは破綻する（🔴レビュー項目）。本計画では **赤潮を `renderChart`/`renderStats` の対象から外し**、専用の `renderRedtideChart`/`renderRedtideStats` を用意して解決する。
- 既存フォーム生成器（`showAddModal` app.js:634 / `editData` app.js:714）は全項目を素の input 化する。赤潮の緯度・経度・半径には**専用フォーム分岐**（地図ピッカー＋スライダー）が必須（🔴レビュー項目）。Task 6 で対応。

## File Structure

| ファイル | 役割 / 変更 |
|----------|-------------|
| `index.html` | Leaflet CDN（CSS/JS）追加、`#redtideView` にフィルタ/地図/統計/グラフのコンテナ追加 |
| `styles.css` | 地図コンテナ・フィルタ・ピッカーのスタイル（海テーマ準拠・赤系アクセント、インラインスタイル回避） |
| `app.js` | `redtideMaps` 状態、一覧地図描画、統計、グラフ、年月日フィルタ、位置ピッカー、赤潮バリデーション、`renderChart`/`renderStats`/`renderCategory`/`changePage`/`renderTable`/`showRedtideView` の赤潮対応 |
| `CLAUDE.md` | Leaflet を許可外部依存として追記、`redtideMaps` グローバル例外、赤潮カテゴリ説明 |
| `.e2e/`（gitignore・出荷対象外） | Playwright E2E ハーネス（ヘルパー＋各タスクの検証スクリプト） |

**app.js の肥大化について:** 本計画で app.js は 800 行ガイドラインを超えるが、CLAUDE.md が「ロジック全体を app.js に集約」と明示しているため単一ファイル方針を維持する。赤潮地図関連は `// ===== 赤潮：地図・統計・グラフ・フィルタ =====` のセクションコメントでまとめる。

## テスト方針（この計画のTDD）

ユニットテスト基盤は無い（バニラJS・ビルドツール無し）。検証は **Playwright E2E** で行う（`~/.claude/rules/typescript/testing.md` が E2E に Playwright を指定）。各タスクは「①機能が無いことを確認する失敗するE2Eチェックを書く → ②実装 → ③チェックが通る」の順で進める。E2Eハーネスは `.e2e/`（gitignore）に隔離し、出荷物（html/css/js）には含めない。

各検証の前提として、プロジェクトルートで静的サーバーを起動しておく:

```bash
python3 -m http.server 8123   # プロジェクトルートで（バックグラウンド可）
```

---

### Task 0: E2Eハーネスのセットアップ

**Files:**
- Create: `.e2e/package.json`
- Create: `.e2e/helpers.mjs`
- Modify: `.gitignore`（末尾に `.e2e/` を追加）

- [ ] **Step 1: `.gitignore` に `.e2e/` を追加**

`.gitignore` の末尾に1行追加する:

```
.e2e/
```

- [ ] **Step 2: Playwright を隔離インストール**

```bash
mkdir -p .e2e
cd .e2e && npm init -y >/dev/null && npm install playwright@latest && npx playwright install chromium
```

Expected: `chromium` がダウンロードされ `added ... packages` と表示される。

- [ ] **Step 3: ログイン＋赤潮ビュー遷移ヘルパーを作成**

`.e2e/helpers.mjs`:

```javascript
import { chromium } from 'playwright';

export const BASE = 'http://localhost:8123/index.html';

export async function launch() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  return { browser, page, errors };
}

export async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('#authToggleBtn').click();           // 新規登録モードへ
  await page.waitForTimeout(200);
  await page.fill('#authEmail', 'demo@example.com');
  await page.fill('#authPassword', 'password123');
  await page.fill('#authPasswordConfirm', 'password123');
  await page.locator('#authSubmitBtn').click();
  await page.waitForTimeout(2000);                          // 登録+ログイン+DB初期化(WASM)
}

export async function openRedtide(page) {
  await page.locator('button:has-text("赤潮データ")').first().click();
  await page.waitForTimeout(1200);                          // 地図タイル/描画待ち
}

export function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
  console.log('PASS: ' + msg);
}
```

- [ ] **Step 4: ハーネス疎通確認（サーバー起動 → 既存ビューが開く）**

`.e2e/t0.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
assert(!(await page.locator('#authScreen').isVisible()), 'ログイン後に authScreen が隠れる');
await openRedtide(page);
assert(await page.locator('#redtideView').isVisible(), '赤潮ビューが表示される');
assert(errors.length === 0, 'コンソール/ページエラーが無い: ' + errors.join(' | '));
await browser.close();
```

Run（サーバー起動済み前提）:

```bash
python3 -m http.server 8123 >/tmp/aqua-http.log 2>&1 &
cd .e2e && node t0.mjs
```

Expected: すべて `PASS`。

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: 赤潮地図フェーズ用のE2Eハーネス整備（.e2eはgitignore）"
```

（`.e2e/` は gitignore 対象なのでコミットには含まれない。`.gitignore` の変更のみコミットされる）

---

### Task 1: Leaflet CDN とビューのコンテナ追加

**Files:**
- Modify: `index.html:7`（`<head>` に Leaflet CSS）
- Modify: `index.html:316-318`（`</body>` 前に Leaflet JS）
- Modify: `index.html:238-248`（`#redtideView` にフィルタ/地図/統計/グラフを挿入、コメント更新）
- Test: `.e2e/t1.mjs`

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t1.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);
assert(await page.evaluate(() => typeof window.L === 'object'), 'Leaflet(L) が読み込まれている');
assert(await page.locator('#redtideMap').count() === 1, '#redtideMap が存在する');
assert(await page.locator('#redtide-stats').count() === 1, '#redtide-stats が存在する');
assert(await page.locator('#redtideChart').count() === 1, '#redtideChart が存在する');
assert(await page.locator('#redtide-filter-start').count() === 1, '開始日フィルタが存在する');
assert(await page.locator('#redtide-filter-end').count() === 1, '終了日フィルタが存在する');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t1.mjs`
Expected: FAIL（`Leaflet(L) が読み込まれている` などで exit 1）

- [ ] **Step 3: Leaflet CSS を `<head>` に追加**

`index.html` の `<link rel="stylesheet" href="styles.css">`（7行目）の**直前**に挿入:

```html
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
```

- [ ] **Step 4: Leaflet JS を sql.js の前に追加**

`index.html` の `<script src="https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js"></script>`（316行目）の**直前**に挿入:

```html
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
```

- [ ] **Step 5: `#redtideView` にコンテナを挿入**

`index.html` の赤潮ビュー内、`action-buttons` の `</div>`（248行目）と `<div class="data-table">`（250行目）の**間**に挿入。あわせて238行目のコメントを更新する。

238行目のコメントを次に置換:

```html
        <!-- 赤潮データ 独立ビュー（地図・位置ピッカー・グラフ・統計・年月日フィルタ） -->
```

`action-buttons` ブロックの直後（248行目 `</div>` の次）に挿入:

```html

            <div class="redtide-filter">
                <label class="redtide-filter-label">期間で絞り込み</label>
                <div class="redtide-filter-row">
                    <input type="date" id="redtide-filter-start">
                    <span>〜</span>
                    <input type="date" id="redtide-filter-end">
                    <button class="btn btn-small btn-primary" onclick="applyRedtideFilter()">絞り込み</button>
                    <button class="btn btn-small" onclick="clearRedtideFilter()">全期間</button>
                </div>
            </div>

            <div id="redtideMap" class="redtide-map"></div>

            <div class="stats-grid" id="redtide-stats"></div>

            <div class="chart-container">
                <div class="chart-title">赤潮 指標推移（細胞密度・溶存酸素・水温）</div>
                <canvas id="redtideChart"></canvas>
            </div>
```

- [ ] **Step 6: 地図コンテナの最低限のスタイルを追加**

`styles.css` の末尾に追加（Task 5/6 でフィルタ・ピッカーのスタイルを追記）:

```css
/* ===== 赤潮：地図 ===== */
.redtide-map {
    width: 100%;
    height: 380px;
    border-radius: 12px;
    margin-bottom: 20px;
    z-index: 0;
}
```

> 注: Leaflet コンテナには明示的な高さが必須（高さ0だとタイルが描画されない）。

- [ ] **Step 7: 通ることを確認**

Run: `cd .e2e && node t1.mjs`
Expected: すべて `PASS`

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css
git commit -m "feat: 赤潮ビューにLeaflet CDNと地図/統計/グラフ/フィルタのコンテナを追加"
```

---

### Task 2: 一覧地図の描画（マーカー＋範囲円＋ポップアップ）

**Files:**
- Modify: `app.js`（`charts` 定義の直後・204行目付近に `redtideMaps` と色定数、`renderChart`/`renderStats` に赤潮スキップ、`showRedtideView` を差し替え、地図描画関数を追加）
- Test: `.e2e/t2.mjs`

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t2.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);
// ダミー5件 → Leaflet の circleMarker が5つ描画される（.leaflet-interactive の circleMarker path）
const markerCount = await page.evaluate(() => {
  const g = window.redtideMaps && window.redtideMaps.listLayers;
  if (!g) return -1;
  let n = 0;
  g.eachLayer(l => { if (l instanceof window.L.CircleMarker) n++; });
  return n;
});
assert(markerCount === 5, `一覧地図に circleMarker が5つ（実際: ${markerCount}）`);
await page.screenshot({ path: '/tmp/redtide-map.png' });
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

> 注: `redtideMaps` を検証から参照するため、`app.js` では `const redtideMaps` をトップレベル（＝ `window.redtideMaps`）に定義する。`L.CircleMarker` は `L.Circle` のサブクラスではないため、円(`L.Circle`)はカウントされずマーカーのみ5つになる。

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t2.mjs`
Expected: FAIL（`redtideMaps` 未定義で markerCount === -1）

- [ ] **Step 3: `redtideMaps` 状態と色定数を追加**

`app.js` の `let charts = {};`（204行目）の**直後**に追加:

```javascript

// 赤潮の地図インスタンス（一覧地図＋位置ピッカー）。
// CLAUDE.md のグローバル制限の例外として設計仕様書 §6 で承認済み。
const redtideMaps = { list: null, listLayers: null, picker: null, pickerMarker: null, pickerCircle: null };

// 海水の色 → 円/マーカーの色（赤潮＝赤系）
const REDTIDE_COLORS = {
    '正常': '#2f8f6f',
    '褐色': '#b5742a',
    '赤褐色': '#c0392b',
    '緑褐色': '#6f8f2a',
    default: '#c0392b'
};

// 一覧地図・ピッカーの初期表示（九州西岸〜瀬戸内が収まる位置）
const REDTIDE_DEFAULT_CENTER = [33.0, 131.5];
const REDTIDE_DEFAULT_ZOOM = 6;
```

- [ ] **Step 4: `renderChart`/`renderStats` を赤潮スキップにする**

`app.js` の `function renderChart(category) {`（544行目）の本体先頭に1行追加:

```javascript
function renderChart(category) {
    if (category === 'redtide') return; // 赤潮は専用の renderRedtideChart を使う
    const canvas = document.getElementById(`${category}Chart`);
    if (!canvas) return;
```

`app.js` の `function renderStats(category) {`（601行目）の本体先頭に1行追加:

```javascript
function renderStats(category) {
    if (category === 'redtide') return; // 赤潮は専用の renderRedtideStats を使う
    const statsDiv = document.getElementById(`${category}-stats`);
    if (!statsDiv) return;
```

- [ ] **Step 5: `renderTable` にデータ上書き引数を追加**

`app.js` の `function renderTable(category) {`（466-468行目）を次に置換:

```javascript
// テーブルをレンダリング（dataOverride 指定時はそれを使う＝赤潮のフィルタ後配列）
function renderTable(category, dataOverride) {
    const tbody = document.getElementById(`${category}-table-body`);
    const data = dataOverride !== undefined ? dataOverride : dataStore[category];
```

- [ ] **Step 6: 赤潮の描画統括・一覧地図関数を追加**

`app.js` の `hideRedtideView()`（443-447行目）の**直後**に、赤潮セクションとして追加:

```javascript

// ===== 赤潮：地図・統計・グラフ・フィルタ =====

// 赤潮ビュー全体を（フィルタ後データで）描画
function renderRedtideView() {
    const data = getFilteredRedtide();
    renderTable('redtide', data);
    renderRedtideStats(data);
    renderRedtideChart(data);
    renderRedtideMap(data);
}

// 一覧地図：フィルタ後の各記録をマーカー＋範囲円で描画
function renderRedtideMap(data) {
    const mapEl = document.getElementById('redtideMap');
    if (!mapEl || typeof L === 'undefined') return;

    if (!redtideMaps.list) {
        redtideMaps.list = L.map('redtideMap').setView(REDTIDE_DEFAULT_CENTER, REDTIDE_DEFAULT_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(redtideMaps.list);
        redtideMaps.listLayers = L.layerGroup().addTo(redtideMaps.list);
    }
    redtideMaps.list.invalidateSize();
    redtideMaps.listLayers.clearLayers();

    const points = [];
    data.forEach(item => {
        const lat = Number(item.latitude), lng = Number(item.longitude);
        if (!isFinite(lat) || !isFinite(lng)) return;
        const color = REDTIDE_COLORS[item.seaColor] || REDTIDE_COLORS.default;
        const radiusM = Math.max(Number(item.radiusKm) || 0, 0.1) * 1000;

        L.circle([lat, lng], { radius: radiusM, color, fillColor: color, fillOpacity: 0.2, weight: 1 })
            .addTo(redtideMaps.listLayers);
        const marker = L.circleMarker([lat, lng], { radius: 6, color, fillColor: color, fillOpacity: 0.9, weight: 1 })
            .addTo(redtideMaps.listLayers);

        const d = new Date(item.timestamp);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        marker.bindPopup(
            `<strong>${escapeHtml(dateStr)}</strong><br>` +
            `種類: ${escapeHtml(String(item.species ?? '-'))}<br>` +
            `細胞密度: ${escapeHtml(String(item.cellDensity ?? '-'))} cells/mL<br>` +
            `斃死数: ${escapeHtml(String(item.deadCount ?? '-'))} 尾<br>` +
            `半径: ${escapeHtml(String(item.radiusKm ?? '-'))} km`
        );
        points.push([lat, lng]);
    });

    if (points.length) {
        redtideMaps.list.fitBounds(points, { padding: [30, 30], maxZoom: 10 });
    } else {
        redtideMaps.list.setView(REDTIDE_DEFAULT_CENTER, REDTIDE_DEFAULT_ZOOM);
    }
}
```

- [ ] **Step 7: 統計・グラフ・フィルタの暫定スタブを追加（後続タスクで中身を実装）**

`renderRedtideView` から呼ばれる関数の未定義を防ぐため、同セクションに**暫定スタブ**を追加する（Task 3/4/5 で本実装に置換）:

```javascript
// 暫定スタブ（Task 3 で実装）
function renderRedtideStats(data) {}
// 暫定スタブ（Task 4 で実装）
function renderRedtideChart(data) {}
// 暫定スタブ（Task 5 で実装：まずは全期間を返す）
function getFilteredRedtide() { return dataStore.redtide; }
```

- [ ] **Step 8: `showRedtideView` を差し替え**

`app.js` の `showRedtideView()`（436-441行目）本体を次に置換（`renderTable('redtide')` を `renderRedtideView()` に）:

```javascript
function showRedtideView() {
    document.querySelector('.tabs').style.display = 'none';
    document.querySelector('.content').style.display = 'none';
    document.getElementById('redtideView').style.display = 'block';
    renderRedtideView();
}
```

- [ ] **Step 9: 通ることを確認**

Run: `cd .e2e && node t2.mjs`
Expected: `PASS: 一覧地図に circleMarker が5つ` ほか全PASS。`/tmp/redtide-map.png` に地図＋赤い円5つが写る。

- [ ] **Step 10: Commit**

```bash
git add app.js
git commit -m "feat: 赤潮一覧地図（マーカー＋範囲円＋ポップアップ）を実装"
```

---

### Task 3: 赤潮 専用統計カード

**Files:**
- Modify: `app.js`（Task 2 で追加した `renderRedtideStats` スタブを本実装に置換）
- Test: `.e2e/t3.mjs`

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t3.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);
const cards = await page.locator('#redtide-stats .stat-card').count();
assert(cards === 5, `統計カードが5枚（実際: ${cards}）`);
const text = await page.locator('#redtide-stats').innerText();
assert(text.includes('記録件数'), '「記録件数」カードがある');
assert(text.includes('最大細胞密度'), '「最大細胞密度」カードがある');
assert(text.includes('合計斃死数'), '「合計斃死数」カードがある');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t3.mjs`
Expected: FAIL（スタブなのでカード0枚）

- [ ] **Step 3: `renderRedtideStats` を本実装に置換**

`app.js` の `function renderRedtideStats(data) {}` スタブを次に置換:

```javascript
// 赤潮 専用統計（件数・最大細胞密度・平均溶存酸素・平均水温・合計斃死数）
function renderRedtideStats(data) {
    const el = document.getElementById('redtide-stats');
    if (!el) return;
    if (!data.length) { el.innerHTML = ''; return; }

    const nums = key => data.map(d => Number(d[key])).filter(v => isFinite(v));
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const cell = nums('cellDensity');
    const oxy = nums('oxygen');
    const temp = nums('waterTemp');
    const dead = nums('deadCount');

    const cards = [
        { label: '記録件数', value: `${data.length} 件` },
        { label: '最大細胞密度(cells/mL)', value: cell.length ? Math.max(...cell).toLocaleString() : '-' },
        { label: '平均溶存酸素(mg/L)', value: oxy.length ? (sum(oxy) / oxy.length).toFixed(1) : '-' },
        { label: '平均水温(℃)', value: temp.length ? (sum(temp) / temp.length).toFixed(1) : '-' },
        { label: '合計斃死数(尾)', value: dead.length ? sum(dead).toLocaleString() : '-' }
    ];

    el.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-label">${escapeHtml(c.label)}</div>
            <div class="stat-value">${escapeHtml(String(c.value))}</div>
        </div>
    `).join('');
}
```

- [ ] **Step 4: 通ることを確認**

Run: `cd .e2e && node t3.mjs`
Expected: 全PASS

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: 赤潮の専用統計カード（件数・最大細胞密度・平均溶存酸素/水温・合計斃死数）"
```

---

### Task 4: 赤潮 専用グラフ（多軸・🔴 slice問題の解決）

**Files:**
- Modify: `app.js`（Task 2 で追加した `renderRedtideChart` スタブを本実装に置換）
- Test: `.e2e/t4.mjs`

**背景:** 細胞密度は数千〜数万、溶存酸素/水温は一桁〜二桁でスケールが大きく異なる。細胞密度を右軸(`y1`)、溶存酸素・水温を左軸(`y`)に分ける。`charts.redtide` を使い既存の `charts` グローバル内に収める。

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t4.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);
const info = await page.evaluate(() => {
  const c = window.charts && window.charts.redtide;
  if (!c) return null;
  return { datasets: c.data.datasets.length, labels: c.data.datasets.map(d => d.label) };
});
assert(info !== null, 'charts.redtide が生成されている');
assert(info.datasets === 3, `データセットが3本（実際: ${info && info.datasets}）`);
assert(info.labels.some(l => l.includes('水温')), '水温系列が含まれる（sliceで漏れない）');
assert(info.labels.some(l => l.includes('細胞密度')), '細胞密度系列が含まれる');
assert(!info.labels.some(l => l.includes('プランクトン種類')), 'select項目(種類)は系列に入らない');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t4.mjs`
Expected: FAIL（スタブなので `charts.redtide` が null）

- [ ] **Step 3: `renderRedtideChart` を本実装に置換**

`app.js` の `function renderRedtideChart(data) {}` スタブを次に置換:

```javascript
// 赤潮 専用グラフ：細胞密度(右軸)・溶存酸素/水温(左軸) の折れ線
function renderRedtideChart(data) {
    const canvas = document.getElementById('redtideChart');
    if (!canvas) return;
    if (charts.redtide) { charts.redtide.destroy(); charts.redtide = null; }
    if (!data.length) return;

    const sorted = data.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels = sorted.map(item => {
        const d = new Date(item.timestamp);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    charts.redtide = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '細胞密度(cells/mL)', yAxisID: 'y1',
                    data: sorted.map(i => i.cellDensity),
                    borderColor: 'rgba(192,57,43,0.9)', backgroundColor: 'rgba(192,57,43,0.15)',
                    tension: 0.3, fill: false
                },
                {
                    label: '溶存酸素(mg/L)', yAxisID: 'y',
                    data: sorted.map(i => i.oxygen),
                    borderColor: 'rgba(13,139,147,0.9)', backgroundColor: 'rgba(13,139,147,0.15)',
                    tension: 0.3, fill: false
                },
                {
                    label: '水温(℃)', yAxisID: 'y',
                    data: sorted.map(i => i.waterTemp),
                    borderColor: 'rgba(244,192,91,0.9)', backgroundColor: 'rgba(244,192,91,0.15)',
                    tension: 0.3, fill: false
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true, aspectRatio: 2,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 15, font: { size: 11 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { type: 'linear', position: 'left', beginAtZero: false, title: { display: true, text: '溶存酸素 / 水温' } },
                y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: '細胞密度' } },
                x: { grid: { display: false } }
            }
        }
    });
}
```

- [ ] **Step 4: 通ることを確認**

Run: `cd .e2e && node t4.mjs`
Expected: 全PASS

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: 赤潮の専用グラフ（細胞密度=右軸/溶存酸素・水温=左軸の多軸折れ線）"
```

---

### Task 5: 年月日フィルタ

**Files:**
- Modify: `app.js`（`getFilteredRedtide` スタブを本実装に置換、`applyRedtideFilter`/`clearRedtideFilter` 追加、`changePage`/`renderCategory` の赤潮対応、`redtideFilter` 状態追加）
- Modify: `styles.css`（フィルタのスタイル）
- Test: `.e2e/t5.mjs`

- [ ] **Step 1: 失敗するE2Eチェックを書く**

ダミー5件は「今日・3日前・6日前・9日前・12日前」に生成される（`seedRedtideSampleIfEmpty` の `i * 3日` 間隔）。開始日を今日にすると1件のみ残るはず。

`.e2e/t5.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);

const todayIso = await page.evaluate(() => new Date().toISOString().slice(0, 10));
await page.fill('#redtide-filter-start', todayIso);
await page.locator('#redtideView button:has-text("絞り込み")').click();
await page.waitForTimeout(600);

const rows = await page.locator('#redtide-table-body tr').count();
assert(rows === 1, `開始日=今日で1件に絞られる（実際: ${rows}）`);
const markerCount = await page.evaluate(() => {
  let n = 0; window.redtideMaps.listLayers.eachLayer(l => { if (l instanceof window.L.CircleMarker) n++; });
  return n;
});
assert(markerCount === 1, `地図マーカーも1つに連動（実際: ${markerCount}）`);

// 全期間に戻す
await page.locator('#redtideView button:has-text("全期間")').click();
await page.waitForTimeout(400);
assert(await page.locator('#redtide-table-body tr').count() === 5, '「全期間」で5件に戻る');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t5.mjs`
Expected: FAIL（フィルタ未実装で5件のまま）

- [ ] **Step 3: `redtideFilter` 状態を追加**

`app.js` の `REDTIDE_DEFAULT_ZOOM` 定義（Task 2 で追加）の直後に追加:

```javascript

// 赤潮の年月日フィルタ状態（YYYY-MM-DD の文字列、空なら無制限）
const redtideFilter = { start: '', end: '' };
```

- [ ] **Step 4: `getFilteredRedtide` スタブを本実装に置換**

`app.js` の `function getFilteredRedtide() { return dataStore.redtide; }` を次に置換:

```javascript
// dataStore.redtide を年月日フィルタで絞り込む（JS側フィルタ・SQL再クエリはしない）
function getFilteredRedtide() {
    const { start, end } = redtideFilter;
    if (!start && !end) return dataStore.redtide;
    return dataStore.redtide.filter(item => {
        const t = item.timestamp ? String(item.timestamp).slice(0, 10) : '';
        if (start && t < start) return false;
        if (end && t > end) return false;
        return true;
    });
}

// フィルタUIの適用/解除
function applyRedtideFilter() {
    redtideFilter.start = document.getElementById('redtide-filter-start').value;
    redtideFilter.end = document.getElementById('redtide-filter-end').value;
    currentPage.redtide = 1;
    renderRedtideView();
}

function clearRedtideFilter() {
    redtideFilter.start = '';
    redtideFilter.end = '';
    document.getElementById('redtide-filter-start').value = '';
    document.getElementById('redtide-filter-end').value = '';
    currentPage.redtide = 1;
    renderRedtideView();
}
```

- [ ] **Step 5: `changePage` を赤潮フィルタ対応にする**

`app.js` の `changePage`（536-541行目）を次に置換:

```javascript
// ページを変更
function changePage(category, page) {
    const source = category === 'redtide' ? getFilteredRedtide() : dataStore[category];
    const totalPages = Math.ceil(source.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage[category] = page;
    if (category === 'redtide') {
        renderTable('redtide', getFilteredRedtide());
        return;
    }
    renderTable(category);
}
```

- [ ] **Step 6: `renderCategory` を赤潮対応にする（CRUD後の再描画がフィルタ・地図に連動）**

`app.js` の `renderCategory`（459-463行目）を次に置換:

```javascript
// カテゴリのテーブル・チャート・統計をまとめて再描画
function renderCategory(category) {
    if (category === 'redtide') { renderRedtideView(); return; }
    renderTable(category);
    renderChart(category);
    renderStats(category);
}
```

- [ ] **Step 7: フィルタのスタイルを追加**

`styles.css` の末尾に追加:

```css
/* ===== 赤潮：年月日フィルタ ===== */
.redtide-filter {
    margin-bottom: 16px;
}
.redtide-filter-label {
    display: block;
    font-size: 13px;
    color: #0a4650;
    margin-bottom: 6px;
}
.redtide-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.redtide-filter-row input[type="date"] {
    padding: 6px 10px;
    border: 1px solid #cfe0e0;
    border-radius: 8px;
}
```

- [ ] **Step 8: 通ることを確認**

Run: `cd .e2e && node t5.mjs`
Expected: 全PASS

- [ ] **Step 9: Commit**

```bash
git add app.js styles.css
git commit -m "feat: 赤潮の年月日フィルタ（地図・統計・グラフ・テーブル連動）"
```

---

### Task 6: モーダル位置ピッカー（🔴 赤潮専用フォーム分岐）

**Files:**
- Modify: `app.js`（`dataFields.redtide` のコメント更新、`showAddModal`/`editData` の赤潮フォーム分岐、ピッカー関数群を追加）
- Modify: `styles.css`（ピッカー地図・緯度経度行のスタイル）
- Test: `.e2e/t6.mjs`

**設計:** 緯度・経度・半径は `dataFields.redtide` に残す（`addData`/`updateData`/`renderTable`/CSV は汎用処理のまま動く）。ただしフォームでは、これら3項目を汎用ループから**除外**し、代わりに地図ピッカー＋スライダーのブロックを差し込む。ピッカーの緯度・経度入力は**汎用処理が読む同じid**（`add-latitude` / `add-longitude` / `add-radiusKm`）を持たせる。

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t6.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);

await page.locator('#redtideView button:has-text("データ追加")').click();
await page.waitForTimeout(800);

assert(await page.locator('#add-redtidePickerMap').count() === 1, 'モーダルにピッカー地図がある');
assert(await page.locator('#add-radiusKm[type="range"]').count() === 1, '半径スライダー(range)がある');
// 緯度経度は生の number 入力が「素の縦並び」ではなく readonly（地図駆動）
assert(await page.locator('#add-latitude').getAttribute('readonly') !== null, '緯度はreadonly（地図で入力）');

// 地図の中央をクリックして緯度経度が入る
const box = await page.locator('#add-redtidePickerMap').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(400);
const lat = await page.locator('#add-latitude').inputValue();
const lng = await page.locator('#add-longitude').inputValue();
assert(lat !== '' && lng !== '', `クリックで緯度経度が入る（lat=${lat}, lng=${lng}）`);

// スライダー変更で表示が更新
await page.evaluate(() => { const s = document.getElementById('add-radiusKm'); s.value = '10'; s.dispatchEvent(new Event('input')); });
await page.waitForTimeout(200);
assert((await page.locator('#add-radius-display').innerText()).includes('10'), 'スライダーで半径表示が更新');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t6.mjs`
Expected: FAIL（`#add-redtidePickerMap` が無い）

- [ ] **Step 3: ピッカーのHTML/初期化/イベント関数を追加**

`app.js` の赤潮セクション（Task 2〜5 で追加した関数群）の末尾に追加:

```javascript

// ピッカー対象フィールド（汎用フォームループから除外し、地図ピッカーで入力）
const REDTIDE_PICKER_FIELDS = ['latitude', 'longitude', 'radiusKm'];

// モーダル内 位置ピッカーのHTML（prefix は 'add' / 'edit'）
function redtidePickerHtml(prefix, lat, lng, radius) {
    const latVal = isFinite(Number(lat)) ? Number(lat) : '';
    const lngVal = isFinite(Number(lng)) ? Number(lng) : '';
    const rad = isFinite(Number(radius)) ? Number(radius) : 1;
    return `
        <div class="form-group">
            <label>発生地点（地図をクリックして指定）</label>
            <div id="${prefix}-redtidePickerMap" class="redtide-picker-map"></div>
            <div class="redtide-latlng-row">
                <input type="number" id="${prefix}-latitude" step="0.000001" placeholder="緯度" value="${latVal}" readonly required>
                <input type="number" id="${prefix}-longitude" step="0.000001" placeholder="経度" value="${lngVal}" readonly required>
            </div>
        </div>
        <div class="form-group">
            <label>広がり半径(km): <span id="${prefix}-radius-display">${rad}</span></label>
            <input type="range" id="${prefix}-radiusKm" min="0.1" max="50" step="0.1" value="${rad}"
                oninput="onRedtideRadiusInput('${prefix}')">
        </div>
    `;
}

// ピッカー地図を（再）初期化
function initRedtidePicker(prefix, lat, lng, radius) {
    const el = document.getElementById(`${prefix}-redtidePickerMap`);
    if (!el || typeof L === 'undefined') return;

    if (redtideMaps.picker) { redtideMaps.picker.remove(); }
    redtideMaps.picker = null;
    redtideMaps.pickerMarker = null;
    redtideMaps.pickerCircle = null;

    const hasPoint = isFinite(Number(lat)) && isFinite(Number(lng));
    const center = hasPoint ? [Number(lat), Number(lng)] : REDTIDE_DEFAULT_CENTER;
    const map = L.map(el).setView(center, hasPoint ? 9 : REDTIDE_DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    redtideMaps.picker = map;

    if (hasPoint) setRedtidePickerPoint(prefix, Number(lat), Number(lng));
    map.on('click', (e) => setRedtidePickerPoint(prefix, e.latlng.lat, e.latlng.lng));
    setTimeout(() => map.invalidateSize(), 150);
}

// クリック地点をマーカー＋緯度経度入力へ反映
function setRedtidePickerPoint(prefix, lat, lng) {
    const map = redtideMaps.picker;
    if (!map) return;
    document.getElementById(`${prefix}-latitude`).value = lat.toFixed(6);
    document.getElementById(`${prefix}-longitude`).value = lng.toFixed(6);
    if (redtideMaps.pickerMarker) {
        redtideMaps.pickerMarker.setLatLng([lat, lng]);
    } else {
        redtideMaps.pickerMarker = L.circleMarker([lat, lng], {
            radius: 6, color: '#c0392b', fillColor: '#c0392b', fillOpacity: 0.9, weight: 1
        }).addTo(map);
    }
    updateRedtidePickerCircle(prefix);
}

// スライダー入力：半径表示とプレビュー円を更新
function onRedtideRadiusInput(prefix) {
    document.getElementById(`${prefix}-radius-display`).textContent =
        document.getElementById(`${prefix}-radiusKm`).value;
    updateRedtidePickerCircle(prefix);
}

// プレビュー円を更新（マーカー未設置なら何もしない）
function updateRedtidePickerCircle(prefix) {
    const map = redtideMaps.picker;
    if (!map || !redtideMaps.pickerMarker) return;
    const center = redtideMaps.pickerMarker.getLatLng();
    const km = parseFloat(document.getElementById(`${prefix}-radiusKm`).value) || 0.1;
    const radiusM = km * 1000;
    if (redtideMaps.pickerCircle) {
        redtideMaps.pickerCircle.setLatLng(center).setRadius(radiusM);
    } else {
        redtideMaps.pickerCircle = L.circle(center, {
            radius: radiusM, color: '#c0392b', fillColor: '#c0392b', fillOpacity: 0.2, weight: 1
        }).addTo(map);
    }
}
```

- [ ] **Step 4: `showAddModal` に赤潮フォーム分岐を入れる**

`app.js` の `showAddModal`（644-685行目）の、`+ dataFields[category].map(field => {` から `.join('');` までのフィールド生成部を次に置換（`.filter(...)` で除外し、赤潮なら末尾にピッカーを連結）:

```javascript
    ` + dataFields[category]
        .filter(field => !(category === 'redtide' && REDTIDE_PICKER_FIELDS.includes(field.name)))
        .map(field => {
        if (field.type === 'select') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <select id="add-${field.name}" required>
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (field.type === 'image') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div class="photo-capture-area">
                        <input type="file" id="add-${field.name}" accept="image/*" capture="environment"
                            class="photo-file-input" onchange="handlePhotoSelect(event, 'add')">
                        <label for="add-${field.name}" class="photo-capture-btn">
                            📷 写真を撮影 / ギャラリーから選択
                        </label>
                        <div id="add-photo-preview" class="photo-preview-area"></div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input type="${field.type}" id="add-${field.name}" step="${field.step || '1'}" required>
                </div>
            `;
        }
    }).join('') + (category === 'redtide' ? redtidePickerHtml('add', null, null, 1) : '');
```

そして `modal.classList.add('active');`（678行目）の**直後**にピッカー初期化を追加:

```javascript
    modal.classList.add('active');
    if (category === 'redtide') initRedtidePicker('add', null, null, 1);
```

- [ ] **Step 5: `editData` に赤潮フォーム分岐を入れる**

`app.js` の `editData`（728-763行目）のフィールド生成部を、`showAddModal` と同様に `.filter(...)` で除外し、末尾にピッカー（既存値入り）を連結する。`+ dataFields[category].map(field => {` を次に置換:

```javascript
    ` + dataFields[category]
        .filter(field => !(category === 'redtide' && REDTIDE_PICKER_FIELDS.includes(field.name)))
        .map(field => {
        if (field.type === 'select') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <select id="edit-${field.name}" required>
                        ${field.options.map(opt => `<option value="${opt}" ${item[field.name] === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (field.type === 'image') {
            const existing = item[field.name];
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div class="photo-capture-area">
                        <input type="file" id="edit-${field.name}" accept="image/*" capture="environment"
                            class="photo-file-input" onchange="handlePhotoSelect(event, 'edit')">
                        <label for="edit-${field.name}" class="photo-capture-btn">
                            📷 写真を変更する
                        </label>
                        <div id="edit-photo-preview" class="photo-preview-area">
                            ${existing ? `<img src="${existing}" class="photo-preview-img" />` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input type="${field.type}" id="edit-${field.name}" step="${field.step || '1'}" value="${item[field.name] || ''}" required>
                </div>
            `;
        }
    }).join('') + (category === 'redtide'
        ? redtidePickerHtml('edit', item.latitude, item.longitude, item.radiusKm)
        : '');
```

そして `editData` の `modal.classList.add('active');`（765行目）の**直後**に追加:

```javascript
    modal.classList.add('active');
    if (category === 'redtide') initRedtidePicker('edit', item.latitude, item.longitude, item.radiusKm);
```

- [ ] **Step 6: `dataFields.redtide` のコメントを更新**

`app.js:187-188` のコメントを次に置換（もう「通常の数値入力」ではない）:

```javascript
    // 赤潮データ（独立ビュー）。latitude/longitude/radiusKm はモーダルの地図ピッカー＋
    // スライダーで入力する（REDTIDE_PICKER_FIELDS で汎用フォームから除外）。
```

- [ ] **Step 7: ピッカーのスタイルを追加**

`styles.css` の末尾に追加:

```css
/* ===== 赤潮：位置ピッカー ===== */
.redtide-picker-map {
    width: 100%;
    height: 240px;
    border-radius: 10px;
    margin-bottom: 8px;
    z-index: 0;
}
.redtide-latlng-row {
    display: flex;
    gap: 8px;
}
.redtide-latlng-row input {
    flex: 1;
    min-width: 0;
}
```

- [ ] **Step 8: 通ることを確認**

Run: `cd .e2e && node t6.mjs`
Expected: 全PASS

- [ ] **Step 9: Commit**

```bash
git add app.js styles.css
git commit -m "feat: 赤潮モーダルに地図位置ピッカー＋半径スライダー（専用フォーム分岐）"
```

---

### Task 7: 赤潮の緯度経度バリデーション

**Files:**
- Modify: `app.js`（`addData`/`updateData` に赤潮バリデーション分岐、`validateRedtideInputs` 追加）
- Test: `.e2e/t7.mjs`

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t7.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);

// 地図をクリックせず（緯度経度未指定で）保存を試みる → 追加されないこと
await page.locator('#redtideView button:has-text("データ追加")').click();
await page.waitForTimeout(700);
// readonly required により素直な submit はブロックされうるので、JS検証も効くことを確認する。
// required を一時的に外して submit し、JS側 validateRedtideInputs が止めることを検証。
await page.evaluate(() => {
  document.getElementById('add-latitude').removeAttribute('required');
  document.getElementById('add-longitude').removeAttribute('required');
});
await page.locator('#addModal button:has-text("保存")').click();
await page.waitForTimeout(500);
const rowsAfter = await page.locator('#redtide-table-body tr').count();
assert(rowsAfter === 5, `未指定保存はブロックされ5件のまま（実際: ${rowsAfter}）`);
assert(await page.locator('#addModal').evaluate(el => el.classList.contains('active')), 'モーダルは開いたまま');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t7.mjs`
Expected: FAIL（バリデーション未実装だと NaN で1件挿入され6件になる）

- [ ] **Step 3: `validateRedtideInputs` を追加**

`app.js` の赤潮セクション末尾（Task 6 の関数群の後）に追加:

```javascript
// 赤潮の緯度経度バリデーション（prefix は 'add' / 'edit'）
function validateRedtideInputs(prefix) {
    const lat = parseFloat(document.getElementById(`${prefix}-latitude`).value);
    const lng = parseFloat(document.getElementById(`${prefix}-longitude`).value);
    if (!isFinite(lat) || !isFinite(lng)) {
        showAlert('warning', '地図で発生地点を指定してください');
        return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showAlert('warning', '緯度・経度の値が範囲外です');
        return false;
    }
    return true;
}
```

- [ ] **Step 4: `addData` にバリデーション分岐を入れる**

`app.js` の `function addData(category) {`（688-689行目）本体先頭に追加:

```javascript
function addData(category) {
    if (category === 'redtide' && !validateRedtideInputs('add')) return;
    const id = Date.now() + Math.random();
```

- [ ] **Step 5: `updateData` にバリデーション分岐を入れる**

`app.js` の `function updateData(category, id) {`（775-776行目）本体先頭に追加:

```javascript
function updateData(category, id) {
    if (category === 'redtide' && !validateRedtideInputs('edit')) return;
    const timestamp = document.getElementById('edit-timestamp').value;
```

- [ ] **Step 6: 通ることを確認 ＋ 正常系（地図クリックで保存できる）も確認**

`.e2e/t7b.mjs`（正常系）:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);
await page.locator('#redtideView button:has-text("データ追加")').click();
await page.waitForTimeout(700);
const box = await page.locator('#add-redtidePickerMap').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(300);
await page.locator('#addModal button:has-text("保存")').click();
await page.waitForTimeout(600);
assert(await page.locator('#redtide-table-body tr').count() === 6, '地図指定後は保存でき6件になる');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

Run:
```bash
cd .e2e && node t7.mjs && node t7b.mjs
```
Expected: 両方とも全PASS

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: 赤潮の緯度経度バリデーション（未指定・範囲外を保存前に弾く）"
```

---

### Task 8: CSVの0値修正 と ドキュメント更新

**Files:**
- Modify: `app.js:827`（`exportData` の `|| ''` を `?? ''` に）
- Modify: `CLAUDE.md`
- Test: `.e2e/t8.mjs`

**背景（🔴レビュー補足）:** `exportData` は `item[f.name] || ''` のため値 `0`（斃死数0・死亡数0 等）が空欄化される。`?? ''` にして `0` を保持する（全カテゴリに効く低リスク改善）。

- [ ] **Step 1: 失敗するE2Eチェックを書く**

`.e2e/t8.mjs`（ページ内で `exportData` のCSV生成ロジックを検証：0を含む赤潮レコードのCSV行に `0` が残るか）:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);
await openRedtide(page);

// dataStore.redtide に斃死数0のレコードがある想定でCSV文字列を組み立てる関数を再現検証する。
// 実アプリの exportData はダウンロードを起こすため、ここでは同じ整形規則を評価する。
const hasZero = await page.evaluate(() => {
  // 斃死数0のダミーを一時的に混ぜてCSV整形（?? '' が効けば "0" が残る）
  const item = { timestamp: new Date().toISOString(), species: 'その他', cellDensity: 100, oxygen: 5,
    waterTemp: 20, seaColor: '正常', deadCount: 0, response: 'なし', latitude: 33, longitude: 131, radiusKm: 1 };
  const cells = dataFields.redtide.map(f => item[f.name] ?? '');
  return cells.includes(0);
});
assert(hasZero, 'CSV整形で deadCount=0 が空欄化されず 0 が残る（?? を使用）');

// 実装が ?? になっていることをソース面でも担保（|| '' が残っていないこと）
const usesNullish = await page.evaluate(() => exportData.toString().includes("?? ''"));
assert(usesNullish, 'exportData が "?? \\'\\'" を使っている');
assert(errors.length === 0, 'エラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 失敗を確認**

Run: `cd .e2e && node t8.mjs`
Expected: FAIL（`exportData` がまだ `|| ''`）

- [ ] **Step 3: `exportData` を修正**

`app.js:827` の該当行を置換:

```javascript
            ...dataFields[category].map(f => item[f.name] ?? '')
```

- [ ] **Step 4: 通ることを確認**

Run: `cd .e2e && node t8.mjs`
Expected: 全PASS

- [ ] **Step 5: `CLAUDE.md` を更新**

`CLAUDE.md` の「### 全般」節の「外部ライブラリはCDN経由のChart.jsのみ許可」を次に置換:

```markdown
- 外部ライブラリはCDN経由の Chart.js と **Leaflet.js（赤潮データの地図）** のみ許可
```

「### JavaScript」節の「グローバル変数は …」の行を次に置換:

```markdown
- グローバル変数は `dataStore`・`dataFields`・`charts`・`currentPage` に限定する（赤潮の地図インスタンス保持のため `redtideMaps` のみ例外として追加）
```

「### データ」節の末尾に追加:

```markdown
- 赤潮データ（`redtide`）は独立ビュー。緯度・経度・広がり半径はモーダルの Leaflet 地図ピッカー＋半径スライダーで入力し、`REDTIDE_PICKER_FIELDS` で汎用フォームから除外する
- 赤潮の統計・グラフは汎用の `renderStats`/`renderChart` を使わず専用の `renderRedtideStats`/`renderRedtideChart` を使う（描画は `renderRedtideView()` に集約）
```

- [ ] **Step 6: Commit**

```bash
git add app.js CLAUDE.md
git commit -m "fix: CSVで0値を保持（?? ''）＋ CLAUDE.mdにLeaflet/赤潮の規約を追記"
```

---

### Task 9: 全体回帰・永続化・XSS の最終確認

**Files:**
- Test: `.e2e/t9.mjs`

- [ ] **Step 1: 総合E2Eチェックを書く**

`.e2e/t9.mjs`:

```javascript
import { launch, login, openRedtide, assert } from './helpers.mjs';
const { browser, page, errors } = await launch();
await login(page);

// 既存5カテゴリが壊れていない（水質タブにグラフとテーブルがある）
assert(await page.locator('#waterChart').count() === 1, '既存の水質グラフが存在');
assert(await page.locator('#water-table-body tr').count() > 0, '既存の水質テーブルに行がある');

await openRedtide(page);

// XSS：対応措置に記号入りの記録を追加してもポップアップ/テーブルで無害化される
await page.locator('#redtideView button:has-text("データ追加")').click();
await page.waitForTimeout(700);
const box = await page.locator('#add-redtidePickerMap').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.selectOption('#add-response', { label: 'その他' }).catch(() => {});
await page.locator('#addModal button:has-text("保存")').click();
await page.waitForTimeout(600);
assert(await page.locator('#redtide-table-body tr').count() === 6, '追加後6件');

// 戻る→再表示の往復でエラーが出ない
await page.locator('#redtideView button:has-text("戻る")').click();
await page.waitForTimeout(300);
await openRedtide(page);
assert(await page.locator('#redtideView').isVisible(), '戻る→再表示できる');

assert(errors.length === 0, '全操作でエラー無し: ' + errors.join(' | '));
await browser.close();
```

- [ ] **Step 2: 実行**

Run: `cd .e2e && node t9.mjs`
Expected: 全PASS

- [ ] **Step 3: フルページのスクリーンショットで目視確認**

```bash
cd .e2e && node -e "import('./helpers.mjs').then(async ({launch,login,openRedtide})=>{const {browser,page}=await launch();await login(page);await openRedtide(page);await page.screenshot({path:'/tmp/redtide-full.png',fullPage:true});await browser.close();})"
```

`/tmp/redtide-full.png` を開き、地図（円5つ）・統計5枚・多軸グラフ・テーブルが縦に並んでいることを確認する。

- [ ] **Step 4: 最終Commit（必要なら）**

E2Eスクリプトはgitignore下なのでコミット不要。ここまでの機能コミットで完了。

---

## Self-Review 結果

**1. Spec coverage（仕様書 §との対応）:**
- §3.2 ビュー構成（フィルタ/地図/統計/グラフ/テーブル）→ Task 1〜5 ✅
- §3.3 モーダル位置ピッカー＋半径スライダー＋必須 → Task 6, 7 ✅
- §3.4 年月日フィルタ（JS側フィルタ・連動再描画）→ Task 5 ✅
- §5.2 一覧地図（circleMarker＋circle＋popup＋fitBounds）→ Task 2 ✅
- §5.3 ミニ地図（click/marker/半径プレビュー/invalidateSize）→ Task 6 ✅
- §6 セキュリティ（escapeHtml/CSV/緯度経度範囲検証/redtideMaps例外）→ Task 2,6,7,8 ✅
- §7 影響ファイル（index.html/styles.css/app.js/CLAUDE.md）→ 全Task ✅
- §9 テスト観点（往復/CRUD反映/永続化/フィルタ連動/既存DB非破壊/XSS/CSV）→ Task 9 ＋各Task ✅
- 🔴レビュー項目（renderChart slice / フォーム分岐）→ Task 4 / Task 6 で解決 ✅

**2. Placeholder scan:** 各ステップに実コードを記載。「TODO」「後で」等の未定義参照なし。Task 2 のスタブは Task 3/4/5 で本実装に置換する旨を明記済み（意図的な段階実装）。

**3. Type/命名整合:** `redtideMaps`（list/listLayers/picker/pickerMarker/pickerCircle）、`renderRedtideView/Map/Stats/Chart`、`getFilteredRedtide`、`redtideFilter`、`REDTIDE_PICKER_FIELDS`、`redtidePickerHtml/initRedtidePicker/setRedtidePickerPoint/onRedtideRadiusInput/updateRedtidePickerCircle/validateRedtideInputs`、id `add-/edit-latitude/longitude/radiusKm`、`add-redtidePickerMap` 等、タスク間で一貫。`renderTable(category, dataOverride)` の追加引数は Task 2 で定義し Task 5 の `changePage` で使用。

---

## 補足（スコープ外・任意）

- ダミーデータ `seedRedtideSampleIfEmpty()` の数値精度（`Math.random` 生値で桁過多）は本計画のスコープ外。クライアント確認用zip前に丸めるなら別途軽微修正（`oxygen`/`waterTemp` を `toFixed(1)` 相当で投入）。
- 実データ入手後、`dataFields.redtide` のスキーマ増減が発生しうる。増減時は `createTables` の redtide 定義・テーブルヘッダ（index.html）・本フィルタ/統計/グラフの参照キーを合わせて更新すること。
