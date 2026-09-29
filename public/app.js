(() => {
  'use strict';

  const LIMIT_MS = 210000; // 3:30 por questão
  const STORAGE_KEY = 'ritmo-enem:session:v1';

  // ---------- Estado ----------
  // times: duração exata (ms) de cada questão concluída
  // startedAt: timestamp real (Date.now) de início da questão atual
  let state = load() || { status: 'idle', times: [], startedAt: null };
  let alerted = false;   // alarme da questão atual já disparado?
  let tickId = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sem armazenamento */ }
  }

  // ---------- Formatação ----------
  function fmt(ms, withTenths = false) {
    ms = Math.max(0, ms);
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const base = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return withTenths ? base + '.' + Math.floor((ms % 1000) / 100) : base;
  }
  function fmtSigned(ms, withTenths = false) {
    if (Math.abs(ms) < (withTenths ? 100 : 1000)) return (withTenths ? '±00:00.0' : '±00:00');
    return (ms > 0 ? '+' : '−') + fmt(Math.abs(ms), withTenths);
  }

  // ---------- Áudio ----------
  // O alarme é agendado no relógio do AudioContext, que não sofre o
  // throttling de timers quando a aba está em segundo plano.
  let audioCtx = null;
  let scheduled = [];

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function scheduleBeeps(delaySec) {
    const ctx = audioCtx;
    if (!ctx) return false;
    const t0 = ctx.currentTime + Math.max(0, delaySec);
    const nodes = [];
    // Duas séries de 3 bipes curtos e agudos
    for (let i = 0; i < 6; i++) {
      const start = t0 + i * 0.22 + (i >= 3 ? 0.35 : 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1046;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.setValueAtTime(0.25, start + 0.14);
      gain.gain.linearRampToValueAtTime(0, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
      nodes.push(osc);
    }
    return nodes;
  }

  function armAlarm(remainingMs) {
    cancelAlarm();
    if (!audioCtx || audioCtx.state === 'closed' || remainingMs <= 0) return;
    scheduled = scheduleBeeps(remainingMs / 1000) || [];
  }
  function cancelAlarm() {
    scheduled.forEach((o) => { try { o.stop(); o.disconnect(); } catch { /* já parado */ } });
    scheduled = [];
  }

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const screens = { home: $('screen-home'), train: $('screen-train'), report: $('screen-report') };
  const el = {
    qLabel: $('q-label'), timer: $('timer'), delta: $('delta'),
    barFill: $('bar-fill'), trainStats: $('train-stats'),
    cards: $('report-cards'), rows: $('report-rows'),
    badge: $('tab-badge'),
  };

  function show(name) {
    Object.entries(screens).forEach(([k, s]) => { s.hidden = k !== name; });
    if (name !== 'train') {
      document.body.classList.remove('over', 'flash');
      el.badge.hidden = true;
    }
  }

  // ---------- Treino ----------
  function currentElapsed() {
    return state.startedAt ? Date.now() - state.startedAt : 0;
  }

  function startQuestion(now) {
    state.startedAt = now;
    alerted = false;
    document.body.classList.remove('over', 'flash');
    save();
    armAlarm(LIMIT_MS);
    render();
  }

  function startExam() {
    ensureAudio();
    state = { status: 'running', times: [], startedAt: null };
    show('train');
    startQuestion(Date.now());
    startTicking();
  }

  function nextQuestion() {
    if (state.status !== 'running') return;
    ensureAudio();
    const now = Date.now();
    state.times.push(now - state.startedAt);
    startQuestion(now);
  }

  function finishExam() {
    if (state.status !== 'running') return;
    const now = Date.now();
    state.times.push(now - state.startedAt);
    state.startedAt = null;
    state.status = 'done';
    save();
    cancelAlarm();
    stopTicking();
    renderReport();
    show('report');
    document.title = 'Relatório · Ritmo ENEM';
  }

  function restart() {
    if (state.times.length || state.status === 'running') {
      if (!confirm('Reiniciar o treino? Todos os tempos registrados serão apagados.')) return;
    }
    cancelAlarm();
    stopTicking();
    state = { status: 'idle', times: [], startedAt: null };
    save();
    show('home');
    document.title = 'Ritmo ENEM · Cronômetro por questão';
  }

  function startTicking() {
    stopTicking();
    tickId = setInterval(render, 100);
  }
  function stopTicking() {
    if (tickId) clearInterval(tickId);
    tickId = null;
  }

  function render() {
    if (state.status !== 'running') return;
    const elapsed = currentElapsed();
    const qNum = state.times.length + 1;
    const over = elapsed >= LIMIT_MS;

    el.qLabel.textContent = 'QUESTÃO ' + qNum;
    el.timer.textContent = fmt(elapsed);
    el.delta.textContent = over
      ? '+' + fmt(elapsed - LIMIT_MS) + ' acima do limite'
      : fmt(LIMIT_MS - elapsed + 999) + ' restantes';
    el.barFill.style.width = Math.min(100, (elapsed / LIMIT_MS) * 100) + '%';
    document.body.classList.toggle('over', over);
    // Indicador na aba "Simulado", visível também a partir do Cronograma
    el.badge.hidden = false;
    el.badge.textContent = fmt(elapsed);
    el.badge.classList.toggle('over', over);

    if (over && !alerted) {
      alerted = true;
      // Se o alarme não estava agendado no AudioContext, toca agora
      if (!scheduled.length) { ensureAudio(); scheduleBeeps(0); }
      scheduled = [];
      if (!document.hidden) {
        document.body.classList.remove('flash');
        void document.body.offsetWidth;
        document.body.classList.add('flash');
      }
    }

    document.title = (over ? '⚠ ' : '') + fmt(elapsed) + ' · Q' + qNum + ' · Ritmo ENEM';

    const done = state.times;
    if (done.length) {
      const total = done.reduce((a, b) => a + b, 0);
      const last = done[done.length - 1];
      el.trainStats.textContent =
        'Última: ' + fmt(last) + '  ·  Média: ' + fmt(total / done.length) + '  ·  Feitas: ' + done.length;
    } else {
      el.trainStats.textContent = '';
    }
  }

  // ---------- Relatório ----------
  function computeStats(times) {
    const n = times.length;
    const total = times.reduce((a, b) => a + b, 0);
    const avg = n ? total / n : 0;
    const within = times.filter((t) => t <= LIMIT_MS).length;
    const excessTotal = times.reduce((a, t) => a + Math.max(0, t - LIMIT_MS), 0);
    return {
      n, total, avg,
      avgDelta: avg - LIMIT_MS,
      within,
      over: n - within,
      excessTotal,
      max: n ? Math.max(...times) : 0,
      min: n ? Math.min(...times) : 0,
    };
  }

  function card(label, value, sub, tone) {
    return '<div class="card' + (tone ? ' ' + tone : '') + '">' +
      '<p class="label">' + label + '</p>' +
      '<p class="value">' + value + '</p>' +
      (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>';
  }

  function renderReport() {
    const times = state.times;
    const s = computeStats(times);
    const maxIdx = times.indexOf(s.max) + 1;
    const minIdx = times.indexOf(s.min) + 1;

    el.cards.innerHTML = [
      card('Questões feitas', String(s.n), 'Tempo total: ' + fmt(s.total, true)),
      card('Tempo médio real', fmt(s.avg, true), 'por questão'),
      card('Média vs 3:30', fmtSigned(s.avgDelta, true),
        s.avgDelta > 0 ? 'acima do limite, em média' : 'abaixo ou no limite, em média',
        s.avgDelta > 0 ? 'bad' : 'good'),
      card('Dentro dos 3:30', String(s.within), s.n ? Math.round((s.within / s.n) * 100) + '% das questões' : '', 'good'),
      card('Ultrapassaram 3:30', String(s.over), s.n ? Math.round((s.over / s.n) * 100) + '% das questões' : '', s.over ? 'bad' : ''),
      card('Total acima dos 3:30', '+' + fmt(s.excessTotal, true), 'soma do excesso de cada questão', s.excessTotal > 0 ? 'bad' : 'good'),
      card('Maior tempo', fmt(s.max, true), 'Questão ' + maxIdx),
      card('Menor tempo', fmt(s.min, true), 'Questão ' + minIdx),
    ].join('');

    el.rows.innerHTML = times.map((t, i) => {
      const d = t - LIMIT_MS;
      const cls = t <= LIMIT_MS ? 'good' : 'bad';
      return '<tr><td>' + (i + 1) + '</td><td>' + fmt(t, true) + '</td><td class="' + cls + '">' +
        fmtSigned(d, true) + '</td></tr>';
    }).join('');
  }

  // ---------- Eventos ----------
  $('btn-start').addEventListener('click', startExam);
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-finish').addEventListener('click', finishExam);
  document.querySelectorAll('.btn-restart').forEach((b) => b.addEventListener('click', restart));
  $('btn-test-sound').addEventListener('click', () => { if (ensureAudio()) scheduleBeeps(0.05); });

  document.addEventListener('keydown', (e) => {
    if (state.status !== 'running' || e.repeat) return;
    // Atalhos só valem na aba Simulado (no Cronograma há campos de texto)
    if (currentTab !== 'simulado' || e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      nextQuestion();
    }
  });

  // Ao voltar para a aba, atualiza imediatamente com base no timestamp real
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // ---------- Abas ----------
  // Navegação sem recarregar: a aba ativa fica no hash (#cronograma)
  const TABS = ['simulado', 'cronograma'];
  let currentTab = 'simulado';

  function showTab(name, updateUrl) {
    if (!TABS.includes(name)) name = 'simulado';
    currentTab = name;
    document.body.dataset.tab = name;
    TABS.forEach((t) => {
      $('tab-' + t).hidden = t !== name;
      $('tab-btn-' + t).setAttribute('aria-selected', String(t === name));
    });
    if (updateUrl) {
      history.replaceState(null, '', name === 'simulado' ? location.pathname + location.search : '#' + name);
    }
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => showTab(b.dataset.tab, true));
  });
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
  showTab(location.hash.slice(1), false);

  // Retoma uma sessão em andamento (ex.: página recarregada)
  if (state.status === 'running' && state.startedAt) {
    show('train');
    alerted = currentElapsed() >= LIMIT_MS;
    const resumeAudio = () => {
      if (ensureAudio() && !alerted) armAlarm(LIMIT_MS - currentElapsed());
    };
    document.addEventListener('pointerdown', resumeAudio, { once: true });
    startTicking();
    render();
  } else if (state.status === 'done' && state.times.length) {
    renderReport();
    show('report');
  } else {
    show('home');
  }
})();
