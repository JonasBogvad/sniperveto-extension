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

    const target = await waitForElement('.profile_header_actions, .profile_content');
    if (!target) return;

    const steamName = getSteamName();
    const { panel, dot, label } = createPanel(steamId, steamName);

    // Inject inside the actions area if possible, else before the content
    if (target.classList.contains('profile_header_actions')) {
      target.appendChild(panel);
    } else {
      target.insertAdjacentElement('beforebegin', panel);
    }

    chrome.runtime.sendMessage(
      { type: 'CHECK_STEAM_ID', steamId },
      (res: BgResponse) => updateStatus(dot, label, steamId, res),
    );
  },
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getSteamId(): string | null {
  const profileMatch = window.location.pathname.match(/^\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  for (const script of document.querySelectorAll('script')) {
    const match = (script.textContent ?? '').match(/"steamid"\s*:\s*"(\d{17})"/);
    if (match) return match[1];
  }

  return null;
}

function getSteamName(): string {
  const el = document.querySelector('.actual_persona_name');
  if (el?.textContent) return el.textContent.trim();

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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration> = {},
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Build panel using DOM methods — no innerHTML with external data
function createPanel(
  steamId: string,
  steamName: string,
): { panel: HTMLElement; dot: HTMLElement; label: HTMLElement } {
  // Outer wrapper — sits inline next to Steam's action buttons
  const panel = el('div', {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 12px',
    height: '28px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    fontSize: '12px',
    color: '#8f98a0',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    marginLeft: '8px',
  });
  panel.id = 'sniperveto-panel';

  // Small brand label
  const brand = el('span', { color: '#566573', fontSize: '11px', letterSpacing: '0.03em' });
  brand.textContent = 'SniperVeto';

  // Divider
  const divider = el('span', { color: 'rgba(255,255,255,0.1)', fontSize: '14px' });
  divider.textContent = '|';

  // Status dot
  const dot = el('span', {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#566573',
    display: 'inline-block',
    flexShrink: '0',
  });

  // Status label
  const label = el('span', { color: '#8f98a0' });
  label.textContent = 'checking...';

  // Report link — muted, styled like a Notion inline action
  const report = el(
    'a',
    {
      color: '#566573',
      fontSize: '11px',
      textDecoration: 'none',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      paddingLeft: '8px',
      marginLeft: '4px',
      cursor: 'pointer',
    },
    {
      href: reportUrl(steamId, steamName),
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  );
  report.textContent = 'Report';

  // Hover effect on report link
  report.addEventListener('mouseenter', () => { report.style.color = '#c6d4df'; });
  report.addEventListener('mouseleave', () => { report.style.color = '#566573'; });

  panel.appendChild(brand);
  panel.appendChild(divider);
  panel.appendChild(dot);
  panel.appendChild(label);
  panel.appendChild(report);

  return { panel, dot, label };
}

function updateStatus(
  dot: HTMLElement,
  label: HTMLElement,
  steamId: string,
  res: BgResponse | null,
): void {
  if (!res?.ok) {
    dot.style.background = '#566573';
    label.textContent = 'unavailable';
    return;
  }

  const reports = Array.isArray(res.data) ? res.data : [];
  const count = reports.length;

  if (count === 0) {
    dot.style.background = '#4caf50';
    label.textContent = 'Clean';
    label.style.color = '#c6d4df';
  } else {
    dot.style.background = '#e8a838';
    label.style.color = '#e8a838';

    const bold = el('strong');
    bold.textContent = `${count} report${count > 1 ? 's' : ''}`;
    label.textContent = '';
    label.appendChild(bold);

    label.appendChild(document.createTextNode(' — '));

    const link = el(
      'a',
      { color: '#8f98a0', textDecoration: 'underline' },
      {
        href: `${SITE_URL}?steamId=${steamId}`,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    );
    link.textContent = 'View';
    link.addEventListener('mouseenter', () => { link.style.color = '#c6d4df'; });
    link.addEventListener('mouseleave', () => { link.style.color = '#8f98a0'; });
    label.appendChild(link);
  }
}
