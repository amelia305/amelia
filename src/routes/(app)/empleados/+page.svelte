<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import type { PageData, ActionData } from './$types';
  import type { Role } from '$lib/types';
  import SkeletonRow from '$lib/components/SkeletonRow.svelte';

  const { data, form }: { data: PageData; form: ActionData } = $props();

  const ROLE_LABELS: Record<Role, string> = {
    executive: 'Alta Dirección',
    middleManagement: 'Mandos Medios',
    operational: 'Operativos',
  };

  const ROLES: Role[] = ['executive', 'middleManagement', 'operational'];

  let showForm = $state(false);
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Empleados — DSME-Corp</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-[#003366]">Empleados</h1>
      <p class="text-slate-500 mt-1">Gestione los empleados y sus tokens de evaluación.</p>
    </div>
    <button
      onclick={() => (showForm = !showForm)}
      class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003366] text-white
             text-sm font-semibold hover:bg-[#002244] focus:outline-none focus:ring-2
             focus:ring-offset-2 focus:ring-[#003366] transition-colors"
      aria-label="Agregar empleado"
      aria-expanded={showForm}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Agregar empleado
    </button>
  </div>

  <!-- Create employee form -->
  {#if showForm}
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-4">Nuevo empleado</h2>

      {#if form && 'error' in form && form.error}
        <div role="alert" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {form.error}
        </div>
      {/if}

      <form
        method="POST"
        action="?/createEmployee"
        use:enhance={() => {
          submitting = true;
          return async ({ result, update }) => {
            submitting = false;
            if (result.type === 'success') {
              showForm = false;
              await invalidate('app:employees');
            } else {
              await update();
            }
          };
        }}
        class="grid grid-cols-1 sm:grid-cols-3 gap-4"
        novalidate
      >
        <div>
          <label for="name" class="block text-sm font-medium text-slate-700 mb-1">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          />
          {#if form && 'fieldErrors' in form && form.fieldErrors?.name}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.name[0]}</p>
          {/if}
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-slate-700 mb-1">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          />
          {#if form && 'fieldErrors' in form && form.fieldErrors?.email}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.email[0]}</p>
          {/if}
        </div>

        <div>
          <label for="role" class="block text-sm font-medium text-slate-700 mb-1">
            Rol
          </label>
          <select
            id="role"
            name="role"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          >
            <option value="">Seleccionar…</option>
            {#each ROLES as r (r)}
              <option value={r}>{ROLE_LABELS[r]}</option>
            {/each}
          </select>
          {#if form && 'fieldErrors' in form && form.fieldErrors?.role}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.role[0]}</p>
          {/if}
        </div>

        <div>
          <label for="nationalId" class="block text-sm font-medium text-slate-700 mb-1">
            Cédula / ID
          </label>
          <input
            id="nationalId"
            name="nationalId"
            type="text"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          />
          {#if form && 'fieldErrors' in form && form.fieldErrors?.nationalId}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.nationalId[0]}</p>
          {/if}
        </div>

        <div>
          <label for="birthDate" class="block text-sm font-medium text-slate-700 mb-1">
            Fecha de nacimiento
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          />
          {#if form && 'fieldErrors' in form && form.fieldErrors?.birthDate}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.birthDate[0]}</p>
          {/if}
        </div>

        <div>
          <label for="gender" class="block text-sm font-medium text-slate-700 mb-1">
            Género
          </label>
          <select
            id="gender"
            name="gender"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          >
            <option value="">Seleccionar…</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
          </select>
          {#if form && 'fieldErrors' in form && form.fieldErrors?.gender}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.gender[0]}</p>
          {/if}
        </div>

        <div>
          <label for="tenureMonths" class="block text-sm font-medium text-slate-700 mb-1">
            Antigüedad (meses)
          </label>
          <input
            id="tenureMonths"
            name="tenureMonths"
            type="number"
            min="0"
            required
            disabled={submitting}
            class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                   focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                   disabled:bg-slate-50"
          />
          {#if form && 'fieldErrors' in form && form.fieldErrors?.tenureMonths}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.tenureMonths[0]}</p>
          {/if}
        </div>

        <div class="sm:col-span-3 flex gap-3 justify-end">
          <button
            type="button"
            onclick={() => (showForm = false)}
            class="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600
                   hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="px-4 py-2 rounded-lg bg-[#003366] text-white text-sm font-semibold
                   hover:bg-[#002244] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Employee list -->
  {#await data.employees}
    <!-- Skeleton pending state -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold">Nombre</th>
              <th class="px-4 py-3 font-semibold">Correo</th>
              <th class="px-4 py-3 font-semibold">Rol</th>
              <th class="px-4 py-3 font-semibold">Token activo</th>
              <th class="px-4 py-3 font-semibold sr-only">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each [1, 2, 3, 4, 5] as i (i)}
              <tr class="border-t border-slate-100">
                <SkeletonRow cols={5} />
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:then employees}
    {#if employees.length === 0}
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <p class="text-slate-500 text-sm">No hay empleados registrados. Agregue el primero.</p>
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
                <th class="px-4 py-3 font-semibold">Token activo</th>
                <th class="px-4 py-3 font-semibold sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each employees as emp (emp.id)}
                <tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors
                           {emp.archived ? 'opacity-50' : ''}">
                  <td class="px-4 py-3 font-medium text-slate-800">
                    <a
                      href="/empleados/{emp.id}"
                      class="hover:text-[#003366] hover:underline"
                      aria-label="Ver detalle de {emp.name}"
                    >
                      {emp.name}
                    </a>
                    {#if emp.archived}
                      <span class="ml-2 text-xs text-slate-400 font-normal">(archivado)</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-slate-500">{emp.email}</td>
                  <td class="px-4 py-3 text-slate-600">{ROLE_LABELS[emp.role]}</td>
                  <td class="px-4 py-3">
                    {#if emp.activeToken}
                      <span class="inline-block text-xs font-semibold bg-amber-50 text-amber-700
                                   border border-amber-200 px-2 py-0.5 rounded font-mono">
                        {emp.activeToken.slice(0, 8)}…
                      </span>
                    {:else}
                      <span class="text-slate-300 text-xs">—</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 flex items-center gap-2">
                    <a
                      href="/empleados/{emp.id}"
                      class="text-xs text-[#003366] hover:underline"
                      aria-label="Gestionar tokens de {emp.name}"
                    >
                      Gestionar
                    </a>
                    {#if !emp.archived}
                      <form
                        method="POST"
                        action="?/archiveEmployee"
                        use:enhance={() => async ({ result, update }) => {
                          if (result.type === 'success') await invalidate('app:employees');
                          else await update();
                        }}
                      >
                        <input type="hidden" name="employeeId" value={emp.id} />
                        <button
                          type="submit"
                          class="text-xs text-red-500 hover:underline focus:outline-none"
                          aria-label="Archivar {emp.name}"
                          onclick={(e) => {
                            if (!confirm(`¿Archivar a ${emp.name}? Esta acción puede deshacerse contactando al soporte.`)) {
                              e.preventDefault();
                            }
                          }}
                          onkeydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              if (!confirm(`¿Archivar a ${emp.name}?`)) e.preventDefault();
                            }
                          }}
                          tabindex="0"
                        >
                          Archivar
                        </button>
                      </form>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Show archived toggle -->
    <div class="text-right">
      <a
        href={employees.some((e) => e.archived) || new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('showArchived') === '1'
          ? '/empleados'
          : '/empleados?showArchived=1'}
        class="text-xs text-slate-400 hover:text-slate-600 hover:underline"
      >
        Mostrar / ocultar archivados
      </a>
    </div>
  {:catch}
    <p class="text-red-600 text-sm">Error al cargar empleados. Recargue la página.</p>
  {/await}
</div>
