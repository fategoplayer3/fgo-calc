// ════════════════════════════════════════════════════════════
// FGO ダメージ計算機 Mobile 版 Service Worker
// ════════════════════════════════════════════════════════════
//
// 目的・戦略は PC 版 sw.js と同じ (= Stale-While-Revalidate)。
// CACHE_NAME を mobile 用にしてあるので、 PC 版と Mobile 版のキャッシュは独立して
// 管理される (互いに影響しない)。
//
// このファイルは /mobile/sw.js として配置する (= /mobile/ 配下にスコープが限定される)。
//
// 重要: ファイル更新時は必ず CACHE_NAME のバージョン番号を増やすこと。
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'fgo-calc-mobile-v20260526-1';

// install: 即座に新 SW を有効化
self.addEventListener('install', () => {
  self.skipWaiting();
});

// activate: 古いキャッシュを削除 + 全クライアントを即座に制御
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// fetch: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkPromise = fetch(event.request).then(response => {
          if (response && response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        }).catch(err => {
          if (cached) return cached;
          throw err;
        });
        return cached || networkPromise;
      })
    )
  );
});
