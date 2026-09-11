/**
 * config.js
 * 拡張機能全体で共有する定数・設定値
 */

/* global */ const YPL = Object.freeze({

  // ── ストレージキー ──────────────────────────────────────────────────────

  /** chrome.storage.sync のキー名 */
  STORAGE_KEYS: Object.freeze({
    PLAYLISTS: 'playlists',
    PLAYLIST_IDS: 'playlistIds',
    IS_ENABLED: 'isEnabled',
    BLOCK_SHORTS: 'blockShorts',
    MODE: 'mode',
  }),

  // ── リストモード ────────────────────────────────────────────────────────

  LIST_MODE: Object.freeze({
    WHITELIST: 'whitelist',
    BLACKLIST: 'blacklist',
  }),

  // ── メッセージタイプ ────────────────────────────────────────────────────

  MSG_TYPES: Object.freeze({
    STATE_CHANGED: 'STATE_CHANGED',
  }),

  // ── デフォルト値 ────────────────────────────────────────────────────────

  DEFAULTS: Object.freeze({
    IS_ENABLED: false,
    BLOCK_SHORTS: false,
    PLAYLISTS: [],
    PLAYLIST_IDS: [],
    MODE: 'whitelist',
  }),

  // ── YouTube DOM / イベント・セレクタ定数 ────────────────────────────────

  YOUTUBE: Object.freeze({
    NAVIGATE_EVENT: 'yt-navigate-finish',

    /** 
     * 全動画要素を取得するセレクタ
     * 通常動画・Shorts・埋め込みプレイヤー等の全 `<video>` タグを捕捉
     */
    VIDEO_SELECTORS: [
      'video.html5-main-video',
      'video.video-stream',
      'video',
    ],

    /**
     * ページ種別ごとのプレイヤーコンテナ優先度
     * YouTube の DOM 変更にも備えて複数の候補を指定
     */
    CONTAINER_SELECTORS: Object.freeze({
      WATCH: [
        '#movie_player',
        '#full-bleed-container',
        'ytd-watch-flexy #player-container',
      ],
      SHORTS: [
        '#shorts-player',
        'ytd-shorts #shorts-container',
        'ytd-shorts',
        'ytd-reel-video-renderer[is-active]',
      ],
    }),
  }),

  // ── ブロックオーバーレイ ────────────────────────────────────────────────

  OVERLAY: Object.freeze({
    ELEMENT_ID: 'ypl-block-overlay',
    Z_INDEX: '2147483647',
    BG_COLOR: 'rgba(0, 0, 0, 0.94)',
    TEXT_COLOR: '#ffffff',
  }),

  // ── 一時停止制御 ────────────────────────────────────────────────────────

  PAUSE_INTERVAL_MS: 300,

  // ── UI テキスト ─────────────────────────────────────────────────────────

  BLOCK_MESSAGE: Object.freeze({
    ICON: '🔒',
    TITLE: '再生がブロックされています',
    SUBTITLE_WHITELIST: 'このプレイリストは許可されていません',
    SUBTITLE_BLACKLIST: 'このプレイリストはブロックされています',
    SUBTITLE_SHORTS: 'Shorts の再生はブロックされています',
  }),
});
