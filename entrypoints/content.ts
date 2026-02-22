// Content script — runs on Steam profile pages.
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
    const { panel, status } = createPanel(steamId, steamName);
    target.insertAdjacentElement('beforebegin', panel);

    chrome.runtime.sendMessage(
      { type: 'CHECK_STEAM_ID', steamId },
      (res: BgResponse) => updateStatus(status, steamId, res),
    );
  },
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getSteamId(): string | null {
  // /profiles/76561198XXXXXXXXX — ID is directly in the URL
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
  const el = document.querySelector('.actual_persona_name');
  if (el?.textContent) return el.textContent.trim();

  // Fallback: page title is "Steam Community :: Name"
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

// Build panel using DOM methods — no innerHTML with external data
function createPanel(steamId: string, steamName: string): { panel: HTMLElement; status: HTMLElement } {
  const panel = document.createElement('div');
  panel.id = 'sniperveto-panel';
  Object.assign(panel.style, {
    width: '100%',
    padding: '8px 16px',
    background: '#1b2838',
    borderTop: '2px solid #4c6b22',
    borderBottom: '2px solid #4c6b22',
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    color: '#c6d4df',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    boxSizing: 'border-box',
  });

  const status = document.createElement('span');
  status.id = 'sv-status';
  status.textContent = 'SniperVeto: checking...';

  const reportBtn = document.createElement('a');
  reportBtn.href = reportUrl(steamId, steamName); // URL-encoded by URLSearchParams
  reportBtn.target = '_blank';
  reportBtn.rel = 'noopener noreferrer';
  reportBtn.textContent = '+ Report';
  Object.assign(reportBtn.style, {
    padding: '4px 10px',
    background: '#c0392b',
    color: '#fff',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 'bold',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    flexShrink: '0',
  });

  panel.appendChild(status);
  panel.appendChild(reportBtn);

  return { panel, status };
}

function updateStatus(status: HTMLElement, steamId: string, res: BgResponse | null): void {
  const panel = status.parentElement;

  if (!res?.ok) {
    status.textContent = 'SniperVeto: could not connect';
    return;
  }

  const reports = Array.isArray(res.data) ? res.data : [];
  const count = reports.length;

  if (count === 0) {
    if (panel) panel.style.borderColor = '#4caf50';
    status.textContent = 'Not in SniperVeto database';
  } else {
    if (panel) {
      panel.style.borderColor = '#e8a838';
      panel.style.background = '#2a1f0a';
    }

    // Build the "X reports" + "View" link with DOM methods
    status.textContent = '';

    const bold = document.createElement('strong');
    bold.textContent = `${count} report${count > 1 ? 's' : ''}`;
    status.appendChild(bold);

    status.appendChild(document.createTextNode(' in SniperVeto — '));

    const link = document.createElement('a');
    link.href = `${SITE_URL}?steamId=${steamId}`; // steamId is validated: /\d{17}/
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View';
    Object.assign(link.style, { color: '#e8a838', textDecoration: 'underline' });
    status.appendChild(link);
  }
}
