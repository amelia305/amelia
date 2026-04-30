<script lang="ts">
  const { cols = 4 }: { cols?: number } = $props();
</script>

{#each Array(cols) as _, i (i)}
  <td class="px-4 py-3">
    <div class="h-4 bg-slate-200 rounded animate-pulse"></div>
  </td>
{/each}
