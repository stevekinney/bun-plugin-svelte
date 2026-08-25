// Run with: bun example/hydrate.ts
// Demonstrates the full SSR + hydrate round trip: render on the server with
// sveltePlugin({ generate: 'server' }) and render() from svelte/server, bundle
// the client separately with sveltePlugin({ generate: 'client' }), then serve
// the server markup with the client bundle's hydrate() attaching to it in the
// browser — instead of mount(), which does not know the target already has
// server-rendered children and appends a second, duplicate render alongside
// them rather than reusing what is already there. Open the printed URL: the
// button is interactive immediately, and the markup the server sent is the
// only copy of it in the page.
//
// css: 'injected' on both sides so the CSS reaches this page whether or not
// the client script has run yet — see the "CSS modes" section in the README.
import { plugin } from 'bun';
import { render } from 'svelte/server';

import { sveltePlugin } from '../src/index.ts';
import { props } from './hydrate-props.ts';

plugin(sveltePlugin({ generate: 'server', css: 'injected' }));

const { default: Application } = await import('./hydrate-application.svelte');
const { head, body } = render(Application, { props });

const clientBuild = await Bun.build({
  entrypoints: [`${import.meta.dir}/hydrate-client.ts`],
  target: 'browser',
  plugins: [sveltePlugin({ generate: 'client', css: 'injected' })],
});

if (!clientBuild.success) {
  for (const message of clientBuild.logs) console.error(message);
  throw new Error('Client build failed');
}

const clientScript = await clientBuild.outputs[0]!.text();

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>bun-plugin-svelte hydrate example</title>
    ${head}
  </head>
  <body>
    <div id="root">${body}</div>
    <script type="module">${clientScript}</script>
  </body>
</html>`;

const server = Bun.serve({
  fetch: () => new Response(html, { headers: { 'Content-Type': 'text/html' } }),
});

console.log(`Serving the hydrated app on ${server.url}`);
