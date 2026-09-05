/**
 * content/overlay.js
 * ブロック画面（オーバーレイ）の生成・表示・削除を専門に管理するモジュール
 */

(function () {
  'use strict';

  const { OVERLAY, BLOCK_MESSAGE, YOUTUBE, LIST_MODE } = YPL;

  /**
   * 現在のページ種別に応じた適切なプレイヤーコンテナ要素を探索・取得する
   * @param {boolean} isShorts
   * @returns {HTMLElement|null}
   */
  function findContainer(isShorts) {
    const selectorList = isShorts
      ? YOUTUBE.CONTAINER_SELECTORS.SHORTS
      : YOUTUBE.CONTAINER_SELECTORS.WATCH;

    for (const selector of selectorList) {
      const container = document.querySelector(selector);
      if (container) {
        return container;
      }
    }

    // フォールバック: 全体的なプレイヤー要素または body
    return document.querySelector('#movie_player') || document.body;
  }

  /**
   * オーバーレイを表示する
   * @param {string} mode - 'whitelist' | 'blacklist'
   * @param {boolean} isShorts
   */
  function show(mode, isShorts) {
    if (document.getElementById(OVERLAY.ELEMENT_ID)) return;

    const container = findContainer(isShorts);
    if (!container) {
      setTimeout(() => show(mode, isShorts), 300);
      return;
    }

    const subtitle =
      mode === LIST_MODE.BLACKLIST
        ? BLOCK_MESSAGE.SUBTITLE_BLACKLIST
        : BLOCK_MESSAGE.SUBTITLE_WHITELIST;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY.ELEMENT_ID;

    Object.assign(overlay.style, {
      position        : 'absolute',
      inset           : '0',
      width           : '100%',
      height          : '100%',
      zIndex          : OVERLAY.Z_INDEX,
      display         : 'flex',
      flexDirection   : 'column',
      alignItems      : 'center',
      justifyContent  : 'center',
      backgroundColor : OVERLAY.BG_COLOR,
      color           : OVERLAY.TEXT_COLOR,
      fontFamily      : '"YouTube Noto", Roboto, Arial, sans-serif',
      gap             : '12px',
      pointerEvents   : 'auto', // クリック等の背景への貫通をガード
      userSelect      : 'none',
    });

    overlay.innerHTML = `
      <div style="font-size:52px;line-height:1">${BLOCK_MESSAGE.ICON}</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;text-align:center">${BLOCK_MESSAGE.TITLE}</div>
      <div style="font-size:14px;opacity:0.75;text-align:center">${subtitle}</div>
    `;

    // コンテナが relative/absolute でない場合に備えて relative 設定
    const computedPosition = window.getComputedStyle(container).position;
    if (computedPosition === 'static') {
      container.style.position = 'relative';
    }

    container.appendChild(overlay);
  }

  /**
   * オーバーレイを削除する
   */
  function remove() {
    const el = document.getElementById(OVERLAY.ELEMENT_ID);
    if (el) {
      el.remove();
    }
  }

  // グローバル YPL 名前空間へ登録
  window.YPL_Overlay = Object.freeze({
    show,
    remove,
  });
})();
