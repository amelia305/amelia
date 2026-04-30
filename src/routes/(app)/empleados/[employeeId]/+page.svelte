<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import type { PageData, ActionData } from './$types';
  import type { Role } from '$lib/types';

  const { data, form }: { data: PageData; form: ActionData } = $props();

  const ROLE_LABELS: Record<Role, string> = {
    executive: 'Alta Dirección',
    middleManagement: 'Mandos Medios',
    operational: 'Operativos',
  };

  const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
    pending: { label: 'Pendiente', classes: 'bg-slate-100 text-slate-600' },
    inProgress: { label: 'En progreso', classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
    completed: { label: 'Completado', classes: 'bg-green-50 text-green-700 border border-green-200' },
    expired: { label: 'Expirado', classes: 'bg-red-50 text-red-600 border border-red-200' },
  };

  let generatingToken = $state(false);
  let revokingToken = $state<string | null>(null);
  let copiedToken = $state<string | null>(null);

  // Newly generated test URL surfaced from the last form action.
  let latestTestUrl = $derived(
    form && 'testUrl' in form && typeof form.testUrl === 'string' ? form.testUrl : null
  );

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

  async function copyToClipboard(text: string, tokenId: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedToken = tokenId;
      setTimeout(() => { copiedToken = null; }, 2000);
    } catch {
      // Fallback: select the text
    }
  }
</script>

<svelte:head>
  <title>{data.employee.name} — Empleados — DSME-Corp</title>
</svelte:head>

<div class="space-y-6">
  <!-- Breadcrumb -->
  <nav aria-label="Migas de pan" class="text-sm text-slate-500 flex items-center gap-2">
    <a href="/empleados" class="hover:text-[#003366] hover:underline">Empleados</a>
    <span aria-hidden="true">/</span>
    <span class="text-slate-800 font-medium">{data.employee.name}</span>
  </nav>

  <!-- Employee header -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-4">
      <div
        class="w-14 h-14 rounded-2xl bg-[#003366] flex items-center justify-center text-white
               text-xl font-bold flex-shrink-0 {data.employee.archived ? 'opacity-50' : ''}"
        aria-hidden="true"
      >
        {data.employee.name.charAt(0).toUpperCase()}
      </div>
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-slate-800">
          {data.employee.name}
          {#if data.employee.archived}
            <span class="text-sm font-normal text-slate-400 ml-2">(archivado)</span>
          {/if}
        </h1>
        <p class="text-sm text-slate-500 mt-0.5">{data.employee.email}</p>
        <span class="inline-block mt-1 text-xs font-semibold bg-blue-50 text-blue-700
                     border border-blue-200 px-2 py-0.5 rounded">
          {ROLE_LABELS[data.employee.role]}
        </span>
      </div>
    </div>
  </div>

  <!-- Action feedback -->
  {#if form && 'error' in form && form.error}
    <div role="alert" class="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
      {'message' in form && form.message ? form.message : form.error}
    </div>
  {/if}

  <!-- New test URL clipboard copy -->
  {#if latestTestUrl}
    <div
      role="status"
      class="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 flex items-start gap-3"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" class="flex-shrink-0 mt-0.5" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <div class="flex-1">
        <p class="font-semibold mb-1">Token generado. Copie el enlace de evaluación:</p>
        <div class="flex items-center gap-2 flex-wrap">
          <code class="bg-white border border-green-200 px-2 py-1 rounded text-xs break-all">
            {latestTestUrl}
          </code>
          <button
            onclick={() => copyToClipboard(latestTestUrl!, 'new')}
            class="text-xs font-medium text-green-700 hover:text-green-900 underline focus:outline-none"
            aria-label="Copiar enlace al portapapeles"
          >
            {copiedToken === 'new' ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Generate token -->
  {#if !data.employee.archived}
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-2">Generar enlace de test</h2>
      <p class="text-sm text-slate-500 mb-4">
        Genera un token de evaluación para este empleado. El enlace es de un solo uso.
      </p>
      <form
        method="POST"
        action="?/createToken"
        use:enhance={() => {
          generatingToken = true;
          return async ({ result, update }) => {
            generatingToken = false;
            if (result.type === 'success') {
              // update({ reset: false }) populates form.testUrl for the clipboard banner,
              // then invalidate re-fetches the token list without a full navigation.
              await update({ reset: false });
              await invalidate('app:tokens');
            } else {
              await update();
            }
          };
        }}
      >
        <button
          type="submit"
          disabled={generatingToken}
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white
                 text-sm font-semibold hover:bg-amber-600 focus:outline-none focus:ring-2
                 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
          aria-label="Generar enlace de test para {data.employee.name}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          {generatingToken ? 'Generando…' : 'Generar enlace'}
        </button>
      </form>
    </div>
  {/if}

  <!-- Token list -->
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <h2 class="font-semibold text-slate-700">Historial de tokens</h2>
      <span class="text-xs text-slate-400">{data.tokens.length} token{data.tokens.length !== 1 ? 's' : ''}</span>
    </div>

    {#if data.tokens.length === 0}
      <div class="p-8 text-center text-sm text-slate-500">
        No hay tokens generados aún.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold">Token</th>
              <th class="px-4 py-3 font-semibold">Estado</th>
              <th class="px-4 py-3 font-semibold">Creado</th>
              <th class="px-4 py-3 font-semibold">Expira</th>
              <th class="px-4 py-3 font-semibold sr-only">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each data.tokens as token (token.value)}
              {@const statusInfo = STATUS_LABELS[token.status] ?? { label: token.status, classes: 'bg-slate-100 text-slate-600' }}
              <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-slate-600">
                  {token.value.slice(0, 10)}…
                </td>
                <td class="px-4 py-3">
                  <span class="text-xs font-semibold px-2 py-0.5 rounded {statusInfo.classes}">
                    {statusInfo.label}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-500">{formatDate(token.createdAt)}</td>
                <td class="px-4 py-3 text-slate-500">{formatDate(token.expiresAt)}</td>
                <td class="px-4 py-3 flex items-center gap-3">
                  {#if token.status === 'pending' || token.status === 'inProgress'}
                    <!-- Copy link -->
                    <button
                      onclick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/test/${token.value}`, token.value)}
                      class="text-xs text-[#003366] hover:underline focus:outline-none"
                      aria-label="Copiar enlace del token {token.value.slice(0, 8)}"
                      tabindex="0"
                      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/test/${token.value}`, token.value); }}
                    >
                      {copiedToken === token.value ? '¡Copiado!' : 'Copiar enlace'}
                    </button>
                    <!-- Revoke -->
                    <form
                      method="POST"
                      action="?/revokeToken"
                      use:enhance={() => {
                        revokingToken = token.value;
                        return async ({ result, update }) => {
                          revokingToken = null;
                          if (result.type === 'success') {
                            await invalidate('app:tokens');
                          } else {
                            await update();
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="tokenValue" value={token.value} />
                      <button
                        type="submit"
                        disabled={revokingToken === token.value}
                        class="text-xs text-red-500 hover:underline focus:outline-none
                               disabled:opacity-50"
                        aria-label="Revocar token {token.value.slice(0, 8)}"
                        tabindex="0"
                        onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLButtonElement).form?.requestSubmit(); }}
                      >
                        {revokingToken === token.value ? 'Revocando…' : 'Revocar'}
                      </button>
                    </form>
                  {:else}
                    <span class="text-xs text-slate-300">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
