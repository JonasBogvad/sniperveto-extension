// Background service worker — handles API calls to bypass CORS restrictions
// Content scripts send a message here; we fetch and reply.

const API_URL = 'https://sniperveto.vercel.app/api/reports';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CHECK_STEAM_ID') {
      fetch(`${API_URL}?steamId=${encodeURIComponent(message.steamId as string)}`)
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // keep message channel open for async response
    }
  });
});
