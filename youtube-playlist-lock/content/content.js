/**
 * content/content.js
 * コンテンツスクリプト — 動画ブロック処理
 *
 * ナビゲーション検知に yt-navigate-finish を使用する理由:
 *   - webNavigation.onHistoryStateUpdated は URL 変更と同時に発火するが、
 *     その時点では YouTube がまだ新しいページの DOM を構築していない。
 *   - yt-navigate-finish は YouTube 内部フレームワークが DOM 更新・
 *     動画要素の挿入を完了した後に document へ発火する。
 *   - 動画要素 (<video>) を確実に操作するにはこちらが適している。
 *   - background 側のバッジ更新は webNavigation を使用（background.js 参照）。
 *
 * config.js が manifest.json により先に挿入されていることを前提とする。
 */

(function () {
  'use strict';

  const {
    STORAGE_KEYS, DEFAULTS, LIST_MODE, MSG_TYPES,
    YOUTUBE, OVERLAY, PAUSE_INTERVAL_MS, BLOCK_MESSAGE,
  } = YPL;

  // ── 状態 ──────────────────────────────────────────────────────────────────

  /** @type {{ isEnabled: boolean, playlistIds: string[], mode: string }} */
  let state = {
    isEnabled   : DEFAULTS.IS_ENABLED,
    playlistIds : [...DEFAULTS.PLAYLIST_IDS],
    mode        : DEFAULTS.MODE,
  };

  /** @type {number|null} 一時停止インターバルの ID */
  let pauseIntervalId = null;

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

  /**
   * YouTube SPA のナビゲーション完了後に制限を再評価する。
   * yt-navigate-finish は DOM 更新完了後に発火するため、
   * この時点で動画要素が存在することが保証される。
   */
  function listenNavigation() {
    document.addEventListener(YOUTUBE.NAVIGATE_EVENT, () => {
      // 新しいページに遷移したのでオーバーレイ・インターバルをリセットしてから再評価
      removeOverlay();
      stopPauseLoop();
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

  // ── 制限ロジック ──────────────────────────────────────────────────────────

  /**
   * 現在のページへ制限を適用または解除する。
   * watch ページ以外では何もしない。
   */
  function applyRestriction() {
    if (!isWatchPage()) {
      removeOverlay();
      stopPauseLoop();
      return;
    }

    if (!state.isEnabled) {
      removeOverlay();
      stopPauseLoop();
      return;
    }

    if (shouldBlock()) {
      startPauseLoop();
      showOverlay();
    } else {
      removeOverlay();
      stopPauseLoop();
    }
  }

  /**
   * 現在のページが動画視聴ページか判定する。
   * @returns {boolean}
   */
  function isWatchPage() {
    return location.pathname === '/watch';
  }

  /**
   * 現在の動画をブロックすべきか判定する。
   *
   * whitelist モード（現在実装）:
   *   保存リストに含まれない → ブロック
   *   リストが空の場合は安全側（すべてブロック）
   *
   * blacklist モード（将来実装予定）:
   *   保存リストに含まれる → ブロック
   *
   * @returns {boolean}
   */
  function shouldBlock() {
    const currentListId = new URLSearchParams(location.search).get('list') ?? '';

    switch (state.mode) {
      case LIST_MODE.WHITELIST:
        if (state.playlistIds.length === 0) return true;
        return !state.playlistIds.includes(currentListId);

      case LIST_MODE.BLACKLIST:
        // 将来実装: リストに含まれていたらブロック
        return state.playlistIds.includes(currentListId);

      default:
        return false;
    }
  }

  // ── 動画制御 ──────────────────────────────────────────────────────────────

  /**
   * 動画が再生されないよう定期的に pause() する。
   * YouTube は autoplay やシーク後に再生を再開するため、インターバルで抑制する。
   */
  function startPauseLoop() {
    if (pauseIntervalId !== null) return;
    pauseIntervalId = setInterval(() => {
      const video = document.querySelector(YOUTUBE.VIDEO_SELECTOR);
      if (video && !video.paused) {
        video.pause();
      }
    }, PAUSE_INTERVAL_MS);
  }

  /** 一時停止ループを停止する */
  function stopPauseLoop() {
    if (pauseIntervalId === null) return;
    clearInterval(pauseIntervalId);
    pauseIntervalId = null;
  }

  // ── オーバーレイ ──────────────────────────────────────────────────────────

  /**
   * ブロックオーバーレイを動画プレイヤー上に表示する。
   * プレイヤーがまだ DOM にない場合は再試行する。
   */
  function showOverlay() {
    if (document.getElementById(OVERLAY.ELEMENT_ID)) return;

    const player = document.querySelector(YOUTUBE.PLAYER_SELECTOR);
    if (!player) {
      setTimeout(showOverlay, 500);
      return;
    }

    const subtitle =
      state.mode === LIST_MODE.BLACKLIST
        ? BLOCK_MESSAGE.SUBTITLE_BLACKLIST
        : BLOCK_MESSAGE.SUBTITLE_WHITELIST;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY.ELEMENT_ID;

    Object.assign(overlay.style, {
      position        : 'absolute',
      inset           : '0',
      zIndex          : OVERLAY.Z_INDEX,
      display         : 'flex',
      flexDirection   : 'column',
      alignItems      : 'center',
      justifyContent  : 'center',
      backgroundColor : OVERLAY.BG_COLOR,
      color           : OVERLAY.TEXT_COLOR,
      fontFamily      : '"YouTube Noto", Roboto, Arial, sans-serif',
      gap             : '12px',
      pointerEvents   : 'none',
      userSelect      : 'none',
    });

    overlay.innerHTML = `
      <div style="font-size:52px;line-height:1">${BLOCK_MESSAGE.ICON}</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${BLOCK_MESSAGE.TITLE}</div>
      <div style="font-size:14px;opacity:0.65">${subtitle}</div>
    `;

    // #movie_player は position:relative を持つのでそのまま使用できる
    player.style.position = 'relative';
    player.appendChild(overlay);
  }

  /** ブロックオーバーレイを削除する */
  function removeOverlay() {
    document.getElementById(OVERLAY.ELEMENT_ID)?.remove();
  }

  // ── エントリポイント ──────────────────────────────────────────────────────

  init();
})();
