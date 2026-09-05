/**
 * content/content.js
 * コンテンツスクリプト — 全体統括ロジック
 * 
 * 分離された YPL_Overlay および YPL_VideoController モジュールと連携して
 * YouTube 動画 / Shorts の再生制限を行います。
 */

(function () {
  'use strict';

  const { STORAGE_KEYS, DEFAULTS, MSG_TYPES, YOUTUBE } = YPL;

  // ── 状態 ──────────────────────────────────────────────────────────────────

  /** @type {{ isEnabled: boolean, playlistIds: string[], mode: string }} */
  let state = {
    isEnabled   : DEFAULTS.IS_ENABLED,
    playlistIds : [...DEFAULTS.PLAYLIST_IDS],
    mode        : DEFAULTS.MODE,
  };

  // ── 初期化 ────────────────────────────────────────────────────────────────

  async function init() {
    await loadState();
    applyRestriction();
    listenNavigation();
    listenMessages();
  }

  /** ストレージから現在の状態を読み込む */
  async function loadState() {
    const data = await chrome.storage.sync.get([
      STORAGE_KEYS.IS_ENABLED,
      STORAGE_KEYS.PLAYLIST_IDS,
      STORAGE_KEYS.MODE,
    ]);
    state.isEnabled   = data[STORAGE_KEYS.IS_ENABLED]   ?? DEFAULTS.IS_ENABLED;
    state.playlistIds = data[STORAGE_KEYS.PLAYLIST_IDS] ?? [...DEFAULTS.PLAYLIST_IDS];
    state.mode        = data[STORAGE_KEYS.MODE]         ?? DEFAULTS.MODE;
  }

  // ── ナビゲーション監視 ────────────────────────────────────────────────────

  /** YouTube SPA のナビゲーション完了後に制限を再評価する */
  function listenNavigation() {
    document.addEventListener(YOUTUBE.NAVIGATE_EVENT, () => {
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
      applyRestriction();
    });
  }

  // ── メッセージ受信 ────────────────────────────────────────────────────────

  /** popup からの状態変更通知を受信してリアルタイムに制限を再評価する */
  function listenMessages() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type !== MSG_TYPES.STATE_CHANGED) return;
      const payload     = message.payload;
      state.isEnabled   = payload.isEnabled   ?? state.isEnabled;
      state.playlistIds = payload.playlistIds ?? state.playlistIds;
      state.mode        = payload.mode        ?? state.mode;
      applyRestriction();
    });
  }

  // ── 制限判定・適用 ────────────────────────────────────────────────────────

  /** 現在のページへ制限を適用または解除する */
  function applyRestriction() {
    const isWatch  = isWatchPage();
    const isShorts = isShortsPage();

    // 動画再生ページでも Shorts でもない場合は制御クリア
    if (!isWatch && !isShorts) {
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
      return;
    }

    if (!state.isEnabled) {
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
      return;
    }

    if (shouldBlock()) {
      window.YPL_VideoController.start();
      window.YPL_Overlay.show(state.mode, isShorts);
    } else {
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
    }
  }

  /** @returns {boolean} */
  function isWatchPage() {
    return location.pathname === '/watch';
  }

  /** @returns {boolean} */
  function isShortsPage() {
    return location.pathname.startsWith('/shorts/');
  }

  /**
   * 現在の動画をブロックすべきか判定する
   * @returns {boolean}
   */
  function shouldBlock() {
    const currentListId = new URLSearchParams(location.search).get('list') ?? '';
    if (state.playlistIds.length === 0) return true;
    return !state.playlistIds.includes(currentListId);
  }

  // ── エントリポイント ──────────────────────────────────────────────────────

  init();
})();
