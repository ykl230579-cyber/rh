/**
 * Férias — Lógica do módulo (22 dias anuais)
 */
const Ferias = (() => {
  const STORE = 'ferias';
  const DIAS_ANUAIS = 22;

  let state = { all: [], filtered: [], search: '', editingId: null };

  const _risco = (saldo, dataAdmissao) => {
    if (saldo <= 0) return { label: '🔴 Esgotado', cls: 'risco-alto' };
    const anosServico = dataAdmissao
      ? Math.floor(Utils.daysBetween(new Date(dataAdmissao), new Date()) / 365)
      : 0;
    const acumulado = anosServico * DIAS_ANUAIS;
    const pct = saldo / Math.max(acumulado, DIAS_ANUAIS);
    if (pct > 0.75) return { label: '🟢 Baixo', cls: 'risco-none' };
    if (pct > 0.5)  return { label: '🔵 Moderado', cls: 'risco-baixo' };
    if (pct > 0.25) return { label: '🟡 Médio', cls: 'risco-medio' };
    return { label: '🔴 Alto', cls: 'risco-alto' };
  };

  const init = () => {
    _autoGenerateFerias();
    _loadData();
    _applyFilters();
    _bindEvents();
  };

  const _autoGenerateFerias = () => {
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    const existentes = Storage.findAll(STORE).map(r => r.funcionarioId);
    funcs.forEach(f => {
      if (!existentes.includes(f.id)) {
        Storage.save(STORE, {
          funcionarioId: f.id,
          diasGozados: 0,
          status: 'Disponível',
        });
      }
    });
  };

  const _loadData = () => {
    const funcs = Storage.findAll('funcionarios');
    const ferias = Storage.findAll(STORE);
    state.all = ferias.map(r => {
      const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
      const gozados = parseFloat(r.diasGozados) || 0;
      const saldo = DIAS_ANUAIS - gozados;
      const risco = _risco(saldo, f.dataAdmissao);
      return { ...r, _nome: f.nome || '—', _dept: f.departamento || '—', _adm: f.dataAdmissao, _saldo: saldo, _risco: risco };
    });
  };

  const _applyFilters = () => {
    let data = [...state.all];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(r => r._nome.toLowerCase().includes(q) || r._dept.toLowerCase().includes(q));
    }
    state.filtered = data;
    _renderTable();
    _renderKPIs();
  };

  const _renderKPIs = () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-f-total', state.all.length);
    set('kpi-f-gozo', state.all.filter(r => r.status === 'Em Gozo').length);
    set('kpi-f-disponiveis', state.all.filter(r => r._saldo > 0).length);
    set('kpi-f-esgotados', state.all.filter(r => r._saldo <= 0).length);
  };

  const _renderTable = () => {
    const tbody = document.getElementById('ferias-tbody');
    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-state-icon">🏖</div>
        <h3>Sem registos de férias</h3>
        <p>Os registos são gerados automaticamente para funcionários ativos.</p>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.filtered.map(r => {
      const pct = Math.max(0, Math.min(100, (r._saldo / DIAS_ANUAIS) * 100));
      const barColor = r._saldo <= 0 ? 'var(--danger)' : r._saldo < 8 ? 'var(--warning)' : 'var(--success)';
      const statusBadge = r.status === 'Em Gozo'
        ? '<span class="badge badge-info">🏖 Em Gozo</span>'
        : r._saldo <= 0
          ? '<span class="badge badge-danger">Esgotado</span>'
          : '<span class="badge badge-success">Disponível</span>';

      return `
        <tr>
          <td>
            <div style="font-weight:600;font-size:.87rem">${r._nome}</div>
            <div style="font-size:.74rem;color:var(--text-2)">${r._dept}</div>
          </td>
          <td style="text-align:center;font-weight:600">${DIAS_ANUAIS}</td>
          <td style="text-align:center;color:var(--warning);font-weight:600">${r.diasGozados || 0}</td>
          <td>
            <strong style="color:${barColor}">${r._saldo}</strong>
            <div class="ferias-bar"><div class="ferias-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
          </td>
          <td>${statusBadge}</td>
          <td class="${r._risco.cls}">${r._risco.label}</td>
          <td>${r.dataInicio ? Utils.formatDate(r.dataInicio) + ' → ' + Utils.formatDate(r.dataFim) : '—'}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" onclick="Ferias.openEdit('${r.id}')" title="Registar férias">✏️</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  };

  // ─── Modal ────────────────────────────────────────────────
  const openEdit = (id) => {
    const r = Storage.find(STORE, id);
    if (!r) return;
    state.editingId = id;
    const funcs = Storage.findAll('funcionarios');
    const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
    document.getElementById('modal-fer-nome').textContent = f.nome || '—';
    document.getElementById('form-fer-gozados').value = r.diasGozados || 0;
    document.getElementById('form-fer-status').value = r.status || 'Disponível';
    document.getElementById('form-fer-inicio').value = Utils.toInputDate(r.dataInicio);
    document.getElementById('form-fer-fim').value = Utils.toInputDate(r.dataFim);
    Utils.openModal('ferias-modal');
  };

  const closeModal = () => { Utils.closeModal('ferias-modal'); state.editingId = null; };

  const save = () => {
    const get = (id) => document.getElementById(id)?.value || '';
    const gozados = parseFloat(get('form-fer-gozados')) || 0;
    if (gozados < 0 || gozados > 365) return Utils.toast('Dias inválidos.', 'error');
    Storage.update(STORE, state.editingId, {
      diasGozados: gozados,
      status: get('form-fer-status'),
      dataInicio: get('form-fer-inicio'),
      dataFim: get('form-fer-fim'),
    });
    Utils.toast('Férias atualizadas!', 'success');
    closeModal();
    _loadData();
    _applyFilters();
  };

  const _bindEvents = () => {
    const s = document.getElementById('ferias-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _applyFilters(); });
    const modal = document.getElementById('ferias-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openEdit, closeModal, save };
})();

document.addEventListener('DOMContentLoaded', () => Ferias.init());
