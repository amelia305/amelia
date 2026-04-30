<script lang="ts">
  import type { PageData } from './$types';
  import type { Role } from '$lib/types';
  import SkeletonStatCard from '$lib/components/SkeletonStatCard.svelte';

  const { data }: { data: PageData } = $props();

  const ROLE_LABELS: Record<Role, string> = {
    executive: 'Alta Dirección',
    middleManagement: 'Mandos Medios',
    operational: 'Operativos',
  };

  function getDiagnosis(score: number): { status: string; colorClass: string; bgClass: string } {
    if (score >= 90)
      return { status: 'SOBRESALIENTE', colorClass: 'text-green-700', bgClass: 'bg-green-50 border-green-200' };
    if (score >= 60)
      return { status: 'SALUDABLE', colorClass: 'text-blue-700', bgClass: 'bg-blue-50 border-blue-200' };
    if (score >= 40)
      return { status: 'EN RIESGO', colorClass: 'text-amber-700', bgClass: 'bg-amber-50 border-amber-200' };
    return { status: 'CRÍTICO', colorClass: 'text-red-700', bgClass: 'bg-red-50 border-red-200' };
  }

  function borderColor(score: number): string {
    if (score >= 90) return 'border-green-500';
    if (score >= 60) return 'border-blue-500';
    if (score >= 40) return 'border-amber-500';
    return 'border-red-600';
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
  <title>Dashboard — DSME-Corp</title>
</svelte:head>

<div class="space-y-10">
  <div>
    <h1 class="text-3xl font-bold text-[#003366]">Termómetro Corporativo</h1>
    <p class="text-slate-500 mt-1">Diagnóstico de bienestar organizacional por empresa.</p>
  </div>

  {#await data.dashboards}
    <!-- Skeleton pending state -->
    <div class="space-y-6">
      {#each [1, 2] as i (i)}
        <SkeletonStatCard />
      {/each}
    </div>
  {:then dashboards}
    {#if dashboards.length === 0}
      <!-- Empty state -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-slate-700 mb-1">Sin empresas asignadas</h2>
        <p class="text-sm text-slate-500">
          No tiene empresas vinculadas a su cuenta. Contacte al administrador del sistema.
        </p>
      </div>
    {:else}
      {#each dashboards as dashboard (dashboard.company.id)}
        {@const diag = getDiagnosis(dashboard.stats.weightedIsme)}
        {@const border = borderColor(dashboard.stats.weightedIsme)}

        <section aria-labelledby="company-{dashboard.company.id}-heading" class="space-y-6">
          <h2
            id="company-{dashboard.company.id}-heading"
            class="text-xl font-bold text-slate-800 flex items-center gap-2"
          >
            <span class="w-2 h-2 rounded-full bg-[#003366] inline-block" aria-hidden="true"></span>
            {dashboard.company.name}
          </h2>

          <!-- Nivel 1: Termómetro global -->
          <div class="bg-white rounded-2xl shadow-sm border-l-8 p-6 {border}">
            <div class="flex justify-between items-start mb-4">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider block {diag.colorClass}">
                  Nivel 1 · Visión Macro
                </span>
                <h3 class="font-bold text-xl text-slate-800 mt-0.5">Índice ISME Global</h3>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" class="{diag.colorClass}" aria-hidden="true">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
              </svg>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-6">
              <div class="text-center flex-shrink-0">
                <div class="text-5xl font-bold text-slate-800 tabular-nums">
                  {dashboard.stats.weightedIsme}<span class="text-xl text-slate-400">/100</span>
                </div>
                <div class="text-xs font-bold px-2 py-1 rounded mt-2 text-white inline-block
                  {dashboard.stats.weightedIsme >= 90 ? 'bg-green-600' :
                   dashboard.stats.weightedIsme >= 60 ? 'bg-blue-600' :
                   dashboard.stats.weightedIsme >= 40 ? 'bg-amber-500' : 'bg-red-600'}">
                  {diag.status}
                </div>
              </div>
              <div class="border-l pl-6 text-sm text-slate-600">
                <p class="font-medium">Diagnóstico automático</p>
                <p class="mt-1 text-slate-500">
                  Ponderación estratégica: Alta Dirección 30% · Mandos Medios 40% · Operativos 30%
                </p>
              </div>
            </div>
          </div>

          <!-- Nivel 2: Por roles -->
          <div class="bg-white rounded-2xl shadow-sm border-l-8 border-blue-500 p-6">
            <div class="flex justify-between items-start mb-4">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-blue-600 block">
                  Nivel 2 · Segmentación
                </span>
                <h3 class="font-bold text-xl text-slate-800 mt-0.5">Comparativa por Roles</h3>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {#each (['executive', 'middleManagement', 'operational'] as Role[]) as role (role)}
                {@const bucket = dashboard.stats.byRole[role]}
                {@const rd = getDiagnosis(bucket.count > 0 ? Math.round(bucket.avgIsme) : 0)}
                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {ROLE_LABELS[role]}
                  </div>
                  {#if bucket.count === 0}
                    <div class="text-2xl font-bold text-slate-300">—</div>
                    <div class="text-xs text-slate-400 mt-1">Sin evaluaciones</div>
                  {:else}
                    <div class="text-3xl font-bold text-slate-800 tabular-nums">
                      {Math.round(bucket.avgIsme)}
                    </div>
                    <div class="text-xs mt-1 font-semibold {rd.colorClass}">{rd.status}</div>
                    <div class="text-xs text-slate-400 mt-0.5">
                      {bucket.count} evaluación{bucket.count !== 1 ? 'es' : ''}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Nivel 3: Evaluaciones recientes -->
          {#if dashboard.recentAssessments.length > 0}
            <div class="bg-white rounded-2xl shadow-sm border-l-8 border-purple-500 p-6">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <span class="text-xs font-bold uppercase tracking-wider text-purple-600 block">
                    Nivel 3 · Granularidad
                  </span>
                  <h3 class="font-bold text-xl text-slate-800 mt-0.5">Evaluaciones Recientes</h3>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                  fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full text-sm text-left">
                  <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th class="px-4 py-3 font-semibold">Empleado ID</th>
                      <th class="px-4 py-3 font-semibold">Rol</th>
                      <th class="px-4 py-3 font-semibold">ISME</th>
                      <th class="px-4 py-3 font-semibold">Completado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each dashboard.recentAssessments as assessment (assessment.id)}
                      {@const ad = getDiagnosis(assessment.isme)}
                      <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-3">
                          <a
                            href="/reportes/{dashboard.company.id}/{assessment.employeeId}"
                            class="text-[#003366] hover:underline font-medium font-mono text-xs"
                          >
                            {assessment.employeeId.slice(0, 8)}…
                          </a>
                        </td>
                        <td class="px-4 py-3 text-slate-600">{ROLE_LABELS[assessment.role]}</td>
                        <td class="px-4 py-3 font-bold {ad.colorClass}">{assessment.isme}</td>
                        <td class="px-4 py-3 text-slate-500">{formatDate(assessment.completedAt)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
              Sin evaluaciones completadas aún.
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  {:catch _err}
    <p class="text-red-600 text-sm">Error al cargar el dashboard. Recargue la página.</p>
  {/await}
</div>
