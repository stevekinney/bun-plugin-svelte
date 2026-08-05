// Run with: bun run example/server-side-render.ts
// Demonstrates SSR via the runtime plugin: register it, import the component,
// and render HTML with svelte/server.
import { plugin } from 'bun';
import { render } from 'svelte/server';

import { sveltePlugin } from '../src/index.ts';

plugin(sveltePlugin({ generate: 'server' }));

const { default: Application } = await import('./application.svelte');

const { body, head } = render(Application);
console.log({ head, body });
