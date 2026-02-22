// Content script — runs on Steam profile pages
// Extracts Steam ID + name, asks background worker to query SniperVeto, injects panel.

const SITE_URL = 'https://sniperveto.vercel.app';

interface Report {
  id: string;
  steamId: string;
  steamName: string;
  reportedBy: string;
  game: string;
  severity: string;
  votes: { total: number };
}

interface BgResponse {
  ok: boolean;
  data?: Report[];
  error?: string;
}

export default defineContentScript({
  matches: [
    'https://steamcommunity.com/profiles/*',
    'https://steamcommunity.com/id/*',
  ],

  async main() {
    const steamId = getSteamId();
    if (!steamId) return;

    const target = await waitForElement('.profile_content');
    if (!target) return;

    const steamName = getSteamName();
    const panel = createPanel(steamId, steamName);
    target.insertAdjacentElement('beforebegin', panel);

    chrome.runtime.sendMessage(
      { type: 'CHECK_STEAM_ID', steamId },
      (res: BgResponse) => updatePanel(panel, steamId, steamName, res),
    );
  },
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getSteamId(): string | null {
  // /profiles/76561198XXXXXXXXX — ID is in the URL
  const profileMatch = window.location.pathname.match(/^\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  // /id/vanityname — find 64-bit Steam ID embedded in page scripts
  for (const script of document.querySelectorAll('script')) {
    const match = (script.textContent ?? '').match(/"steamid"\s*:\s*"(\d{17})"/);
    if (match) return match[1];
  }

  return null;
}

function getSteamName(): string {
  // Steam profile pages embed the persona name here
  const el = document.querySelector('.actual_persona_name');
  if (el?.textContent) return el.textContent.trim();

  // Fallback: "Steam Community :: Name"
  const titleMatch = document.title.match(/^Steam Community :: (.+)$/);
  if (titleMatch) return titleMatch[1];

  return '';
}

function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function reportUrl(steamId: string, steamName: string): string {
  const params = new URLSearchParams({ steamId });
  if (steamName) params.set('steamName', steamName);
  return `${SITE_URL}/report?${params.toString()}`;
}

function createPanel(steamId: string, steamName: string): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'sniperveto-panel';
  panel.style.cssText = `
    width: 100%;
    padding: 8px 16px;
    background: #1b2838;
    border-top: 2px solid #4c6b22;
    border-bottom: 2px solid #4c6b22;
    font-family: Arial, sans-serif;
    font-size: 13px;
    color: #c6d4df;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span id="sv-status">SniperVeto: checking...</span>
    </div>
    <a
      href="${reportUrl(steamId, steamName)}"
      target="_blank"
      rel="noopener"
      style="
        padding: 4px 10px;
        background: #c0392b;
        color: #fff;
        border-radius: 3px;
        font-size: 12px;
        font-weight: bold;
        text-decoration: none;
        white-space: nowrap;
        flex-shrink: 0;
      "
    >+ Report</a>
  `;
  return panel;
}

function updatePanel(
  panel: HTMLElement,
  steamId: string,
  steamName: string,
  res: BgResponse | null,
): void {
  const status = panel.querySelector('#sv-status') as HTMLElement;

  if (!res?.ok) {
    status.textContent = 'SniperVeto: could not connect';
    return;
  }

  const reports = Array.isArray(res.data) ? res.data : [];
  const count = reports.length;

  if (count === 0) {
    panel.style.borderColor = '#4caf50';
    status.textContent = 'Not in SniperVeto database';
  } else {
    panel.style.borderColor = '#e8a838';
    panel.style.background = '#2a1f0a';
    const viewUrl = `${SITE_URL}?steamId=${steamId}`;
    status.innerHTML = `<strong>${count} report${count > 1 ? 's' : ''}</strong> in SniperVeto — <a href="${viewUrl}" target="_blank" rel="noopener" style="color:#e8a838;text-decoration:underline">View</a>`;
  }
}
