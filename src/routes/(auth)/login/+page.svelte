<script lang="ts">
  import { auth } from '$lib/firebase';
  import { signInWithEmailAndPassword } from 'firebase/auth';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = null;
    loading = true;

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({})) as { reason?: string };
          if (body.reason === 'not_provisioned') {
            errorMsg = 'Su cuenta no tiene un rol asignado. Contacte al administrador.';
            return;
          }
        }
        errorMsg = 'No se pudo iniciar sesión. Verifique sus credenciales.';
        return;
      }

      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-email'
      ) {
        errorMsg = 'Correo o contraseña incorrectos.';
      } else {
        errorMsg = 'Ocurrió un error inesperado. Intente de nuevo.';
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Iniciar sesión — DSME-Corp</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <!-- Logo / brand -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#003366] mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
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
      </div>
      <h1 class="text-2xl font-bold text-[#003366]">DSME-Corp</h1>
      <p class="text-sm text-slate-500 mt-1">Panel de administración</p>
    </div>

    <!-- Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h2 class="text-lg font-semibold text-slate-800 mb-6">Iniciar sesión</h2>

      {#if errorMsg}
        <div
          role="alert"
          class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {errorMsg}
        </div>
      {/if}

      <form onsubmit={handleSubmit} novalidate>
        <div class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-slate-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              autocomplete="email"
              required
              disabled={loading}
              class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                     disabled:bg-slate-50 disabled:text-slate-400"
              aria-label="Correo electrónico"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              autocomplete="current-password"
              required
              disabled={loading}
              class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent
                     disabled:bg-slate-50 disabled:text-slate-400"
              aria-label="Contraseña"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          class="mt-6 w-full py-2.5 px-4 rounded-lg bg-[#003366] text-white text-sm font-semibold
                 hover:bg-[#002244] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003366]
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Iniciar sesión"
        >
          {#if loading}
            Iniciando sesión…
          {:else}
            Iniciar sesión
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>
