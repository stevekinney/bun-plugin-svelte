// Run with: bun run example/server.ts
// The bunfig.toml in this directory registers the plugin for HTML-imported assets.
import index from './index.html';

const server = Bun.serve({
  routes: {
    '/': index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Serving on ${server.url}`);
