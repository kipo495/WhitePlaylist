/**
 * utils/import_export_lists.js
 * プレイリスト ID の JSON 入出力ユーティリティ
 */

(function () {
  'use strict';

  const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

  /**
   * プレイリスト ID 配列を JSON ファイルとして保存する。
   * @param {string[]} playlistIds
   * @returns {Promise<void>}
   */
  function exportLists(playlistIds) {
    const dataStr = JSON.stringify(playlistIds, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: blobUrl,
        filename: 'youtube-playlists.json',
        saveAs: true,
      }, (downloadId) => {
        const error = chrome.runtime.lastError;
        URL.revokeObjectURL(blobUrl);

        if (error) {
          reject(new Error(error.message));
          return;
        }

        console.log(`[YPL Log] Playlist export started: ${downloadId}`);
        resolve();
      });
    });
  }

  /**
   * JSON ファイルからプレイリスト ID 配列を読み込む。
   * @param {File} file
   * @returns {Promise<string[]>}
   */
  function importLists(file) {
    if (!(file instanceof File)) {
      return Promise.reject(new Error('JSON ファイルを選択してください'));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!Array.isArray(parsed)) {
            throw new Error('JSON の形式が正しくありません');
          }

          const playlistIds = [...new Set(parsed)];
          if (
            playlistIds.length !== parsed.length
            || playlistIds.some((id) => typeof id !== 'string' || !PLAYLIST_ID_PATTERN.test(id))
          ) {
            throw new Error('プレイリスト ID が正しくありません');
          }

          resolve(playlistIds);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('JSON の読み込みに失敗しました'));
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file);
    });
  }

  window.YPL_ImportExport = Object.freeze({
    importLists,
    exportLists,
  });
})();
