<script lang="ts">
  import { untrack } from 'svelte';

  let { name, initial = 0 }: { name: string; initial?: number } = $props();
  let count = $state(untrack(() => initial));
</script>

<main>
  <h1>Hello, {name}!</h1>
  <p>Rendered on the server, then hydrated on the client.</p>
  <button onclick={() => (count += 1)}>Count: {count}</button>
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
