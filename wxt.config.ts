import { defineConfig } from 'wxt';

export default defineConfig({
  vite: () => ({
    server: { port: 3010 }, // avoid conflict with Next.js on 3000
  }),
  runner: {
    binaries: {
      chrome: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
  },
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
