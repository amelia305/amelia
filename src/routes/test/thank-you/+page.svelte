<svelte:head>
  <title>Evaluación completada · Amelia</title>
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
</header>

<main class="page-center">
  <div class="card">
    <div class="check-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <h1>¡Gracias por completar la evaluación!</h1>
    <p>Tus respuestas han sido registradas. Los resultados serán compartidos contigo por tu empresa.</p>
  </div>
</main>

<style>
  :global(:root) {
    --blue:   #1a5fa8;
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

  .page-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 64px);
    padding: 32px 24px;
  }

  .card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(26, 95, 168, 0.1);
    padding: 48px 40px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .check-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--blue), var(--gold));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .check-icon svg {
    width: 32px;
    height: 32px;
    stroke: white;
  }

  h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.3;
  }

  p {
    font-size: 15px;
    color: var(--muted);
    line-height: 1.7;
  }

  @media (max-width: 540px) {
    .card {
      padding: 36px 24px;
    }

    h1 {
      font-size: 19px;
    }
  }
</style>
