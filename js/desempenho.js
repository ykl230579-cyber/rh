/**
 * Avaliação de Desempenho — Lógica do módulo
 */
const Desempenho = (() => {
  const STORE = 'avaliacoes';

  let state = { all: [], filtered: [], search: '', filterFunc: '', editingId: null };

  const _stars = (nota) => {
    const n = Math.round(parseFloat(nota) || 0);
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="${i < n ? 'star-filled' : 'star-empty'}">★</span>`
    ).join('');
  };

  const init = () => {
    _loadData();
    _populateFuncFilter();
    _populateFuncForm();
    _applyFilters();
    _bindEvents();
  };

  const _loadData = () => {
    const funcs = Storage.findAll('funcionarios');
    const avals = Storage.findAll(STORE);
    state.all = avals.map(a => {
      const f = funcs.find(fn => fn.id === a.funcionarioId) || {};
      return { ...a, _nome: f.nome || '—', _dept: f.departamento || '—' };
    });
  };

  const _avgPerFunc = () => {
    const map = {};
    state.all.forEach(a => {
      if (!map[a.funcionarioId]) map[a.funcionarioId] = { nome: a._nome, notas: [] };
      map[a.funcionarioId].notas.push(parseFloat(a.nota) || 0);
    });
    return Object.entries(map).map(([id, v]) => ({
      id, nome: v.nome,
      avg: (v.notas.reduce((s, n) => s + n, 0) / v.notas.length).toFixed(1),
      count: v.notas.length,
    })).sort((a, b) => b.avg - a.avg);
  };

  const _applyFilters = () => {
    let data = [...state.all];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(a => a._nome.toLowerCase().includes(q) || a.ciclo?.toLowerCase().includes(q));
    }
    if (state.filterFunc) data = data.filter(a => a.funcionarioId === state.filterFunc);
    data.sort((a, b) => new Date(b.data) - new Date(a.data));
    state.filtered = data;
    _renderTable();
    _renderAvgTable();
    _renderKPIs();
  };

  const _renderKPIs = () => {
    const notas = state.all.map(a => parseFloat(a.nota)).filter(n => !isNaN(n));
    const avg = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-avals', state.all.length);
    set('kpi-avg-global', avg);
    set('kpi-func-aval', new Set(state.all.map(a => a.funcionarioId)).size);
  };

  const _renderTable = () => {
    const tbody = document.getElementById('aval-tbody');
    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-state-icon">⭐</div>
        <h3>Sem avaliações registadas</h3>
        <p>Clique em "Nova Avaliação" para começar.</p>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.filtered.map(a => `
      <tr>
        <td>
          <div style="font-weight:600;font-size:.87rem">${a._nome}</div>
          <div style="font-size:.74rem;color:var(--text-2)">${a._dept}</div>
        </td>
        <td><span class="badge badge-primary">${a.ciclo || '—'}</span></td>
        <td>${Utils.formatDate(a.data)}</td>
        <td>
          <div class="stars">${_stars(a.nota)}</div>
          <span class="nota-val">${a.nota}/5</span>
        </td>
        <td style="font-size:.8rem;color:var(--success)">${a.pontosFortes || '—'}</td>
        <td style="font-size:.8rem;color:var(--warning)">${a.pontosAmelhorar || '—'}</td>
        <td style="font-size:.8rem;color:var(--text-2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.comentarios || '—'}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" onclick="Desempenho.openEdit('${a.id}')" title="Editar">✏️</button>
            <button class="action-btn delete" onclick="Desempenho.confirmDelete('${a.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
  };

  const _renderAvgTable = () => {
    const tbody = document.getElementById('avg-tbody');
    if (!tbody) return;
    const avgs = _avgPerFunc();
    if (!avgs.length) { tbody.innerHTML = '<tr><td colspan="4" class="table-empty"><p>Sem dados</p></td></tr>'; return; }
    tbody.innerHTML = avgs.map((r, i) => `
      <tr>
        <td><span style="color:var(--text-2);font-size:.8rem">#${i+1}</span> <strong>${r.nome}</strong></td>
        <td style="text-align:center">${r.count}</td>
        <td>
          <strong style="color:var(--warning)">${r.avg}</strong>
          <div class="func-avg-bar"><div class="func-avg-bar-fill" style="width:${(r.avg/5)*100}%"></div></div>
        </td>
        <td><div class="stars">${_stars(r.avg)}</div></td>
      </tr>`).join('');
  };

  // ─── Modal ────────────────────────────────────────────────
  const _populateFuncFilter = () => {
    const sel = document.getElementById('filter-func-aval');
    if (!sel) return;
    const funcs = Storage.findAll('funcionarios');
    sel.innerHTML = '<option value="">Todos os Funcionários</option>' +
      funcs.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  };

  const _populateFuncForm = () => {
    const sel = document.getElementById('form-aval-func');
    if (!sel) return;
    const funcs = Storage.findAll('funcionarios');
    sel.innerHTML = '<option value="">Selecione...</option>' +
      funcs.map(f => `<option value="${f.id}">${f.nome} — ${f.departamento || ''}</option>`).join('');
  };

  const openNew = () => {
    state.editingId = null;
    _resetForm();
    document.getElementById('modal-aval-title').textContent = 'Nova Avaliação';
    Utils.openModal('aval-modal');
  };

  const openEdit = (id) => {
    const a = Storage.find(STORE, id);
    if (!a) return;
    state.editingId = id;
    document.getElementById('modal-aval-title').textContent = 'Editar Avaliação';
    const fill = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val || ''; };
    fill('form-aval-func', a.funcionarioId);
    fill('form-aval-ciclo', a.ciclo);
    fill('form-aval-data', Utils.toInputDate(a.data));
    fill('form-aval-nota', a.nota);
    fill('form-aval-fortes', a.pontosFortes);
    fill('form-aval-melhorar', a.pontosAmelhorar);
    fill('form-aval-coment', a.comentarios);
    Utils.openModal('aval-modal');
  };

  const closeModal = () => { Utils.closeModal('aval-modal'); state.editingId = null; };

  const _resetForm = () => {
    ['form-aval-func','form-aval-ciclo','form-aval-data','form-aval-nota',
     'form-aval-fortes','form-aval-melhorar','form-aval-coment']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  };

  const save = () => {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const data = {
      funcionarioId:   get('form-aval-func'),
      ciclo:           get('form-aval-ciclo'),
      data:            get('form-aval-data'),
      nota:            get('form-aval-nota'),
      pontosFortes:    get('form-aval-fortes'),
      pontosAmelhorar: get('form-aval-melhorar'),
      comentarios:     get('form-aval-coment'),
    };
    if (!data.funcionarioId) return Utils.toast('Selecione um funcionário.', 'error');
    if (!data.nota || data.nota < 1 || data.nota > 5) return Utils.toast('Nota deve ser de 1 a 5.', 'error');

    if (state.editingId) {
      Storage.update(STORE, state.editingId, data);
      Utils.toast('Avaliação atualizada!', 'success');
    } else {
      Storage.save(STORE, data);
      Utils.toast('Avaliação registada!', 'success');
    }
    closeModal();
    _loadData(); _applyFilters();
  };

  const confirmDelete = (id) => {
    Utils.confirm('Remover esta avaliação?', () => {
      Storage.remove(STORE, id);
      Utils.toast('Avaliação removida.', 'warning');
      _loadData(); _applyFilters();
    });
  };

  const _bindEvents = () => {
    const s = document.getElementById('aval-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _applyFilters(); });
    const ff = document.getElementById('filter-func-aval');
    if (ff) ff.addEventListener('change', e => { state.filterFunc = e.target.value; _applyFilters(); });
    const modal = document.getElementById('aval-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openNew, openEdit, closeModal, save, confirmDelete };
})();

document.addEventListener('DOMContentLoaded', () => Desempenho.init());
