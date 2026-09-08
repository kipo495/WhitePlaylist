/**
 * popup/popup.js
 * ポップアップの UI ロジック
 */

(function () {
  'use strict';

  const { STORAGE_KEYS, DEFAULTS, MSG_TYPES } = YPL;

  // ── DOM 要素の参照 ────────────────────────────────────────────────────────

  /** @type {Record<string, HTMLElement>} */
  const el = Object.freeze({
    toggle: document.getElementById('btn-toggle'),
    toggleShorts: document.getElementById('btn-toggle-shorts'),
    btnCurrentPage: document.getElementById('btn-current-page'),
    inputId: document.getElementById('input-id'),
    btnAdd: document.getElementById('btn-add'),
    listContainer: document.getElementById('list-container'),
    emptyMessage: document.getElementById('empty-message'),
    status: document.getElementById('status-message'),
  });

  // ── 状態 ──────────────────────────────────────────────────────────────────

  /** @type {{ isEnabled: boolean, blockShorts: boolean, playlists: Array<{id: string, title: string, addedAt: number}>, mode: string }} */
  let state = {
    isEnabled: DEFAULTS.IS_ENABLED,
    blockShorts: DEFAULTS.BLOCK_SHORTS,
    playlists: [],
    mode: DEFAULTS.MODE,
  };

  // ── 初期化 ────────────────────────────────────────────────────────────────

  async function init() {
    await loadState();
    renderAll();
    bindEvents();

    // 未取得（*** または IDと同値）のタイトルをバックグラウンドで自動再フェッチ
    autoRefetchMissingTitles();
  }

  /** マイグレーションモジュールを実行し、最新形式で状態を読み込む */
  async function loadState() {
    const playlists = await window.YPL_Migration.migratePlaylistData();

    const data = await chrome.storage.sync.get([
      STORAGE_KEYS.IS_ENABLED,
      STORAGE_KEYS.BLOCK_SHORTS,
      STORAGE_KEYS.MODE,
    ]);

    state.isEnabled = data[STORAGE_KEYS.IS_ENABLED] ?? DEFAULTS.IS_ENABLED;
    state.blockShorts = data[STORAGE_KEYS.BLOCK_SHORTS] ?? DEFAULTS.BLOCK_SHORTS;
    state.playlists = playlists;
    state.mode = data[STORAGE_KEYS.MODE] ?? DEFAULTS.MODE;

    el.toggle.disabled = false;
    if (el.toggleShorts) el.toggleShorts.disabled = false;
  }

  // ── 自動再フェッチ ────────────────────────────────────────────────────────

  async function autoRefetchMissingTitles() {
    const pendingItems = state.playlists.filter(
      (p) => !p.title || p.title === '***' || p.title === p.id
    );

    if (pendingItems.length === 0) return;

    let updated = false;

    for (const item of pendingItems) {
      try {
        const fetchedTitle = await window.YPL_Playlist.fetchPlaylistTitle(item.id);
        if (fetchedTitle && fetchedTitle !== '***') {
          item.title = fetchedTitle;
          updated = true;
        }
      } catch (e) {
        console.warn(`[YPL Log] Auto-refetch failed for ${item.id}:`, e);
      }
    }

    if (updated) {
      renderList();
      await saveState();
      console.log('[YPL Log] Auto-refetch updated missing titles.');
    }
  }

  // ── ストレージ保存・通知 ──────────────────────────────────────────────────

  async function saveState() {
    const playlistIds = state.playlists.map((p) => p.id);

    await chrome.storage.sync.set({
      [STORAGE_KEYS.IS_ENABLED]: state.isEnabled,
      [STORAGE_KEYS.BLOCK_SHORTS]: state.blockShorts,
      [STORAGE_KEYS.PLAYLISTS]: state.playlists,
      [STORAGE_KEYS.PLAYLIST_IDS]: playlistIds,
      [STORAGE_KEYS.MODE]: state.mode,
    });

    await notifyActiveTab();
  }

  async function notifyActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const playlistIds = state.playlists.map((p) => p.id);

    chrome.tabs.sendMessage(tab.id, {
      type: MSG_TYPES.STATE_CHANGED,
      payload: {
        isEnabled: state.isEnabled,
        blockShorts: state.blockShorts,
        playlistIds: playlistIds,
        mode: state.mode,
      },
    }).catch(() => { });
  }

  // ── イベントバインド ──────────────────────────────────────────────────────

  function bindEvents() {
    el.toggle.addEventListener('click', onToggleClick);
    if (el.toggleShorts) el.toggleShorts.addEventListener('click', onToggleShortsClick);
    el.btnCurrentPage.addEventListener('click', onCurrentPageClick);
    el.btnAdd.addEventListener('click', onAddClick);
    el.inputId.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAddClick();
    });
  }

  /** 通常動画の制限トグルボタン押下 */
  async function onToggleClick() {
    state.isEnabled = !state.isEnabled;
    renderToggle();
    await saveState();
    showStatus(
      state.isEnabled ? '🔒 制限を有効にしました' : '🔓 制限を解除しました',
      'success'
    );
  }

  /** Shorts ブロックのトグルボタン押下 */
  async function onToggleShortsClick() {
    state.blockShorts = !state.blockShorts;
    renderToggleShorts();
    await saveState();
    showStatus(
      state.blockShorts ? '📱 Shorts をブロック対象に設定しました' : '📱 Shorts を許可設定にしました',
      'success'
    );
  }

  /** 「📍 (現在地を取得)」ボタン押下 */
  async function onCurrentPageClick() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showStatus('タブの URL を取得できませんでした', 'error');
      return;
    }

    const listId = window.YPL_Playlist.parsePlaylistId(tab.url);
    if (!listId) {
      showStatus('このページには再生リスト (list=) がありません', 'error');
      return;
    }

    el.inputId.value = tab.url;
    showStatus('現在のページの URL をセットしました ✓', 'success');
  }

  /** 「＋ 追加」ボタン押下 */
  async function onAddClick() {
    const inputValue = el.inputId.value.trim();
    if (!inputValue) {
      showStatus('URL または ID を入力してください', 'error');
      return;
    }

    const listId = window.YPL_Playlist.parsePlaylistId(inputValue);
    if (!listId) {
      showStatus('無効な URL / ID です', 'error');
      return;
    }

    if (state.playlists.some((p) => p.id === listId)) {
      showStatus('このリストはすでに保存されています', '');
      return;
    }

    const newItem = {
      id: listId,
      title: '***',
      addedAt: Date.now(),
    };

    state.playlists = [...state.playlists, newItem];
    renderList();
    el.inputId.value = '';
    showStatus('タイトルを取得中...', '');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let fetchedTitle = null;

      if (tab?.url && tab.url.includes(listId) && tab.title) {
        const cleaned = tab.title.replace(/\s*-\s*YouTube$/i, '').trim();
        if (cleaned && cleaned !== 'YouTube') {
          fetchedTitle = cleaned;
        }
      }

      if (!fetchedTitle) {
        fetchedTitle = await window.YPL_Playlist.fetchPlaylistTitle(listId);
      }

      const index = state.playlists.findIndex((p) => p.id === listId);
      if (index !== -1) {
        state.playlists[index].title = fetchedTitle || '***';
        renderList();
      }

      if (fetchedTitle && fetchedTitle !== '***') {
        showStatus('保存しました ✓', 'success');
      } else {
        showStatus('タイトルを取得できませんでした (***)', 'error');
      }
    } catch (e) {
      console.error('[YPL Log] Exception during add:', e);
      showStatus(`エラー: ${e.message || e}`, 'error');
    }

    await saveState();
  }

  async function onRefetchClick(listId) {
    const item = state.playlists.find((p) => p.id === listId);
    if (!item) return;

    showStatus('再取得中...', '');

    try {
      const fetchedTitle = await window.YPL_Playlist.fetchPlaylistTitle(listId);
      item.title = fetchedTitle || '***';
      renderList();
      await saveState();

      if (fetchedTitle && fetchedTitle !== '***') {
        showStatus('タイトルを更新しました ✓', 'success');
      } else {
        showStatus('タイトルを再取得できませんでした (***)', 'error');
      }
    } catch (e) {
      showStatus('再取得エラー', 'error');
    }
  }

  async function onDeleteClick(listId) {
    state.playlists = state.playlists.filter((p) => p.id !== listId);
    renderList();
    await saveState();
    showStatus('削除しました', 'success');
  }

  function showStatus(message, type) {
    el.status.textContent = message;
    el.status.className = `status${type ? ` ${type}` : ''}`;
    setTimeout(() => {
      el.status.textContent = '';
      el.status.className = 'status';
    }, 2500);
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  function renderAll() {
    renderToggle();
    renderToggleShorts();
    renderList();
  }

  function renderToggle() {
    el.toggle.textContent = state.isEnabled
      ? '🔒 動画ブロック: 有効'
      : '🔓 動画ブロック: 無効';
    el.toggle.classList.toggle('is-enabled', state.isEnabled);
  }

  function renderToggleShorts() {
    if (!el.toggleShorts) return;
    el.toggleShorts.textContent = state.blockShorts
      ? '📱 Shortsブロック: 有効'
      : '📱 Shortsブロック: 無効';
    el.toggleShorts.classList.toggle('is-enabled', state.blockShorts);
  }

  function renderList() {
    el.listContainer
      .querySelectorAll('.playlist-item')
      .forEach((item) => item.remove());

    const isEmpty = state.playlists.length === 0;
    el.emptyMessage.style.display = isEmpty ? '' : 'none';

    state.playlists.forEach((item) => {
      el.listContainer.appendChild(createListItem(item));
    });
  }

  function createListItem(itemData) {
    const item = document.createElement('div');
    item.className = 'playlist-item';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'playlist-item__info';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'playlist-item__title';
    titleSpan.textContent = itemData.title || '***';
    titleSpan.title = itemData.title || '***';

    const idSpan = document.createElement('span');
    idSpan.className = 'playlist-item__id';
    idSpan.textContent = itemData.id;
    idSpan.title = itemData.id;

    infoDiv.appendChild(titleSpan);
    infoDiv.appendChild(idSpan);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'playlist-item__actions';

    const refetchBtn = document.createElement('button');
    refetchBtn.className = 'playlist-item__refetch';
    refetchBtn.textContent = '↻';
    refetchBtn.title = 'タイトルを再取得';
    refetchBtn.setAttribute('aria-label', `${itemData.id} のタイトルを再取得`);
    refetchBtn.addEventListener('click', () => onRefetchClick(itemData.id));

    const openBtn = document.createElement('button');
    openBtn.className = 'playlist-item__open';
    openBtn.textContent = '↗';
    openBtn.title = 'YouTube で開く';
    openBtn.setAttribute('aria-label', `${itemData.title} を YouTube で開く`);
    openBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: `https://www.youtube.com/playlist?list=${itemData.id}`,
      });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'playlist-item__delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = '削除';
    deleteBtn.setAttribute('aria-label', `${itemData.title} を削除`);
    deleteBtn.addEventListener('click', () => onDeleteClick(itemData.id));

    actionsDiv.appendChild(refetchBtn);
    actionsDiv.appendChild(openBtn);
    actionsDiv.appendChild(deleteBtn);

    item.appendChild(infoDiv);
    item.appendChild(actionsDiv);
    return item;
  }

  // ── エントリポイント ──────────────────────────────────────────────────────

  init();
})();
