<script lang="ts">
  import { createCounter } from './counter-state.svelte.ts';
  import Plain from './plain.svelte';

  const counter = createCounter(5);
</script>

<Plain message="nested" />
<button onclick={counter.increment}>Count: {counter.count}</button>

<style>
  button {
    border: 1px solid darkorchid;
  }
</style>
