// ════════════════════════════════════════════════════════════
// FGO ダメージ計算機 PC 版 Service Worker
// ════════════════════════════════════════════════════════════
//
// 戦略: Stale-While-Revalidate
//   1. リクエスト発生時、 キャッシュにあればそれを即返す
//   2. 並行でネットワークから取得し、 取得成功時にキャッシュ更新
//   3. 次回アクセス時には新しい内容が返る
//
// このファイルは / (= リポジトリのルート) に配置する。
// スコープは / 以下 (= /fgo-calc/* 全体)。 ただし /mobile/ 配下は
// /mobile/sw.js が別途登録されているのでそちらが優先される。
//
// 重要: ファイル更新時は必ず CACHE_NAME のバージョン番号を増やすこと。
// バージョン番号が変わると activate イベントで 旧キャッシュが破棄され、
// ユーザーの ブラウザに新しい内容が確実に届く。
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'fgo-calc-pc-v20260526-2';

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
