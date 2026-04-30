<script lang="ts">
  import type { PageData } from './$types';
  import type { Role } from '$lib/types';
  import { PILLAR_NAMES } from '$lib/instrument/seed';

  const { data }: { data: PageData } = $props();

  const ROLE_LABELS: Record<Role, string> = {
    executive: 'Alta Dirección',
    middleManagement: 'Mandos Medios',
    operational: 'Operativos',
  };

  function getDiagColor(score: number): string {
    if (score >= 90) return 'text-green-700';
    if (score >= 60) return 'text-blue-700';
    if (score >= 40) return 'text-amber-700';
    return 'text-red-700';
  }

  function getDiagLabel(score: number): string {
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
      month: 'long',
      day: 'numeric',
    });
  }

  const PILLAR_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
</script>

<svelte:head>
  <title>Reporte: {data.employee.name} — DSME-Corp</title>
</svelte:head>

<div class="space-y-6">
  <!-- Breadcrumb -->
  <nav aria-label="Migas de pan" class="text-sm text-slate-500 flex items-center gap-2">
    <a href="/reportes" class="hover:text-[#003366] hover:underline">Reportes</a>
    <span aria-hidden="true">/</span>
    <span class="text-slate-800 font-medium">{data.employee.name}</span>
  </nav>

  <!-- Employee header -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-4">
      <div class="w-14 h-14 rounded-2xl bg-[#003366] flex items-center justify-center text-white
                  text-xl font-bold flex-shrink-0" aria-hidden="true">
        {data.employee.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <h1 class="text-2xl font-bold text-slate-800">{data.employee.name}</h1>
        <p class="text-sm text-slate-500 mt-0.5">{data.employee.email}</p>
        <span class="inline-block mt-1 text-xs font-semibold bg-blue-50 text-blue-700
                     border border-blue-200 px-2 py-0.5 rounded">
          {ROLE_LABELS[data.employee.role]}
        </span>
      </div>
    </div>
  </div>

  {#if data.assessments.length === 0}
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
      <p class="text-slate-500 text-sm">Este empleado no tiene evaluaciones completadas.</p>
    </div>
  {:else}
    {#each data.assessments as assessment, i (assessment.id)}
      <section aria-labelledby="assessment-{assessment.id}-heading" class="space-y-4">
        <div class="flex items-center gap-3">
          <h2
            id="assessment-{assessment.id}-heading"
            class="text-lg font-bold text-slate-800"
          >
            {i === 0 ? 'Última evaluación' : `Evaluación anterior ${i}`}
          </h2>
          <span class="text-xs text-slate-400">{formatDate(assessment.completedAt)}</span>
        </div>

        <!-- ISME + pillar scores -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Global ISME -->
          <div class="bg-white rounded-2xl border-l-8 shadow-sm p-6
            {assessment.isme >= 90 ? 'border-green-500' :
             assessment.isme >= 60 ? 'border-blue-500' :
             assessment.isme >= 40 ? 'border-amber-500' : 'border-red-600'}">
            <div class="text-xs font-bold uppercase tracking-wider {getDiagColor(assessment.isme)} mb-2">
              Índice ISME
            </div>
            <div class="text-5xl font-bold text-slate-800 tabular-nums">
              {assessment.isme}<span class="text-xl text-slate-400">/100</span>
            </div>
            <div class="mt-2 text-xs font-bold {getDiagColor(assessment.isme)}">
              {getDiagLabel(assessment.isme)}
            </div>
          </div>

          <!-- Pillar scores -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Puntuación por Pilar
            </div>
            <div class="space-y-2">
              {#each PILLAR_KEYS as pk (pk)}
                {@const pillarNum = parseInt(pk.slice(1)) as 1|2|3|4|5|6}
                {@const score = (assessment.scoresByPillar as Record<string, number>)[pk] ?? 0}
                {@const pillarName = PILLAR_NAMES[assessment.role][pillarNum]}
                <div class="flex items-center gap-3">
                  <span class="text-xs text-slate-500 w-32 truncate">{pillarName}</span>
                  <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      class="h-2 rounded-full {score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500'}"
                      style="width: {score}%"
                      role="progressbar"
                      aria-valuenow={score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="{pillarName}: {score}"
                    ></div>
                  </div>
                  <span class="text-xs font-bold text-slate-700 tabular-nums w-8 text-right">
                    {score}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Answers detail -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100">
            <h3 class="font-semibold text-slate-700 text-sm">Respuestas Individuales</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3 font-semibold">Pilar</th>
                  <th class="px-4 py-3 font-semibold">Pregunta</th>
                  <th class="px-4 py-3 font-semibold text-center">Respuesta</th>
                  <th class="px-4 py-3 font-semibold text-center">Invertida</th>
                </tr>
              </thead>
              <tbody>
                {#each assessment.answers as answer (answer.questionId)}
                  <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 text-slate-500 tabular-nums">P{answer.pillar}</td>
                    <td class="px-4 py-3 text-slate-700 max-w-md">{answer.text}</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{answer.value}</td>
                    <td class="px-4 py-3 text-center text-slate-400 text-xs">
                      {answer.reverse ? 'Sí' : '—'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    {/each}
  {/if}
</div>
