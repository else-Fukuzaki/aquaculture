# iOSアプリ化 セットアップガイド

## 前提条件

- macOS（Xcode実行に必要）
- Xcode 15以上
- Node.js 18以上
- Apple Developer アカウント
- CocoaPods（`sudo gem install cocoapods`）

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. iOSプラットフォームの追加

```bash
npx cap add ios
```

### 3. Webアセットをネイティブプロジェクトにコピー

```bash
npx cap copy ios
```

### 4. Xcodeでプロジェクトを開く

```bash
npx cap open ios
```

### 5. Xcodeで設定する項目

1. **Bundle Identifier**: `jp.co.aquaculture.app`（変更する場合は `capacitor.config.json` の `appId` も合わせて変更）
2. **Signing & Capabilities**: Apple Developer アカウントでサインイン
3. **Display Name**: `養殖漁業管理システム`（または任意の名称）
4. **Deployment Target**: iOS 14.0以上を推奨

### 6. シミュレータ・実機でのビルド・実行

Xcodeの再生ボタン（▶️）でビルドと起動ができる。

---

## 注意事項

### CDN依存について

現在のアプリは以下のライブラリをCDN経由で読み込んでいる：

| ライブラリ | CDN URL |
|---|---|
| sql.js | `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/sql-wasm.js` |
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` |

Capacitorアプリがネットワークにアクセスできる環境では問題なく動作する。
`capacitor.config.json` の `server.allowNavigation` に `cdn.jsdelivr.net` を許可済み。

### localStorage について

- `localStorage` はCapacitorのiOS環境でも使用可能（WKWebViewのストレージを利用）
- ただし、アプリを削除するとデータが消える点はブラウザ版と同様

### sql.js（WASM版）について

- Capacitor環境でもsql.jsのWASM版は動作する
- 将来的に `@capacitor-community/sqlite` への移行を推奨（CLAUDE.mdのデータルール参照）
- 現フェーズはsql.jsのままで進める

---

## 更新手順（コード変更後）

`index.html` / `styles.css` / `app.js` を変更した場合は以下を実行する：

```bash
npx cap copy ios
```

その後Xcodeで再ビルドする。

---

## トラブルシューティング

### sql-wasm.wasmが読み込まれない

`capacitor.config.json` の `server.allowNavigation` に `cdn.jsdelivr.net` が含まれているか確認する。

### ネットワークエラーが出る場合

オフライン環境での使用を想定する場合、将来的にsql.jsとChart.jsをローカルにバンドルすることを検討する。

### CocoaPodsのエラーが出る場合

```bash
cd ios/App
pod install
```

を実行してから再度Xcodeを開く。
