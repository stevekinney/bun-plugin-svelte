<script module lang="ts">
  export const moduleMeta = 'module-meta-export';
</script>

<script lang="ts">
  const { label = moduleMeta }: { label?: string } = $props();
</script>

<span>{label}</span>
