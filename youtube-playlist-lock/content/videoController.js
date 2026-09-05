/**
 * content/videoController.js
 * 動画の一時停止制御および「すり抜け」防止、ログ記録を行うモジュール
 */

(function () {
  'use strict';

  const { YOUTUBE, PAUSE_INTERVAL_MS } = YPL;

  /** @type {number|null} 定期ループの ID */
  let intervalId = null;

  /** @type {boolean} 現在制御がアクティブかどうか */
  let isActive = false;

  /** @type {MutationObserver|null} 新規 video 要素監視用 Observer */
  let observer = null;

  /**
   * ページ内の全 <video> 要素を検索して取得する
   * @returns {HTMLVideoElement[]}
   */
  function getAllVideos() {
    const selectorString = YOUTUBE.VIDEO_SELECTORS.join(', ');
    const nodeList = document.querySelectorAll(selectorString);
    return Array.from(nodeList);
  }

  /**
   * 単一の video 要素を強制ポーズし、ログを出力する
   * @param {HTMLVideoElement} video
   * @param {string} source - 制御を起動したソース (例: 'Loop', 'PlayEvent')
   */
  function pauseSingleVideo(video, source) {
    if (!video || video.paused) return;

    try {
      video.pause();
      // 音量も 0 にミュート（万が一の音声すり抜けガード）
      video.muted = true;

      console.log(
        `[YPL Pause Log] Executed pause (${source}) on video element:`,
        {
          src      : video.currentSrc || video.src || 'blob/stream',
          currentTime: video.currentTime,
          paused   : video.paused,
          time     : new Date().toLocaleTimeString(),
        }
      );
    } catch (err) {
      console.warn(`[YPL Pause Log] Failed to pause video:`, err);
    }
  }

  /**
   * ページ内の全再生中動画を一時停止する
   * @param {string} source
   */
  function pauseAll(source = 'Interval') {
    if (!isActive) return;

    const videos = getAllVideos();
    let pausedCount = 0;

    videos.forEach((video) => {
      if (!video.paused) {
        pauseSingleVideo(video, source);
        pausedCount++;
      }
    });

    if (pausedCount > 0) {
      console.log(`[YPL Pause Log] Total ${pausedCount} video(s) paused via [${source}]`);
    }
  }

  /**
   * 動画の 'play' / 'playing' イベントに直接フックして再生開始を阻止
   * @param {Event} e
   */
  function onPlayAttempt(e) {
    if (!isActive) return;
    const video = e.target;
    if (video && video instanceof HTMLVideoElement) {
      pauseSingleVideo(video, 'EventHook');
    }
  }

  /**
   * 既存および新規の <video> 要素にイベントフックをアタッチ
   */
  function attachEventHooks() {
    const videos = getAllVideos();
    videos.forEach((video) => {
      video.removeEventListener('play', onPlayAttempt, true);
      video.removeEventListener('playing', onPlayAttempt, true);
      video.addEventListener('play', onPlayAttempt, true);
      video.addEventListener('playing', onPlayAttempt, true);
    });
  }

  /**
   * MutationObserver を使用して動的に作成された <video> にもフックを自動適用
   */
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (isActive) {
        attachEventHooks();
        pauseAll('Mutation');
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList : true,
      subtree   : true,
    });
  }

  /**
   * 動画の一時停止制御を開始する
   */
  function start() {
    if (isActive) return;
    isActive = true;

    console.log('[YPL Pause Log] Video controller START');

    attachEventHooks();
    startObserver();
    pauseAll('Init');

    if (intervalId === null) {
      intervalId = setInterval(() => {
        pauseAll('Loop');
      }, PAUSE_INTERVAL_MS);
    }
  }

  /**
   * 動画の一時停止制御を停止（解除）する
   */
  function stop() {
    if (!isActive) return;
    isActive = false;

    console.log('[YPL Pause Log] Video controller STOP');

    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // グローバル YPL 名前空間へ登録
  window.YPL_VideoController = Object.freeze({
    start,
    stop,
    pauseAll,
  });
})();
