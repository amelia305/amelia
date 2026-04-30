<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import type { Answer, Question, Role } from '$lib/types';
  import { RoleSchema } from '$lib/types';
  import { PILLAR_INTROS } from '$lib/instrument/seed';

  const { data } = $props<{ data: PageData }>();
  const questions = $derived(data.questions);
  const pillarNames = $derived(data.pillarNames);
  const partialAnswers = $derived(data.partialAnswers);
  const role: Role = untrack(() => RoleSchema.parse(data.role));

  type MessageKind = 'amelia' | 'user';

  interface ChatMessage {
    id: number;
    kind: MessageKind;
    html: string;
    pillarTag?: string;
  }

  interface CheckpointEntry {
    id: number;
    pillar: 1 | 2 | 3 | 4 | 5 | 6;
    pillarTag: string;
    introHtml: string;
  }

  type ChatEntry =
    | { type: 'message'; entry: ChatMessage }
    | { type: 'checkpoint'; entry: CheckpointEntry };

  const TOTAL_QUESTIONS = questions.length;

  const SCALE_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'Totalmente en desacuerdo',
    2: 'En desacuerdo',
    3: 'Neutral',
    4: 'De acuerdo',
    5: 'Totalmente de acuerdo',
  };

  const SCALE_SELECTED_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'sel-1',
    2: 'sel-2',
    3: 'sel-3',
    4: 'sel-4',
    5: 'sel-5',
  };

  const SCALE_VALUES = [1, 2, 3, 4, 5] as const;
  type ScaleValue = 1 | 2 | 3 | 4 | 5;

  function isScaleValue(n: number): n is ScaleValue {
    return n >= 1 && n <= 5;
  }

  function pillarForIndex(index: number): 1 | 2 | 3 | 4 | 5 | 6 {
    return (Math.floor(index / 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  function pillarNameForQuestion(question: Question): string {
    return pillarNames[question.pillar];
  }

  let nextEntryId = $state(0);
  let chatEntries = $state<ChatEntry[]>([]);
  let answers = $state<Answer[]>([...partialAnswers]);
  let currentIndex = $state(partialAnswers.length);
  let typingVisible = $state(false);
  let submitting = $state(false);
  // When non-null, a checkpoint is the active UI — digit keys are no-ops.
  let pendingCheckpointId = $state<number | null>(null);

  let chatWrapEl = $state<HTMLDivElement | null>(null);
  let submitFormEl = $state<HTMLFormElement | null>(null);
  let answersJson = $state('');

  const progressPct = $derived(Math.round((answers.length / TOTAL_QUESTIONS) * 100));
  const currentQuestion = $derived(questions[currentIndex]);
  const allAnswered = $derived(currentIndex >= TOTAL_QUESTIONS);
  const checkpointActive = $derived(pendingCheckpointId !== null);
  const inputDisabled = $derived(typingVisible || allAnswered || submitting || checkpointActive);

  function pushMessage(kind: MessageKind, html: string, pillarTag?: string): void {
    chatEntries = [
      ...chatEntries,
      { type: 'message', entry: { id: nextEntryId++, kind, html, pillarTag } },
    ];
  }

  function pushCheckpoint(pillar: 1 | 2 | 3 | 4 | 5 | 6): void {
    const id = nextEntryId++;
    chatEntries = [
      ...chatEntries,
      {
        type: 'checkpoint',
        entry: {
          id,
          pillar,
          pillarTag: `Pilar ${pillar} · ${pillarNames[pillar]}`,
          introHtml: PILLAR_INTROS[role][pillar],
        },
      },
    ];
    pendingCheckpointId = id;
  }

  function scrollToBottom(): void {
    if (!chatWrapEl) return;
    setTimeout(() => {
      chatWrapEl?.scrollTo({ top: chatWrapEl.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  $effect(() => {
    void chatEntries.length;
    void typingVisible;
    scrollToBottom();
  });

  function advanceFromCheckpoint(): void {
    if (pendingCheckpointId === null) return;
    pendingCheckpointId = null;
    setTimeout(() => revealQuestion(currentIndex), 30);
  }

  function revealQuestion(index: number): void {
    const question = questions[index];
    if (!question) return;

    typingVisible = true;
    setTimeout(() => {
      typingVisible = false;
      pushMessage('amelia', question.text);
    }, 30);
  }

  function finishAssessment(finalAnswers: readonly Answer[]): void {
    typingVisible = true;
    setTimeout(() => {
      typingVisible = false;
      pushMessage('amelia', '¡Listo! Completaste todas las preguntas. <strong>Enviando tu evaluación…</strong>');
      submitting = true;
      answersJson = JSON.stringify(finalAnswers);
      setTimeout(() => submitFormEl?.requestSubmit(), 50);
    }, 30);
  }

  function saveProgressInBackground(completedPillar: 1 | 2 | 3 | 4 | 5 | 6, pillarAnswers: readonly Answer[]): void {
    const body = new FormData();
    body.set('payload', JSON.stringify({ pillar: completedPillar, answers: pillarAnswers }));
    fetch('?/saveProgress', { method: 'POST', body }).catch(() => {
      console.log('saveProgress failed silently', completedPillar);
    });
  }

  function recordAnswer(value: ScaleValue): void {
    if (inputDisabled) return;
    const question = currentQuestion;
    if (!question) return;

    pushMessage('user', `${value} — ${SCALE_LABEL[value]}`);
    const updatedAnswers = [...answers, { questionId: question.id, value }];
    answers = updatedAnswers;
    currentIndex += 1;

    if (updatedAnswers.length % 7 === 0 && updatedAnswers.length < 42) {
      // Save only the 7 answers for the just-completed pillar.
      const completedPillar = pillarForIndex(updatedAnswers.length - 1);
      const pillarStart = updatedAnswers.length - 7;
      const pillarAnswers = updatedAnswers.slice(pillarStart);
      saveProgressInBackground(completedPillar, pillarAnswers);
    }

    const nextQuestion = questions[currentIndex];
    if (nextQuestion !== undefined) {
      // If crossing into a new pillar, show checkpoint first.
      const justAnswered = questions[currentIndex - 1];
      if (justAnswered && nextQuestion.pillar !== justAnswered.pillar) {
        setTimeout(() => pushCheckpoint(nextQuestion.pillar as 1 | 2 | 3 | 4 | 5 | 6), 30);
      } else {
        setTimeout(() => revealQuestion(currentIndex), 30);
      }
    } else {
      setTimeout(() => finishAssessment(updatedAnswers), 30);
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (checkpointActive) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advanceFromCheckpoint();
      }
      // Digit keys are no-ops while checkpoint is active.
      return;
    }
    if (inputDisabled) return;
    const parsed = parseInt(e.key, 10);
    if (isScaleValue(parsed)) {
      recordAnswer(parsed);
    }
  }

  function handleScaleButtonKeydown(e: KeyboardEvent, value: ScaleValue): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      recordAnswer(value);
    }
  }

  $effect(() => {
    untrack(() => {
      pushMessage(
        'amelia',
        'Hola, soy <strong>Amelia</strong>. Voy a hacerte una serie de preguntas. ' +
          'Responde con honestidad — no hay respuestas correctas o incorrectas.<br/><br/>' +
          '<em>Escala: 1 = Totalmente en desacuerdo → 5 = Totalmente de acuerdo</em>',
      );

      if (partialAnswers.length > 0) {
        pushMessage(
          'amelia',
          `Bienvenido/a de vuelta. Continuamos desde la pregunta ${partialAnswers.length + 1} de ${TOTAL_QUESTIONS}.`,
        );
      }

      // Resume logic:
      // - partialAnswers.length is a multiple of 7 → user is at the START of a new pillar.
      //   Show that pillar's checkpoint before any questions.
      // - partialAnswers.length is NOT a multiple of 7 → user is mid-pillar.
      //   Resume at next unanswered question without showing a checkpoint.
      const resumeIndex = partialAnswers.length;
      const startingPillar = pillarForIndex(resumeIndex);
      const atPillarBoundary = resumeIndex % 7 === 0;

      if (atPillarBoundary) {
        // Show checkpoint for the pillar we're about to enter (delay slightly after intro).
        setTimeout(() => pushCheckpoint(startingPillar), 600);
      } else {
        setTimeout(() => revealQuestion(resumeIndex), 600);
      }
    });
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<form
  bind:this={submitFormEl}
  method="POST"
  action="?/submitTest"
  aria-hidden="true"
  style="display:none"
>
  <input type="hidden" name="answers" bind:value={answersJson} />
</form>

<svelte:head>
  <title>Evaluación · Amelia</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<header class="top-bar">
  <div class="top-bar-logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 0 1-7 7A7 7 0 0 1 5 12c0-2.72 1.55-5.08 3.58-6.41L7.17 4.17A8.93 8.93 0 0 0 3 12a9 9 0 0 0 9 9 9 9 0 0 0 9-9 8.93 8.93 0 0 0-3.17-6.83z" />
      </svg>
    </div>
    <span class="logo-name">Amelia</span>
  </div>

  <div class="progress-wrap" aria-label="Progreso de la evaluación">
    <div
      class="progress-bar-outer"
      role="progressbar"
      aria-valuenow={progressPct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div class="progress-bar-inner" style="width: {progressPct}%"></div>
    </div>
    <span class="progress-label">{answers.length}/{TOTAL_QUESTIONS}</span>
  </div>
</header>

<div class="chat-wrap" bind:this={chatWrapEl}>
  {#each chatEntries as item (item.entry.id)}
    {#if item.type === 'message'}
      {#if item.entry.kind === 'amelia'}
        <div class="bubble-row">
          <div class="avatar-bubble amelia-av" aria-hidden="true">A</div>
          <div class="bubble amelia">
            {#if item.entry.pillarTag}
              <div class="pilar-tag">{item.entry.pillarTag}</div>
            {/if}
            {@html item.entry.html}
          </div>
        </div>
      {:else}
        <div class="bubble-row user">
          <div class="avatar-bubble user-av" aria-hidden="true">Tú</div>
          <div class="bubble user">{item.entry.html}</div>
        </div>
      {/if}
    {:else}
      <div class="bubble-row checkpoint-row" role="region" aria-label={item.entry.pillarTag}>
        <div class="avatar-bubble amelia-av" aria-hidden="true">A</div>
        <div class="bubble amelia checkpoint-bubble">
          <div class="pilar-tag">{item.entry.pillarTag}</div>
          {@html item.entry.introHtml}
        </div>
      </div>
    {/if}
  {/each}

  {#if typingVisible}
    <div class="bubble-row" role="status" aria-label="Amelia está escribiendo">
      <div class="avatar-bubble amelia-av" aria-hidden="true">A</div>
      <div class="bubble amelia typing-bubble">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  {/if}
</div>

<div class="input-dock">
  <div class="input-inner">
    {#if submitting}
      <div class="status-message" role="status" aria-live="polite">
        Enviando evaluación…
      </div>
    {:else if allAnswered}
      <div class="status-message" role="status" aria-live="polite">
        Procesando…
      </div>
    {:else if checkpointActive}
      <button
        type="button"
        class="btn-continue"
        onclick={advanceFromCheckpoint}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceFromCheckpoint(); } }}
        tabindex={0}
        aria-label="Continuar al siguiente pilar"
      >
        Continuar →
      </button>
      <p class="shortcut-hint">Presiona Enter o Espacio para continuar</p>
    {:else}
      <div
        class="scale-row"
        class:waiting={typingVisible}
        role="group"
        aria-label="Selecciona tu respuesta del 1 al 5"
      >
        <span class="scale-label">En desacuerdo</span>
        <div class="scale-btns">
          {#each SCALE_VALUES as scaleValue (scaleValue)}
            <button
              type="button"
              class="scale-btn {!typingVisible && currentQuestion && answers[currentIndex]?.value === scaleValue ? SCALE_SELECTED_CLASS[scaleValue] : ''}"
              onclick={() => recordAnswer(scaleValue)}
              onkeydown={(e) => handleScaleButtonKeydown(e, scaleValue)}
              tabindex={typingVisible ? -1 : 0}
              aria-label="Opción {scaleValue}: {SCALE_LABEL[scaleValue]}"
              disabled={typingVisible}
            >
              {scaleValue}
            </button>
          {/each}
        </div>
        <span class="scale-label">De acuerdo</span>
      </div>
      <p class="shortcut-hint">Presiona 1–5 en tu teclado para responder</p>
    {/if}
  </div>
</div>

<style>
  :global(:root) {
    --blue:   #1a5fa8;
    --blue-d: #134a87;
    --gold:   #f5a623;
    --bg:     #f5f7fa;
    --white:  #ffffff;
    --text:   #1c2a3a;
    --muted:  #6b7a8d;
    --border: #dde3ec;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.6;
  }

  .top-bar {
    background: var(--white);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .top-bar-logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    background: var(--blue);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-icon svg {
    width: 18px;
    height: 18px;
    fill: white;
  }

  .logo-name {
    font-size: 18px;
    font-weight: 800;
    color: var(--blue);
    letter-spacing: -0.5px;
  }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    max-width: 300px;
    margin: 0 auto;
  }

  .progress-bar-outer {
    flex: 1;
    height: 6px;
    background: var(--bg);
    border-radius: 100px;
    overflow: hidden;
  }

  .progress-bar-inner {
    height: 100%;
    background: linear-gradient(90deg, var(--blue), var(--gold));
    border-radius: 100px;
    transition: width 0.4s ease;
  }

  .progress-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }

  .chat-wrap {
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 32px 24px 160px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: calc(100vh - 64px);
    overflow-y: auto;
  }

  .bubble-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    animation: fadeUp 0.35s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .bubble-row.user {
    flex-direction: row-reverse;
  }

  .avatar-bubble {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .avatar-bubble.amelia-av {
    background: linear-gradient(135deg, var(--blue), var(--gold));
    color: white;
    font-size: 16px;
  }

  .avatar-bubble.user-av {
    background: var(--border);
    color: var(--muted);
    font-size: 10px;
  }

  .bubble {
    max-width: 78%;
    padding: 14px 18px;
    border-radius: 18px;
    font-size: 15px;
    line-height: 1.6;
  }

  .bubble.amelia {
    background: var(--white);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,.06);
    color: var(--text);
  }

  .bubble.user {
    background: var(--blue);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 2px 10px rgba(26,95,168,.2);
  }

  .pilar-tag {
    display: inline-block;
    background: rgba(26,95,168,.1);
    color: var(--blue);
    border-radius: 100px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .typing-bubble {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 14px 18px;
  }

  .typing-bubble span {
    width: 7px;
    height: 7px;
    background: var(--muted);
    border-radius: 50%;
    display: inline-block;
    animation: bounce 0.9s infinite ease-in-out;
  }

  .typing-bubble span:nth-child(2) { animation-delay: 0.15s; }
  .typing-bubble span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30%            { transform: translateY(-6px); }
  }

  .input-dock {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(245,247,250,.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
    padding: 16px 24px 20px;
    z-index: 50;
  }

  .input-inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .scale-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .scale-row.waiting {
    opacity: 0.4;
    pointer-events: none;
  }

  .scale-label {
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
  }

  .scale-btns {
    display: flex;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  .scale-btn {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    background: var(--white);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text);
    font-family: inherit;
  }

  .scale-btn:hover:not(:disabled) {
    border-color: var(--blue);
    color: var(--blue);
  }

  .scale-btn:disabled {
    cursor: default;
  }

  .scale-btn.sel-1 { background: #fdecea; border-color: #e74c3c; color: #e74c3c; }
  .scale-btn.sel-2 { background: #fef0e6; border-color: #e67e22; color: #e67e22; }
  .scale-btn.sel-3 { background: #fef9e7; border-color: #f5a623; color: #b87a0a; }
  .scale-btn.sel-4 { background: #eafaf1; border-color: #27ae60; color: #27ae60; }
  .scale-btn.sel-5 { background: #e8f4fd; border-color: #1a5fa8; color: #1a5fa8; }

  .btn-continue {
    width: 100%;
    background: var(--blue);
    color: white;
    border: none;
    border-radius: 100px;
    padding: 15px 38px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 16px rgba(26,95,168,.3);
    letter-spacing: 0.1px;
    font-family: inherit;
  }

  .btn-continue:hover {
    background: var(--blue-d);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(26,95,168,.4);
  }

  .btn-continue:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .shortcut-hint {
    font-size: 11px;
    color: var(--muted);
    text-align: center;
  }

  .status-message {
    text-align: center;
    color: var(--muted);
    font-size: 14px;
    padding: 12px;
  }

  @media (max-width: 540px) {
    .scale-btns { gap: 4px; }
    .scale-btn  { width: 40px; height: 40px; font-size: 13px; }
    .chat-wrap  { padding: 20px 16px 160px; }
  }
</style>
