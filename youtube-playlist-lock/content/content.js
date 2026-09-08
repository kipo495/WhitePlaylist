/**
 * content/content.js
 * コンテンツスクリプト — 全体統括ロジック
 * 
 * 通常動画制限 (isEnabled) と Shorts 制限 (blockShorts) を独立制御し、
 * isShortsPage / isWatchPage 判定周りのログを出力します。
 */

(function () {
  'use strict';

  const { STORAGE_KEYS, DEFAULTS, MSG_TYPES, YOUTUBE } = YPL;

  // ── 状態 ──────────────────────────────────────────────────────────────────

  /** @type {{ isEnabled: boolean, blockShorts: boolean, playlistIds: string[], mode: string }} */
  let state = {
    isEnabled: DEFAULTS.IS_ENABLED,
    blockShorts: DEFAULTS.BLOCK_SHORTS,
    playlistIds: [...DEFAULTS.PLAYLIST_IDS],
    mode: DEFAULTS.MODE,
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
      STORAGE_KEYS.BLOCK_SHORTS,
      STORAGE_KEYS.PLAYLIST_IDS,
      STORAGE_KEYS.MODE,
    ]);
    state.isEnabled = data[STORAGE_KEYS.IS_ENABLED] ?? DEFAULTS.IS_ENABLED;
    state.blockShorts = data[STORAGE_KEYS.BLOCK_SHORTS] ?? DEFAULTS.BLOCK_SHORTS;
    state.playlistIds = data[STORAGE_KEYS.PLAYLIST_IDS] ?? [...DEFAULTS.PLAYLIST_IDS];
    state.mode = data[STORAGE_KEYS.MODE] ?? DEFAULTS.MODE;

    console.log('[YPL Page Log] Loaded state:', {
      isEnabled: state.isEnabled,
      blockShorts: state.blockShorts,
      playlistIdsCount: state.playlistIds.length,
    });
  }

  // ── ナビゲーション監視 ────────────────────────────────────────────────────

  /** YouTube SPA のナビゲーション完了後に制限を再評価する */
  function listenNavigation() {
    document.addEventListener(YOUTUBE.NAVIGATE_EVENT, (e) => {
      console.log('[YPL Page Log] SPA Navigation event triggered:', location.href);
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
      applyRestriction();
    });

    // URL 変更の補助監視 (History API / Shorts スワイプ対策)
    window.addEventListener('popstate', () => {
      console.log('[YPL Page Log] History popstate event:', location.href);
      applyRestriction();
    });
  }

  // ── メッセージ受信 ────────────────────────────────────────────────────────

  /** popup からの状態変更通知を受信してリアルタイムに制限を再評価する */
  function listenMessages() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type !== MSG_TYPES.STATE_CHANGED) return;
      const payload = message.payload;
      state.isEnabled = payload.isEnabled ?? state.isEnabled;
      state.blockShorts = payload.blockShorts ?? state.blockShorts;
      state.playlistIds = payload.playlistIds ?? state.playlistIds;
      state.mode = payload.mode ?? state.mode;

      console.log('[YPL Page Log] Received state update message:', {
        isEnabled: state.isEnabled,
        blockShorts: state.blockShorts,
      });

      applyRestriction();
    });
  }

  // ── ページ種別判定 (ログ出力付き) ─────────────────────────────────────────

  /**
   * 現在のページが通常動画 (/watch) かどうか判定する
   * @returns {boolean}
   */
  function isWatchPage() {
    const isWatch = location.pathname === '/watch';
    return isWatch;
  }

  /**
   * 現在のページが Shorts (/shorts/...) かどうか判定する。
   * URL と DOM (ytd-shorts) の両面から評価し、ログに出力。
   * @returns {boolean}
   */
  function isShortsPage() {
    const pathIsShorts = location.pathname.startsWith('/shorts/');
    const domHasShorts = !!document.querySelector('ytd-shorts, #shorts-player');
    const isShorts = pathIsShorts || domHasShorts;

    return isShorts;
  }

  // ── 制限判定・適用 ────────────────────────────────────────────────────────

  /**
   * 現在の動画 / Shorts をブロックすべきか判定する
   * 
   * - 通常動画 (/watch): state.isEnabled (制限オン) かつ ホワイトリスト未登録ならブロック
   * - Shorts (/shorts): state.blockShorts がオンの場合のみブロック
   * 
   * @returns {{ shouldBlock: boolean, reason: string }}
   */
  function evaluateBlockCondition() {
    const isWatch = isWatchPage();
    const isShorts = isShortsPage();
    const currentUrl = location.href;
    const currentListId = new URLSearchParams(location.search).get('list') ?? '';

    console.log('[YPL Page Log] Evaluating restriction:', {
      url: currentUrl,
      pathname: location.pathname,
      isWatch: isWatch,
      isShorts: isShorts,
      currentListId: currentListId,
      isEnabled: state.isEnabled,
      blockShorts: state.blockShorts,
    });

    // Shorts ページの場合
    if (isShorts) {
      if (state.blockShorts) {
        return { shouldBlock: true, reason: 'Shorts blocking is ENABLED' };
      } else {
        return { shouldBlock: false, reason: 'Shorts blocking is DISABLED' };
      }
    }

    // 通常動画ページ (/watch) の場合
    if (isWatch) {
      if (!state.isEnabled) {
        return { shouldBlock: false, reason: 'Watch restriction is DISABLED' };
      }

      if (state.playlistIds.length === 0) {
        return { shouldBlock: true, reason: 'Whitelist is empty' };
      }

      const isAllowed = state.playlistIds.includes(currentListId);
      if (isAllowed) {
        return { shouldBlock: false, reason: `Playlist ${currentListId} is WHITELISTED` };
      } else {
        return { shouldBlock: true, reason: `Playlist ${currentListId || '(None)'} is NOT in whitelist` };
      }
    }

    // その他のページ (YouTube トップ、検索結果など)
    return { shouldBlock: false, reason: 'Non-video page' };
  }

  /** 現在のページへ制限を適用または解除する */
  function applyRestriction() {
    const isWatch = isWatchPage();
    const isShorts = isShortsPage();

    const result = evaluateBlockCondition();

    console.log(`[YPL Page Log] Decision: [${result.shouldBlock ? 'BLOCK' : 'ALLOW'}] - Reason: ${result.reason}`);

    if (result.shouldBlock) {
      window.YPL_VideoController.start();
      window.YPL_Overlay.show(state.mode, isShorts);
    } else {
      window.YPL_Overlay.remove();
      window.YPL_VideoController.stop();
    }
  }

  // ── エントリポイント ──────────────────────────────────────────────────────

  init();
})();
