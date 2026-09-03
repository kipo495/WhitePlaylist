/**
 * utils/playlist.js
 * プレイリスト ID 解析および oEmbed タイトル取得モジュール
 */

(function () {
  'use strict';

  /**
   * 与えられた文字列（URLまたはID文字列）から YouTube プレイリスト ID (list=) を抽出する
   * @param {string} input
   * @returns {string|null} 抽出されたプレイリスト ID、無効な場合は null
   */
  function parsePlaylistId(input) {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();
    if (!trimmed) return null;

    // URL形式の場合
    if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        const listParam = url.searchParams.get('list');
        if (listParam) return listParam.trim();
      } catch (e) {
        // URL パースエラー
      }
    }

    // クエリ文字列直接（例: list=PL...）の場合
    if (trimmed.startsWith('list=')) {
      return trimmed.replace(/^list=/, '').split('&')[0].trim();
    }

    // 英数字・ハイフン・アンダースコアで構成されるプレイリストIDパターン (PL..., RD..., etc.)
    if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  /**
   * YouTube oEmbed API を用いて再生リストのタイトルを取得する。
   * HTML パースは行わず、失敗した場合は '***' を返します。
   * 
   * @param {string} playlistId
   * @returns {Promise<string>} 取得されたタイトル、失敗時は '***'
   */
  async function fetchPlaylistTitle(playlistId) {
    if (!playlistId) return '***';

    console.log(`[YPL Log] Fetching title via oEmbed for playlist ID: ${playlistId}`);

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&format=json`;

    try {
      const res = await fetch(oembedUrl);
      console.log(`[YPL Log] oEmbed Response Status: ${res.status} ${res.statusText}`);

      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          console.log(`[YPL Log] oEmbed Success! Title: "${data.title}"`);
          return data.title.trim();
        }
      } else {
        console.warn(`[YPL Log] oEmbed failed with status ${res.status}`);
      }
    } catch (err) {
      console.error(`[YPL Log] oEmbed Fetch Exception:`, err);
    }

    console.warn(`[YPL Log] Fetch failed for ${playlistId}. Returning '***'`);
    return '***';
  }

  // グローバル YPL 名前空間へ登録
  window.YPL_Playlist = Object.freeze({
    parsePlaylistId,
    fetchPlaylistTitle,
  });
})();
