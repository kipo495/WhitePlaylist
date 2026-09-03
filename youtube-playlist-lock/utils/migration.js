/**
 * utils/migration.js
 * データマイグレーション処理の独立モジュール
 *
 * 以前のバージョンで保存された `playlistIds` (string[]) 形式のデータを、
 * 新しい `playlists` ({ id: string, title: string, addedAt: number }[]) 形式へ安全に変換します。
 */

(function () {
  'use strict';

  /**
   * ストレージ内のプレイリストデータを最新の形式へマイグレーションする。
   * @returns {Promise<Array<{id: string, title: string, addedAt: number}>>} 最新化された playlists 配列
   */
  async function migratePlaylistData() {
    const { STORAGE_KEYS, DEFAULTS } = YPL;

    const data = await chrome.storage.sync.get([
      STORAGE_KEYS.PLAYLISTS,
      STORAGE_KEYS.PLAYLIST_IDS,
    ]);

    let rawPlaylists = data[STORAGE_KEYS.PLAYLISTS];
    const rawIds = data[STORAGE_KEYS.PLAYLIST_IDS] || [];

    // すでに新形式 playlists が存在し、配列であればそのまま利用（未設定の title は id で補填）
    if (Array.isArray(rawPlaylists) && rawPlaylists.length > 0) {
      const normalized = rawPlaylists.map((item) => {
        if (typeof item === 'string') {
          return { id: item, title: item, addedAt: Date.now() };
        }
        return {
          id: item.id,
          title: item.title || item.id,
          addedAt: item.addedAt || Date.now(),
        };
      });

      // 後方互換のため playlistIds にも ID の一覧を同期
      const ids = normalized.map((p) => p.id);
      await chrome.storage.sync.set({
        [STORAGE_KEYS.PLAYLISTS]: normalized,
        [STORAGE_KEYS.PLAYLIST_IDS]: ids,
      });

      return normalized;
    }

    // 新形式が存在せず、旧形式 rawIds (string[]) が存在する場合はマイグレーション実行
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      const migrated = rawIds.map((id) => ({
        id: id,
        title: id, // 初期表示用。タイトル非同期取得で更新可能
        addedAt: Date.now(),
      }));

      await chrome.storage.sync.set({
        [STORAGE_KEYS.PLAYLISTS]: migrated,
        [STORAGE_KEYS.PLAYLIST_IDS]: rawIds,
      });

      return migrated;
    }

    // どちらもデータが無い場合はデフォルト値をセット
    return DEFAULTS.PLAYLISTS;
  }

  // グローバル YPL 名前空間へ登録
  window.YPL_Migration = Object.freeze({
    migratePlaylistData,
  });
})();
