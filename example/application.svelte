<script lang="ts">
  import { createCounter } from './counter.svelte.ts';

  const counter = createCounter();
</script>

<main>
  <h1>bun-plugin-svelte</h1>
  <p>A Svelte 5 app served by Bun's fullstack dev server.</p>
  <button onclick={counter.increment}>Count: {counter.count}</button>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 32rem;
    margin: 4rem auto;
  }

  button {
    font-size: 1.25rem;
    padding: 0.5rem 1rem;
  }
</style>
