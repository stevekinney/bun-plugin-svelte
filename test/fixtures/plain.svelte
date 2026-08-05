<script lang="ts">
  const { message = 'hello' }: { message?: string } = $props();
</script>

<p>{message}</p>
