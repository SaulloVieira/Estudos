(() => {
  'use strict';

  const STORAGE_KEY = 'ritmo-enem:schedule:v1';
  const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  // Cores das matérias (o mesmo título sempre recebe a mesma cor)
  const COLORS = ['#4f8cff', '#3ddc97', '#ffb547', '#c38bff', '#ff7aa8', '#4fd1e0', '#f2d15c', '#ff8a5c'];

  const item = (title, detail) => ({ id: uid(), title, detail });
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // Exemplo inicial, totalmente editável
  function defaultWeek() {
    return [
      [item('Matemática', '20 questões'), item('Física', '15 questões'), item('Revisão', '30 min')],
      [item('Biologia', '20 questões'), item('Português', '15 questões'), item('Revisão', '30 min')],
      [item('Química', '20 questões'), item('Matemática', '15 questões'), item('Revisão', '30 min')],
      [item('História', '20 questões'), item('Geografia', '15 questões'), item('Revisão', '30 min')],
      [item('Física', '20 questões'), item('Literatura', '15 questões'), item('Revisão', '30 min')],
      [item('Redação', '1 texto'), item('Filosofia e Sociologia', '15 questões')],
      [item('Descanso', '')],
    ];
  }

  // ---------- Estado ----------
  // days: 7 listas (segunda → domingo) de { id, title, detail }
  let days = load() || defaultWeek();
  let editing = false;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data || !Array.isArray(data.days) || data.days.length !== 7) return null;
      return data.days.map((d) => (Array.isArray(d) ? d : []).map((a) => ({
        id: a.id || uid(), title: String(a.title || ''), detail: String(a.detail || ''),
      })));
    } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ days })); } catch { /* sem armazenamento */ }
  }

  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id);
  const week = $('week');
  const btnEdit = $('btn-edit-schedule');
  const hint = $('schedule-edit-hint');

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    });
    children.flat().forEach((c) => { if (c != null) node.append(c); });
    return node;
  }

  function colorFor(title) {
    const key = title.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return COLORS[hash % COLORS.length];
  }

  function todayIndex() { return (new Date().getDay() + 6) % 7; } // segunda = 0

  function find(id) {
    for (let d = 0; d < 7; d++) {
      const i = days[d].findIndex((a) => a.id === id);
      if (i >= 0) return { d, i };
    }
    return null;
  }

  // ---------- Renderização ----------
  function render(focusId) {
    const today = todayIndex();
    week.classList.toggle('editing', editing);
    week.replaceChildren(...days.map((list, d) => dayCard(list, d, d === today)));
    if (focusId) {
      const input = week.querySelector('[data-id="' + focusId + '"] .act-title-input');
      if (input) input.focus();
    }
  }

  function dayCard(list, d, isToday) {
    const count = list.length;
    return h('section', { class: 'day' + (isToday ? ' today' : ''), 'aria-label': DAYS[d] },
      h('header', { class: 'day-head' },
        h('h3', { class: 'day-name' }, DAYS[d]),
        isToday ? h('span', { class: 'day-today' }, 'Hoje') : null,
        !editing && count ? h('span', { class: 'day-count' }, String(count)) : null,
      ),
      editing
        ? h('ol', { class: 'acts' }, list.map((a, i) => editRow(a, d, i, list.length)))
        : count
          ? h('ol', { class: 'acts' }, list.map(viewRow))
          : h('p', { class: 'day-empty' }, 'Dia livre'),
      editing
        ? h('button', { class: 'act-add', type: 'button', onclick: () => add(d) }, '+ Adicionar atividade')
        : null,
    );
  }

  function viewRow(a) {
    return h('li', { class: 'act', style: '--c:' + colorFor(a.title) },
      h('span', { class: 'act-title' }, a.title || 'Sem título'),
      a.detail ? h('span', { class: 'act-detail' }, a.detail) : null,
    );
  }

  function editRow(a, d, i, n) {
    return h('li', { class: 'act act-edit', 'data-id': a.id, style: '--c:' + colorFor(a.title) },
      h('input', {
        class: 'act-title-input', type: 'text', value: a.title, placeholder: 'Matéria / atividade',
        'aria-label': 'Atividade', maxLength: 80,
        oninput: (e) => { a.title = e.target.value; e.target.closest('.act').style.setProperty('--c', colorFor(a.title)); save(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.nextElementSibling.focus(); } },
      }),
      h('input', {
        class: 'act-detail-input', type: 'text', value: a.detail, placeholder: 'Ex.: 20 questões, 30 min',
        'aria-label': 'Detalhe', maxLength: 80,
        oninput: (e) => { a.detail = e.target.value; save(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(d, a.id); } },
      }),
      h('div', { class: 'act-tools' },
        h('button', { class: 'icon-btn', type: 'button', title: 'Mover para cima', 'aria-label': 'Mover para cima', disabled: i === 0, onclick: () => move(a.id, -1) }, '↑'),
        h('button', { class: 'icon-btn', type: 'button', title: 'Mover para baixo', 'aria-label': 'Mover para baixo', disabled: i === n - 1, onclick: () => move(a.id, 1) }, '↓'),
        h('button', { class: 'icon-btn danger', type: 'button', title: 'Excluir', 'aria-label': 'Excluir atividade', onclick: () => remove(a.id) }, '✕'),
      ),
    );
  }

  // ---------- Ações ----------
  function add(d, afterId) {
    const a = item('', '');
    const pos = afterId ? days[d].findIndex((x) => x.id === afterId) + 1 : days[d].length;
    days[d].splice(pos, 0, a);
    save();
    render(a.id);
  }

  function remove(id) {
    const p = find(id);
    if (!p) return;
    days[p.d].splice(p.i, 1);
    save();
    render();
  }

  function move(id, dir) {
    const p = find(id);
    if (!p) return;
    const list = days[p.d];
    const j = p.i + dir;
    if (j < 0 || j >= list.length) return;
    [list[p.i], list[j]] = [list[j], list[p.i]];
    save();
    render();
    const btn = week.querySelector('[data-id="' + id + '"] .icon-btn:nth-child(' + (dir < 0 ? 1 : 2) + ')');
    if (btn && !btn.disabled) btn.focus();
  }

  function setEditing(on) {
    editing = on;
    if (!on) {
      // Descarta atividades deixadas em branco
      days = days.map((list) => list.filter((a) => a.title.trim() || a.detail.trim()));
      days.forEach((list) => list.forEach((a) => { a.title = a.title.trim(); a.detail = a.detail.trim(); }));
      save();
    }
    btnEdit.textContent = on ? '✓ Concluir edição' : '✎ Editar cronograma';
    btnEdit.classList.toggle('btn-primary', on);
    btnEdit.classList.toggle('btn-ghost', !on);
    btnEdit.setAttribute('aria-pressed', String(on));
    hint.hidden = !on;
    render();
  }

  btnEdit.addEventListener('click', () => setEditing(!editing));

  // Mantém várias abas do navegador sincronizadas
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || editing) return;
    days = load() || defaultWeek();
    render();
  });

  render();
})();
