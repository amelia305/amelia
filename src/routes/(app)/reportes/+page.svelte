<script lang="ts">
  import type { PageData } from './$types';
  import type { Role } from '$lib/types';
  import SkeletonRow from '$lib/components/SkeletonRow.svelte';

  const { data }: { data: PageData } = $props();

  const ROLE_LABELS: Record<Role, string> = {
    executive: 'Alta Dirección',
    middleManagement: 'Mandos Medios',
    operational: 'Operativos',
  };

  function getDiagColor(score: number | null): string {
    if (score === null) return 'text-slate-400';
    if (score >= 90) return 'text-green-700';
    if (score >= 60) return 'text-blue-700';
    if (score >= 40) return 'text-amber-700';
    return 'text-red-700';
  }

  function getDiagLabel(score: number | null): string {
    if (score === null) return 'Sin evaluar';
    if (score >= 90) return 'SOBRESALIENTE';
    if (score >= 60) return 'SALUDABLE';
    if (score >= 40) return 'EN RIESGO';
    return 'CRÍTICO';
  }

  function formatDate(ts: unknown): string {
    if (!ts || typeof ts !== 'object') return '—';
    const obj = ts as Record<string, unknown>;
    const millis =
      typeof obj['toMillis'] === 'function'
        ? (obj as { toMillis: () => number }).toMillis()
        : typeof obj['_seconds'] === 'number'
          ? (obj['_seconds'] as number) * 1000
          : null;
    if (millis === null) return '—';
    return new Date(millis).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>Reportes — DSME-Corp</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-[#003366]">Reportes</h1>
    <p class="text-slate-500 mt-1">Listado de empleados y su última evaluación.</p>
  </div>

  {#await data.rows}
    <!-- Skeleton pending state -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold">Nombre</th>
              <th class="px-4 py-3 font-semibold">Correo</th>
              <th class="px-4 py-3 font-semibold">Rol</th>
              <th class="px-4 py-3 font-semibold">ISME</th>
              <th class="px-4 py-3 font-semibold">Estado</th>
              <th class="px-4 py-3 font-semibold">Última eval.</th>
              <th class="px-4 py-3 font-semibold sr-only">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each [1, 2, 3, 4, 5] as i (i)}
              <tr class="border-t border-slate-100">
                <SkeletonRow cols={7} />
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:then rows}
    {#if rows.length === 0}
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <p class="text-slate-500 text-sm">No hay empleados registrados aún.</p>
      </div>
    {:else}
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold">Nombre</th>
                <th class="px-4 py-3 font-semibold">Correo</th>
                <th class="px-4 py-3 font-semibold">Rol</th>
                <th class="px-4 py-3 font-semibold">ISME</th>
                <th class="px-4 py-3 font-semibold">Estado</th>
                <th class="px-4 py-3 font-semibold">Última eval.</th>
                <th class="px-4 py-3 font-semibold sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row (row.id)}
                <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td class="px-4 py-3 text-slate-500">{row.email}</td>
                  <td class="px-4 py-3 text-slate-600">{ROLE_LABELS[row.role]}</td>
                  <td class="px-4 py-3 font-bold tabular-nums {getDiagColor(row.latestIsme)}">
                    {row.latestIsme !== null ? row.latestIsme : '—'}
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-semibold {getDiagColor(row.latestIsme)}">
                      {getDiagLabel(row.latestIsme)}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-slate-500">{formatDate(row.latestCompletedAt)}</td>
                  <td class="px-4 py-3">
                    {#if row.latestIsme !== null}
                      <a
                        href="/reportes/{row.id}"
                        class="text-xs font-medium text-[#003366] hover:underline"
                        aria-label="Ver detalle de {row.name}"
                      >
                        Ver detalle
                      </a>
                    {:else}
                      <span class="text-xs text-slate-300">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {:catch}
    <p class="text-red-600 text-sm">Error al cargar reportes. Recargue la página.</p>
  {/await}
</div>
