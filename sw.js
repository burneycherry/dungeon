// ================================================================
//  Dungeon Chronicles RPG — Service Worker
//  オフライン対応・キャッシュ管理
// ================================================================

const CACHE_NAME  = ‘dchrpg-cache-v1’;
const SKIP_HOSTS  = [
‘openrouter.ai’,
‘api.openai.com’,
‘fonts.googleapis.com’,
‘fonts.gstatic.com’,
‘cdn.tailwindcss.com’
];

// キャッシュするアプリシェル
const APP_SHELL = [
‘./’,
‘./index.html’,
‘./manifest.json’
];

// ── INSTALL: アプリシェルをキャッシュ ──────────────────────────
self.addEventListener(‘install’, event => {
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(APP_SHELL))
.then(() => self.skipWaiting())
);
});

// ── ACTIVATE: 古いキャッシュを削除 ─────────────────────────────
self.addEventListener(‘activate’, event => {
event.waitUntil(
caches.keys()
.then(keys =>
Promise.all(
keys
.filter(k => k !== CACHE_NAME)
.map(k => caches.delete(k))
)
)
.then(() => self.clients.claim())
);
});

// ── FETCH: キャッシュ優先、APIはネットワーク直通 ───────────────
self.addEventListener(‘fetch’, event => {
const url = new URL(event.request.url);

// API / CDN リクエストはキャッシュしない
const isExternal = SKIP_HOSTS.some(h => url.hostname.includes(h));
if (isExternal || event.request.method !== ‘GET’) {
return; // ブラウザのデフォルト動作に任せる
}

// アプリシェル: キャッシュ優先 → ネットワークフォールバック
event.respondWith(
caches.match(event.request)
.then(cached => {
if (cached) return cached;
return fetch(event.request).then(response => {
// 正常なレスポンスのみキャッシュに追加
if (response && response.status === 200 && response.type === ‘basic’) {
const clone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
}
return response;
});
})
.catch(() => {
// オフライン時はindex.htmlを返す（SPAフォールバック）
if (event.request.mode === ‘navigate’) {
return caches.match(’./index.html’);
}
})
);
});

// ── MESSAGE: クライアントからのキャッシュクリア要求 ────────────
self.addEventListener(‘message’, event => {
if (event.data && event.data.type === ‘CLEAR_CACHE’) {
caches.delete(CACHE_NAME).then(() => {
event.ports[0] && event.ports[0].postMessage({ done: true });
});
}
});