<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body, .wrap {
    font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
    color: #1e3330;
    background: transparent;
  }

  .wrap { max-width: 680px; padding: 2rem 0 3rem; }

  .section-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5a6b65;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    margin-bottom: 0.75rem;
  }

  .divider {
    border: none;
    border-top: 0.5px solid rgba(30,51,48,0.12);
    margin: 2rem 0;
  }

  /* ── LOGO ── */
  .logo-stage {
    background: #f2f4ef;
    border-radius: 12px;
    border: 0.5px solid rgba(30,51,48,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    margin-bottom: 1rem;
  }

  .logo-lockup {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-mark {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .logo-wordmark {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .logo-name {
    font-family: 'Inter', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #2d4a42;
    line-height: 1;
  }

  .logo-sub {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5a6b65;
  }

  .logo-variants {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 1rem;
  }

  .logo-variant {
    border-radius: 8px;
    border: 0.5px solid rgba(30,51,48,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem;
    flex-direction: column;
    gap: 12px;
  }

  .logo-variant.on-light { background: #f8faf6; }
  .logo-variant.on-dark  { background: #2d4a42; }
  .logo-variant.on-white { background: #ffffff; }

  .variant-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5a6b65;
    font-family: 'JetBrains Mono', monospace;
  }

  .logo-variant.on-dark .variant-label { color: rgba(248,250,246,0.5); }

  .logo-stage-inner { text-align: center; }

  .logo-stage-name {
    font-family: 'Inter', sans-serif;
    font-size: 42px;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: #1e3330;
    line-height: 1;
  }

  .logo-stage-sub {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a6b65;
    margin-top: 12px;
  }

  .variant-wordmark {
    font-family: 'Inter', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: #1e3330;
    line-height: 1;
  }

  .variant-wordmark.inverse { color: #f8faf6; }

  .app-icon-mark {
    width: 42px;
    height: 42px;
    border-radius: 8px;
    background: #2d4a42;
    color: #f8faf6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }

  .brand-note {
    margin-top: 1rem;
    padding: 1rem;
    background: #eef1ea;
    border: 0.5px solid rgba(30,51,48,0.12);
    border-radius: 8px;
  }

  .brand-note-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5a6b65;
    margin-bottom: 6px;
  }

  .brand-note-body {
    font-size: 14px;
    color: #1e3330;
    line-height: 1.6;
  }

  /* ── COLORS ── */
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
    margin-bottom: 1rem;
  }

  .swatch {
    border-radius: 8px;
    overflow: hidden;
    border: 0.5px solid rgba(30,51,48,0.12);
  }

  .swatch-color {
    height: 56px;
  }

  .swatch-info {
    padding: 8px 10px;
    background: #ffffff;
  }

  .swatch-name {
    font-size: 12px;
    font-weight: 500;
    color: #1e3330;
    display: block;
    margin-bottom: 2px;
  }

  .swatch-hex {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #5a6b65;
  }

  .swatch-role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5a6b65;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 2px;
    display: block;
  }

  /* ── TYPOGRAPHY ── */
  .type-row {
    border-bottom: 0.5px solid rgba(30,51,48,0.12);
    padding: 1rem 0;
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 1rem;
    align-items: start;
  }

  .type-row:last-child { border-bottom: none; }

  .type-meta { padding-top: 4px; }

  .type-role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5a6b65;
    display: block;
    margin-bottom: 4px;
  }

  .type-spec {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #5a6b65;
    line-height: 1.6;
  }

  .type-sample-h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; color: #1e3330; }
  .type-sample-h2 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: #1e3330; }
  .type-sample-h3 { font-size: 16px; font-weight: 600; color: #1e3330; }
  .type-sample-body { font-size: 16px; font-weight: 400; line-height: 1.6; color: #1e3330; }
  .type-sample-small { font-size: 14px; font-weight: 400; line-height: 1.5; color: #5a6b65; }
  .type-sample-mono {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5a6b65;
  }

  /* ── SPACING / RADIUS ── */
  .token-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .token-card {
    background: #ffffff;
    border: 0.5px solid rgba(30,51,48,0.12);
    border-radius: 8px;
    padding: 1rem;
  }

  .token-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #4a7c6f;
    margin-bottom: 6px;
  }

  .token-value {
    font-size: 13px;
    font-weight: 500;
    color: #1e3330;
    margin-bottom: 4px;
  }

  .token-desc {
    font-size: 12px;
    color: #5a6b65;
  }

  /* ── DO / DON'T ── */
  .rules-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .rule-card {
    border-radius: 8px;
    padding: 1rem;
    border: 0.5px solid rgba(30,51,48,0.12);
  }

  .rule-card.do   { background: #eef1ea; border-left: 3px solid #2d4a42; }
  .rule-card.dont { background: #fef2ee; border-left: 3px solid #c44d3a; }

  .rule-head {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .rule-card.do   .rule-head { color: #2d4a42; }
  .rule-card.dont .rule-head { color: #c44d3a; }

  .rule-list {
    list-style: none;
    font-size: 13px;
    color: #1e3330;
    line-height: 1.7;
  }

  /* ── APP URL ── */
  .url-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #eef1ea;
    border: 0.5px solid rgba(30,51,48,0.12);
    border-radius: 6px;
    padding: 4px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #2d4a42;
    margin-top: 0.5rem;
  }
</style>

<div class="wrap">
  <p class="section-label">Logotype</p>
  <div class="logo-stage">
    <div class="logo-stage-inner">
      <div class="logo-stage-name">Peggy</div>
      <div class="logo-stage-sub">Research Assistant</div>
    </div>
  </div>
  <div class="logo-variants">
    <div class="logo-variant on-light">
      <div class="variant-wordmark">Peggy</div>
      <span class="variant-label">Primary wordmark</span>
    </div>
    <div class="logo-variant on-dark">
      <div class="variant-wordmark inverse">Peggy</div>
      <span class="variant-label">Inverse</span>
    </div>
    <div class="logo-variant on-white">
      <div class="app-icon-mark">P</div>
      <span class="variant-label">App icon / favicon</span>
    </div>
  </div>
  <div class="brand-note">
    <div class="brand-note-label">Internal brand note</div>
    <div class="brand-note-body">
      <strong>Peggy</strong> = Peer-reviewed Evidence Gathering, Grounding &amp; Yielding knowledge. This acronym is for internal documentation and the About section only and should not accompany the public logo.
    </div>
  </div>
  <div class="url-chip">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
    peggy.ra.vercel.app
  </div>
  <hr class="divider"/>
  <p class="section-label">Color palette</p>
  <div class="color-grid">
    <div class="swatch">
      <div class="swatch-color" style="background:#2d4a42;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Forest</span>
        <span class="swatch-hex">#2d4a42</span>
        <span class="swatch-role">Primary · buttons · headings</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#4a7c6f;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Sage</span>
        <span class="swatch-hex">#4a7c6f</span>
        <span class="swatch-role">Accent · links · hover states</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#1e3330;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Deep fern</span>
        <span class="swatch-hex">#1e3330</span>
        <span class="swatch-role">Foreground · body text</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#f2f4ef;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Linen</span>
        <span class="swatch-hex">#f2f4ef</span>
        <span class="swatch-role">App background</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#f8faf6;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Frost</span>
        <span class="swatch-hex">#f8faf6</span>
        <span class="swatch-role">Surface · sidebar</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#eef1ea;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Mist</span>
        <span class="swatch-hex">#eef1ea</span>
        <span class="swatch-role">Muted backgrounds · chips</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#c49a3a;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Amber</span>
        <span class="swatch-hex">#c49a3a</span>
        <span class="swatch-role">Warning · highlights</span>
      </div>
    </div>
    <div class="swatch">
      <div class="swatch-color" style="background:#c44d3a;"></div>
      <div class="swatch-info">
        <span class="swatch-name">Terracotta</span>
        <span class="swatch-hex">#c44d3a</span>
        <span class="swatch-role">Destructive · errors</span>
      </div>
    </div>
  </div>
  <hr class="divider"/>
  <p class="section-label">Typography</p>
  <div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Display</span>
        <span class="type-spec">Inter 600<br/>36px / −0.02em</span>
      </div>
      <div class="type-sample-h1">Research that cites itself.</div>
    </div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Heading 2</span>
        <span class="type-spec">Inter 600<br/>18px / −0.01em</span>
      </div>
      <div class="type-sample-h2">Gap analysis</div>
    </div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Heading 3</span>
        <span class="type-spec">Inter 600<br/>16px</span>
      </div>
      <div class="type-sample-h3">Ingested literature</div>
    </div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Body</span>
        <span class="type-spec">Inter 400<br/>16px / 1.6</span>
      </div>
      <div class="type-sample-body">Every answer Peggy gives is grounded in your corpus — not generated from thin air.</div>
    </div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Caption</span>
        <span class="type-spec">Inter 400<br/>14px / 1.5</span>
      </div>
      <div class="type-sample-small">3 papers · last ingested 2 hours ago</div>
    </div>
    <div class="type-row">
      <div class="type-meta">
        <span class="type-role">Mono / eyebrow</span>
        <span class="type-spec">JetBrains Mono 500<br/>10px / 0.12em</span>
      </div>
      <div class="type-sample-mono">Literature corpus</div>
    </div>
  </div>
  <hr class="divider"/>
  <p class="section-label">Tokens</p>
  <div class="token-grid">
    <div class="token-card">
      <div class="token-name">--border-radius</div>
      <div class="token-value">8px</div>
      <div class="token-desc">All controls, cards, inputs</div>
    </div>
    <div class="token-card">
      <div class="token-name">--border</div>
      <div class="token-value">rgba(30,51,48, 0.12)</div>
      <div class="token-desc">0.5px hairlines throughout</div>
    </div>
    <div class="token-card">
      <div class="token-name">--font-primary</div>
      <div class="token-value">Inter</div>
      <div class="token-desc">All UI text and headings</div>
    </div>
    <div class="token-card">
      <div class="token-name">--font-mono</div>
      <div class="token-value">JetBrains Mono</div>
      <div class="token-desc">Eyebrows, chips, code, labels</div>
    </div>
  </div>
  <hr class="divider"/>
  <p class="section-label">Logo usage</p>
  <div class="rules-grid">
    <div class="rule-card do">
      <div class="rule-head">Do</div>
      <ul class="rule-list">
        <li>Use on #f2f4ef, #f8faf6, #ffffff, or #2d4a42</li>
        <li>Maintain clear space equal to the mark height on all sides</li>
        <li>Use the Peggy wordmark as the primary brand across product and marketing</li>
        <li>Use the [P] monogram only for app icons, favicons, and compact mobile surfaces</li>
      </ul>
    </div>
    <div class="rule-card dont">
      <div class="rule-head">Don't</div>
      <ul class="rule-list">
        <li>Recolor the mark outside the palette</li>
        <li>Stretch or distort the lockup</li>
        <li>Place on low-contrast or busy backgrounds</li>
        <li>Use the wordmark without the mark at icon sizes</li>
      </ul>
    </div>
  </div>
</div>