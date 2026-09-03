/**
 * config.js
 * 拡張機能全体で共有する定数・設定値
 *
 * 読み込み順序:
 *   - content script : manifest.json の js 配列で content.js より先に指定
 *   - popup          : popup.html の <script> で popup.js より先に指定
 *   - background     : importScripts('../config.js') で読み込む
 *
 * ES module ではなくグローバル名前空間 (YPL) を使うことで、
 * content script・service worker・popup の全環境で共有できる。
 */

/* global */ const YPL = Object.freeze({

  // ── ストレージキー ──────────────────────────────────────────────────────

  /** chrome.storage.sync のキー名 */
  STORAGE_KEYS: Object.freeze({
    /** 保存済み再生リスト（オブジェクト配列 {id, title, addedAt}） @type {Array<{id: string, title: string, addedAt: number}>} */
    PLAYLISTS    : 'playlists',

    /** （旧形式）保存済み再生リスト ID の配列  @type {string[]} */
    PLAYLIST_IDS : 'playlistIds',

    /** 制限機能の有効フラグ          @type {boolean} */
    IS_ENABLED   : 'isEnabled',

    /**
     * リストモード                  @type {'whitelist'|'blacklist'}
     *
     * whitelist : 指定リストのみ再生を許可（現在実装済み）
     * blacklist : 指定リストの再生をブロック（将来実装予定）
     */
    MODE         : 'mode',
  }),

  // ── リストモード ────────────────────────────────────────────────────────

  /** 制限モードの値 */
  LIST_MODE: Object.freeze({
    WHITELIST : 'whitelist',
    BLACKLIST : 'blacklist',
  }),

  // ── メッセージタイプ ────────────────────────────────────────────────────

  /** background / popup / content script 間のメッセージ種別 */
  MSG_TYPES: Object.freeze({
    /** 制限状態が変化したことを content script へ通知 */
    STATE_CHANGED : 'STATE_CHANGED',
  }),

  // ── デフォルト値 ────────────────────────────────────────────────────────

  /** ストレージ未設定時のフォールバック値 */
  DEFAULTS: Object.freeze({
    IS_ENABLED   : false,
    PLAYLISTS    : [],
    PLAYLIST_IDS : [],
    MODE         : 'whitelist',
  }),

  // ── YouTube DOM / イベント ──────────────────────────────────────────────

  /** YouTube のページ・プレイヤーに関する定数 */
  YOUTUBE: Object.freeze({
    /**
     * SPA ナビゲーション完了イベント
     * YouTube の内部フレームワークが DOM 更新後に document へ発火する。
     * content script での動画操作タイミングに使用する。
     */
    NAVIGATE_EVENT  : 'yt-navigate-finish',

    /** メイン動画要素のセレクタ */
    VIDEO_SELECTOR  : 'video.html5-main-video',

    /** プレイヤーコンテナのセレクタ */
    PLAYER_SELECTOR : '#movie_player',
  }),

  // ── ブロックオーバーレイ ────────────────────────────────────────────────

  /** 動画上に表示するブロックオーバーレイの設定 */
  OVERLAY: Object.freeze({
    /** 重複挿入を防ぐための要素 ID */
    ELEMENT_ID : 'ypl-block-overlay',

    /** z-index（YouTube の UI より手前に表示する） */
    Z_INDEX    : '2147483647',

    /** 背景色 */
    BG_COLOR   : 'rgba(0, 0, 0, 0.92)',

    /** テキスト色 */
    TEXT_COLOR : '#ffffff',
  }),

  // ── 一時停止ループ ──────────────────────────────────────────────────────

  /** ブロック中の動画を定期的に一時停止するインターバル (ms) */
  PAUSE_INTERVAL_MS : 500,

  // ── UI テキスト ─────────────────────────────────────────────────────────

  /** ブロックオーバーレイに表示するテキスト */
  BLOCK_MESSAGE: Object.freeze({
    ICON     : '🔒',
    TITLE    : '再生がブロックされています',
    SUBTITLE_WHITELIST : 'このプレイリストは許可されていません',
    SUBTITLE_BLACKLIST : 'このプレイリストはブロックされています',
  }),
});
