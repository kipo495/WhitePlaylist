# YouTube Playlist Lock

指定した再生リスト以外の YouTube 動画（通常動画および Shorts）の再生を制限・ロックする Manifest V3 対応の Chrome 拡張機能です。

---

## main functions

- **white playlists**: main function of this extencion.
- **shorts block**: sub position
- **import/export playlists**: JSON files

---

## directory

```text
youtube-playlist-lock/
├── manifest.json              # 拡張機能の設定 (Manifest V3)
├── config.js                  # 共通定数・セレクタ・設定管理 (YPL グローバル)
├── background/
│   └── background.js          # Service Worker (webNavigation によるバッジ管理)
├── content/
│   ├── content.js             # コンテンツスクリプト (判定統括・YPL Page Log 出力)
│   ├── overlay.js             # オーバーレイ制御モジュール (Watch / Shorts 対応)
│   └── videoController.js     # 動画停止制御・すり抜け防止・ログ記録モジュール
├── popup/
│   ├── popup.html             # ポップアップ UI
│   ├── popup.js               # ポップアップロジック (Shortsトグル・タイトル取得・リスト管理)
│   └── popup.css              # ダークモードスタイリング
├── utils/
│   ├── migration.js           # 旧データ形式からの自動マイグレーション処理
│   ├── playlist.js            # IDパース & oEmbed タイトル取得ユーティリティ
│   └── import_export_lists.js # プレイリスト ID の JSON 入出力
└── icons/                     # 拡張機能用アイコン画像
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## installation

### A.developper mode
1. clone this repo
2. open `chrome://extensions` on chrome
3. turn on **developper mode** up-right
4. click **load unpackeged extencions**, then select the directory you cloned this repo

---

## how to use

1. open the page of playlists you want to allow access to or have the playlist ID (which is in the URL) ready.
2. click the icon of the extencion and show popup
3. click **📍** to input the url of current tab
4. click **+** to add the playlist
5. click the btn with **🔒** to enable white playlists, click the btn with **📱** to block all shorts

---

## debug and dev

- clone this repo and toggle devlopper mode on extencion page and load the extencion
- right-click on the icon and select **see inspects of the popup**
