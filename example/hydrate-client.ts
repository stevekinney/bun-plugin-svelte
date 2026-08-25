// Bundled by example/hydrate.ts with sveltePlugin({ generate: 'client' }) and
// served alongside the server-rendered markup it attaches to. hydrate()
// reuses the DOM nodes svelte/server already produced instead of discarding
// and rebuilding them — using mount() here instead would not know the target
// already has server-rendered children, so it would append a second, live
// copy of the component next to the dead SSR markup, with no error to tell
// you what happened.
import { hydrate } from 'svelte';

import Application from './hydrate-application.svelte';
import { props } from './hydrate-props.ts';

hydrate(Application, { target: document.getElementById('root')!, props });
