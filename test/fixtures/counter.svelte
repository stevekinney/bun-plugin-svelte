<script lang="ts">
  let count: number = $state(0);

  const increment = (): void => {
    count += 1;
  };
</script>

<button onclick={increment}>Count: {count}</button>

<style>
  button {
    color: rebeccapurple;
  }
</style>
