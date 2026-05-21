// ════════════════════════════════════════════════════════════
// FGO ダメージ計算機 PC 版 Service Worker
// ════════════════════════════════════════════════════════════
//
// 目的:
//   約 10MB の self-contained HTML を 2 回目以降のアクセスで再ダウンロード
//   しないよう、 Service Worker による永続キャッシュを実装する。
//   これにより低速回線でも起動が高速化される。
//
// 戦略: Stale-While-Revalidate (= キャッシュ即返し + バックグラウンド更新)
//   1. キャッシュがあれば即座に返す (起動爆速)
//   2. 同時にバックグラウンドで最新版を取得 → 次回用にキャッシュ更新
//   3. ユーザーは「前回起動時のバージョン」 を即座に使え、 更新は次回起動時に自動反映
//
// オフライン動作:
//   2 回目以降のアクセスは完全オフラインで動作可能 (= 機内モードでも開ける)
//
// バージョンアップ:
//   sw.js を更新した時 (このファイルを修正してアップロード) は、 ブラウザが
//   自動で新 sw.js を検知して旧キャッシュを破棄する。
//   通常は HTML の更新だけならこのファイルを触らなくてよい。
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'fgo-calc-pc-v1';

// install: 即座に新 SW を有効化 (= waiting 状態にしない)
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
  // GET 以外 (POST 等) は SW で扱わない
  if (event.request.method !== 'GET') return;
  // 同一オリジン以外 (= 外部 API、 CDN 等) は SW で扱わない
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        // バックグラウンドでネットワーク取得 → キャッシュ更新
        // 失敗 (オフライン等) しても cached があれば返せる
        const networkPromise = fetch(event.request).then(response => {
          // 200 OK のみキャッシュ (404 や 5xx はキャッシュしない)
          if (response && response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        }).catch(err => {
          // ネットワーク失敗 + キャッシュもなし → エラーをそのまま返す
          if (cached) return cached;
          throw err;
        });

        // キャッシュがあれば即返し、 なければネットワーク完了待ち
        return cached || networkPromise;
      })
    )
  );
});
