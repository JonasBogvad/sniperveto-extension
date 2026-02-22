import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'SniperVeto',
    description: 'Check Steam profiles against the SniperVeto stream sniper database',
    permissions: [],
    host_permissions: [
      'https://steamcommunity.com/*',
      'https://sniperveto.vercel.app/*',
    ],
  },
});
