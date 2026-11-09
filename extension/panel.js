const $ = id => document.getElementById(id);
const store = chrome.storage.local;

let ws = null;
let myId = null;
let roomId = null;
let sharedTabs = [];
let users = [];
let sharedWindowId = null;
let sharedWindowPromise = null;
let syncingTabs = false;
let activeChromeTab = null;
const sharedChromeTabs = new Map();
const scrollPositions = new Map();

const safeUrl = value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const send = message => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
};

async function init() {
  const saved = await store.get(['name', 'server', 'room']);
  $('name').value = saved.name || '';
  $('server').value = saved.server || 'wss://shared-browser-realtime.onrender.com';
  $('room').value = new URLSearchParams(location.search).get('room') || saved.room || '';
}

function randomRoom() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function currentPanelTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureSharedWindow() {
  if (sharedWindowId !== null) {
    try {
      await chrome.windows.get(sharedWindowId);
      return sharedWindowId;
    } catch {
      sharedWindowId = null;
      sharedChromeTabs.clear();
    }
  }
  if (sharedWindowPromise) return sharedWindowPromise;

  sharedWindowPromise = (async () => {
    const win = await chrome.windows.create({ url: 'about:blank', type: 'normal', focused: true });
    sharedWindowId = win.id;
    return sharedWindowId;
  })();
  try {
    return await sharedWindowPromise;
  } finally {
    sharedWindowPromise = null;
  }
}

async function activeSharedTab() {
  if (sharedWindowId === null) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: sharedWindowId });
  return tab || null;
}

async function publishPresence() {
  if (!myId) return;
  const tab = await activeSharedTab();
  activeChromeTab = tab?.id ?? null;
  const url = safeUrl(tab?.url || '');
  if (!url) {
    send({ type: 'presence', url: '', title: 'No shareable page', scroll: 0 });
    return;
  }
  send({
    type: 'presence',
    url,
    title: tab.title || url,
    scroll: scrollPositions.get(tab.id) || 0
  });
}

async function syncSharedTabs() {
  if (sharedWindowId === null) return;
  try {
    await chrome.windows.get(sharedWindowId);
  } catch {
    sharedWindowId = null;
    sharedChromeTabs.clear();
    return;
  }

  syncingTabs = true;
  try {
    const openTabs = await chrome.tabs.query({ windowId: sharedWindowId });
    const usedTabIds = new Set();
    const nextMap = new Map();
    let firstOpenedTabId = null;

    for (const shared of sharedTabs) {
      let tab = null;
      const mappedId = sharedChromeTabs.get(shared.id);
      if (mappedId !== undefined) {
        tab = openTabs.find(candidate => candidate.id === mappedId);
      }
      if (!tab) {
        tab = openTabs.find(candidate => !usedTabIds.has(candidate.id) && candidate.url === shared.url);
      }
      if (!tab) {
        tab = await chrome.tabs.create({
          windowId: sharedWindowId,
          url: shared.url,
          active: openTabs.length === 1 && !safeUrl(openTabs[0]?.url || '')
        });
        if (firstOpenedTabId === null) firstOpenedTabId = tab.id;
      }
      usedTabIds.add(tab.id);
      nextMap.set(shared.id, tab.id);
    }

    if (sharedTabs.length) {
      const staleIds = openTabs
        .filter(tab => !usedTabIds.has(tab.id))
        .map(tab => tab.id);
      if (staleIds.length) await chrome.tabs.remove(staleIds);
      if (firstOpenedTabId !== null) await chrome.tabs.update(firstOpenedTabId, { active: true });
    } else {
      const placeholder = openTabs.find(tab => !safeUrl(tab.url || ''));
      if (!placeholder) await chrome.tabs.create({ windowId: sharedWindowId, url: 'about:blank' });
      const remove = openTabs.filter(tab => tab.id !== placeholder?.id).map(tab => tab.id);
      if (remove.length) await chrome.tabs.remove(remove);
    }

    sharedChromeTabs.clear();
    for (const [id, tabId] of nextMap) sharedChromeTabs.set(id, tabId);
  } catch (error) {
    $('status').textContent = `Shared window sync failed: ${error.message || error}`;
  } finally {
    syncingTabs = false;
    await publishPresence();
  }
}

async function focusSharedUrl(value, scroll = 0) {
  const url = safeUrl(value);
  if (!url) return;
  const windowId = await ensureSharedWindow();
  const knownSharedTab = sharedTabs.find(shared => shared.url === url);
  let tab = null;
  if (knownSharedTab) {
    await syncSharedTabs();
    const mappedId = sharedChromeTabs.get(knownSharedTab.id);
    const openTabs = await chrome.tabs.query({ windowId });
    tab = openTabs.find(candidate => candidate.id === mappedId);
  }
  if (!tab) {
    const openTabs = await chrome.tabs.query({ windowId });
    tab = openTabs.find(candidate => candidate.url === url);
  }
  if (!tab) {
    tab = await chrome.tabs.create({ windowId, url, active: true });
    if (!knownSharedTab) send({ type: 'addTab', url, title: tab.title || url });
  } else {
    await chrome.tabs.update(tab.id, { active: true });
  }
  await chrome.windows.update(windowId, { focused: true });
  activeChromeTab = tab.id;

  let attempts = 0;
  const deliverScroll = async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'jumpScroll', scroll });
    } catch {
      if (++attempts < 12) setTimeout(deliverScroll, 350);
    }
  };
  setTimeout(deliverScroll, tab.status === 'complete' ? 150 : 700);
}

