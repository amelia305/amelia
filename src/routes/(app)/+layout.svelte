<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  const { data, children }: { data: LayoutData; children: Snippet } = $props();

  let loggingOut = $state(false);

  async function handleLogout() {
    loggingOut = true;
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } finally {
      window.location.href = '/login';
    }
  }
</script>

<div class="min-h-screen bg-slate-50 flex flex-col">
  <!-- Top bar -->
  <header class="bg-[#003366] text-white shadow-md flex-shrink-0">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span class="font-bold text-base tracking-tight">DSME-Corp</span>
      </div>

      <nav class="hidden sm:flex items-center gap-1" aria-label="Navegación principal">
        <a
          href="/dashboard"
          class="px-3 py-1.5 rounded-md text-sm text-blue-100 hover:bg-blue-800 transition-colors"
        >
          Dashboard
        </a>
        <a
          href="/empleados"
          class="px-3 py-1.5 rounded-md text-sm text-blue-100 hover:bg-blue-800 transition-colors"
        >
          Empleados
        </a>
        <a
          href="/reportes"
          class="px-3 py-1.5 rounded-md text-sm text-blue-100 hover:bg-blue-800 transition-colors"
        >
          Reportes
        </a>
      </nav>

      <div class="flex items-center gap-3">
        <span class="hidden sm:block text-xs text-blue-200 truncate max-w-[180px]">
          {data.user.email ?? ''}
        </span>
        <button
          onclick={handleLogout}
          disabled={loggingOut}
          class="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-800 hover:bg-blue-700
                 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2
                 focus:ring-offset-[#003366] disabled:opacity-50 transition-colors"
          aria-label="Cerrar sesión"
        >
          {loggingOut ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </div>
  </header>

  <!-- Page content -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>
</div>
