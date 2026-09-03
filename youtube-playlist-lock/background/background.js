/**
 * background/background.js
 * Service Worker — ナビゲーション検知・バッジ管理
 *
 * ナビゲーション検知に webNavigation API を使用する理由:
 *   - Service Worker はページの DOM にアクセスできないため、
 *     YouTube 内部イベント (yt-navigate-finish) を直接購読できない。
 *   - webNavigation.onHistoryStateUpdated は YouTube が history.pushState /
 *     replaceState を呼んだ瞬間に background 側で確実に捕捉できる。
 *   - DOM 操作が不要なバッジ更新にはこちらが適している。
 *   - DOM が必要な動画ブロック処理は content script 側で
 *     yt-navigate-finish を使って行う（content.js 参照）。
 *
 * Source - https://stackoverflow.com/a/17584657
 * Posted by philoye
 * Retrieved 2026-08-28, License - CC BY-SA 3.0
 */

// config.js をグローバルスコープへ読み込む（importScripts は非モード SW のみ使用可）
importScripts('../config.js');

const { STORAGE_KEYS, DEFAULTS } = YPL;

// ── ナビゲーション検知 ────────────────────────────────────────────────────────

/** YouTube SPA の pushState / replaceState を検知してバッジを更新する */
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => updateBadge(details.tabId),
  { url: [{ hostEquals: 'www.youtube.com' }] }
);

/** 通常のページ遷移（リロード・初回表示）でもバッジを更新する */
chrome.webNavigation.onCompleted.addListener(
  (details) => updateBadge(details.tabId),
  { url: [{ hostEquals: 'www.youtube.com' }] }
);

// ── ストレージ変更監視 ────────────────────────────────────────────────────────

/**
 * popup からストレージが更新されたとき、
 * 開いているすべての YouTube タブのバッジを再描画する。
 */
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== 'sync') return;
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    tabs.forEach((tab) => updateBadge(tab.id));
  });
});

// ── バッジ更新 ────────────────────────────────────────────────────────────────

/**
 * タブの isEnabled 状態に応じてアクションバッジを更新する。
 * @param {number} tabId
 */
async function updateBadge(tabId) {
  const data      = await chrome.storage.sync.get(STORAGE_KEYS.IS_ENABLED);
  const isEnabled = data[STORAGE_KEYS.IS_ENABLED] ?? DEFAULTS.IS_ENABLED;

  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#e53935', tabId });
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}