function item(title, subtitle, action, initial, remove) {
  const outer = document.createElement('div');
  outer.className = 'item';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = initial;
  const main = document.createElement('div');
  main.className = 'main';
  const heading = document.createElement('div');
  heading.className = 'title';
  heading.textContent = title;
  const detail = document.createElement('div');
  detail.className = 'sub';
  detail.textContent = subtitle;
  main.append(heading, detail);
  main.addEventListener('click', action);
  outer.append(avatar, main);
  if (remove) {
    const button = document.createElement('button');
    button.className = 'remove';
    button.textContent = '×';
    button.title = 'Remove shared tab';
    button.onclick = remove;
    outer.append(button);
  }
  return outer;
}

function render() {
  const people = $('people');
  const tabs = $('tabs');
  people.replaceChildren();
  tabs.replaceChildren();
  $('count').textContent = `(${users.length})`;

  for (const user of users) {
    const label = `${user.name}${user.id === myId ? ' (you)' : ''}`;
    const subtitle = user.url
      ? `${user.title || user.url} · ${Math.round(user.scroll * 100)}% down`
      : 'No shareable page in shared window';
    people.append(item(
      label,
      subtitle,
      () => { if (user.id !== myId && user.url) focusSharedUrl(user.url, user.scroll); },
      (user.name || '?')[0].toUpperCase()
    ));
  }

  for (const tab of sharedTabs) {
    tabs.append(item(
      tab.title,
      tab.url,
      () => focusSharedUrl(tab.url),
      '↗',
      () => send({ type: 'removeTab', id: tab.id })
    ));
  }
  if (!sharedTabs.length) {
    const message = document.createElement('p');
    message.className = 'hint';
    message.textContent = 'No shared tabs yet. Share a page to add it to the dedicated window.';
    tabs.append(message);
  }
}

async function connect() {
  const name = $('name').value.trim() || 'Guest';
  const server = $('server').value.trim();
  const id = $('room').value.trim() || randomRoom();
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(id)) {
    alert('Room ID must be at least 6 letters, numbers, _ or -');
    return;
  }
  if (!/^wss?:\/\//.test(server)) {
    alert('Enter a ws:// or wss:// server URL');
    return;
  }

  await store.set({ name, server, room: id });
  roomId = id;
  $('room').value = id;
  $('roomLabel').textContent = `Room: ${id}`;
  $('setup').hidden = true;
  $('workspace').hidden = false;
  $('status').textContent = 'Opening your shared window…';

  try {
    await ensureSharedWindow();
    ws = new WebSocket(server);
    $('status').textContent = 'Connecting…';
    ws.onopen = () => send({ type: 'join', room: id, name });
    ws.onmessage = async event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'joined') {
        myId = message.userId;
        $('status').textContent = 'Connected · shared tabs are in the separate window';
        await syncSharedTabs();
      }
      if (message.type === 'state') {
        sharedTabs = message.tabs || [];
        users = message.users || [];
        render();
        await syncSharedTabs();
      }
      if (message.type === 'error') $('status').textContent = message.message;
    };
    ws.onclose = () => {
      $('status').textContent = 'Disconnected — leave and rejoin to reconnect';
      myId = null;
    };
    ws.onerror = () => { $('status').textContent = 'Connection failed. Check server address.'; };
  } catch (error) {
    $('status').textContent = `Could not open shared window: ${error.message || error}`;
  }
}

$('join').onclick = connect;
$('share').onclick = async () => {
  const tab = await currentPanelTab();
  const url = safeUrl(tab?.url || '');
  if (!url) {
    alert('This page cannot be shared');
    return;
  }
  if (sharedTabs.some(shared => shared.url === url)) {
    await focusSharedUrl(url);
    return;
  }
  send({ type: 'addTab', url, title: tab.title || url });
};
$('refresh').onclick = publishPresence;
$('openWindow').onclick = async () => {
  await ensureSharedWindow();
  await syncSharedTabs();
  if (sharedWindowId !== null) await chrome.windows.update(sharedWindowId, { focused: true });
};
$('copy').onclick = async () => {
  const server = $('server').value.trim();
  const invite = `Shared Browser room: ${roomId}\nServer: ${server}\nInstall the extension, enter this server and room ID, then join.`;
  await navigator.clipboard.writeText(invite);
  $('copy').textContent = 'Copied!';
  setTimeout(() => { $('copy').textContent = 'Copy invite'; }, 1500);
};
$('leave').onclick = async () => {
  const oldWindowId = sharedWindowId;
  ws?.close();
  ws = null;
  myId = null;
  roomId = null;
  users = [];
  sharedTabs = [];
  sharedChromeTabs.clear();
  sharedWindowId = null;
  $('setup').hidden = false;
  $('workspace').hidden = true;
  if (oldWindowId !== null) {
    try { await chrome.windows.remove(oldWindowId); } catch { /* It may already be closed. */ }
  }
};

chrome.tabs.onActivated.addListener(info => {
  if (info.windowId === sharedWindowId) publishPresence();
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.windowId === sharedWindowId && (info.url || info.status === 'complete')) publishPresence();
});
chrome.tabs.onRemoved.addListener(tabId => {
  if (syncingTabs) return;
  for (const [sharedId, mappedTabId] of sharedChromeTabs) {
    if (mappedTabId === tabId) {
      sharedChromeTabs.delete(sharedId);
      send({ type: 'removeTab', id: sharedId });
      break;
    }
  }
});
chrome.windows.onRemoved.addListener(windowId => {
  if (windowId === sharedWindowId) {
    sharedWindowId = null;
    sharedChromeTabs.clear();
    activeChromeTab = null;
    publishPresence();
  }
});

chrome.runtime.connect({ name: 'panel' }).onMessage.addListener(message => {
  if (message.type === 'scroll' && message.tabId === activeChromeTab) {
    scrollPositions.set(message.tabId, message.scroll);
    publishPresence();
  }
});

setInterval(() => { if (myId) publishPresence(); }, 2500);
init();
