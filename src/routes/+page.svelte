<script lang="ts">
	import type { PageData } from './$types';
	import type { TokenStatus, Role } from '$lib/types';

	const { data }: { data: PageData } = $props();

	const STATUS_STYLES: Record<TokenStatus, string> = {
		pending: 'bg-amber-100 text-amber-800',
		inProgress: 'bg-blue-100 text-blue-800',
		completed: 'bg-green-100 text-green-800',
		expired: 'bg-red-100 text-red-800',
	};

	const STATUS_LABELS: Record<TokenStatus, string> = {
		pending: 'Pendiente',
		inProgress: 'En progreso',
		completed: 'Completado',
		expired: 'Expirado',
	};

	const ROLE_LABELS: Record<Role, string> = {
		executive: 'Alta Dirección',
		middleManagement: 'Mandos Medios',
		operational: 'Operativos',
	};

	function formatDate(date: Date): string {
		return date.toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
</script>

<svelte:head>
	<title>Amelia</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
	<h1 class="text-3xl font-bold text-[#003366]">Amelia — Tokens de Evaluación Activos</h1>
	<p class="mt-2 text-slate-500">Tokens de evaluación psicométrica disponibles.</p>

	<div class="mt-8 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200">
			<thead class="bg-slate-50">
				<tr>
					<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
						Token
					</th>
					<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
						Estado
					</th>
					<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
						Perfil
					</th>
					<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
						Creado
					</th>
					<th scope="col" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
						Expira
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#if data.tokens.length === 0}
					<tr>
						<td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">
							No hay tokens de evaluación activos en este momento.
						</td>
					</tr>
				{:else}
					{#each data.tokens as token (token.value)}
						<tr class="hover:bg-slate-50 transition-colors">
							<td class="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-700">
								<a href="/test/{token.value}">{token.value}</a>
							</td>
							<td class="whitespace-nowrap px-4 py-3">
								<span
									class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {STATUS_STYLES[token.status] ?? 'bg-slate-100 text-slate-600'}"
								>
									{STATUS_LABELS[token.status] ?? token.status}
								</span>
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
								{ROLE_LABELS[token.role] ?? token.role}
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
								{formatDate(token.createdAt)}
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
								{formatDate(token.expiresAt)}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</main>
