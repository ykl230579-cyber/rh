/**
 * Contratos — Lógica do módulo
 */
const Contratos = (() => {
  const STORE = 'contratos';

  let state = {
    all: [], filtered: [],
    search: '', filterStatus: '',
    sortField: 'diasRestantes', sortDir: 'asc',
    editingId: null,
  };

  // ─── Status ───────────────────────────────────────────────
  const _status = (dataTermino) => {
    if (!dataTermino) return { label: 'OK', cls: 'ok', badge: 'badge-success', dias: null };
    const dias = Utils.daysBetween(new Date(), new Date(dataTermino));
    if (dias < 0)   return { label: 'Vencido',   cls: 'vencido',   badge: 'badge-danger',  dias };
    if (dias <= 7)  return { label: 'Urgente',   cls: 'urgente',   badge: 'badge-urgente', dias };
    if (dias <= 15) return { label: 'Atenção',   cls: 'atencao',   badge: 'badge-warning', dias };
    if (dias <= 30) return { label: 'Monitorar', cls: 'monitorar', badge: 'badge-info',    dias };
    return { label: 'OK', cls: 'ok', badge: 'badge-success', dias };
  };

  // ─── Init ─────────────────────────────────────────────────
  const init = () => {
    _loadData();
    _populateFuncSelect();
    _applyFilters();
    _bindEvents();
  };

  const _loadData = () => {
    const contratos = Storage.findAll(STORE);
    const funcs = Storage.findAll('funcionarios');
    state.all = contratos.map(c => {
      const f = funcs.find(fn => fn.id === c.funcionarioId) || {};
      const st = _status(c.dataTermino);
      return { ...c, _funcNome: f.nome || '—', _funcDept: f.departamento || '—', _status: st };
    });
  };

  const _applyFilters = () => {
    let data = [...state.all];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(c => c._funcNome.toLowerCase().includes(q) || c.tipoContrato?.toLowerCase().includes(q));
    }
    if (state.filterStatus) data = data.filter(c => c._status.label === state.filterStatus);

    data.sort((a, b) => {
      if (state.sortField === 'diasRestantes') {
        const da = a._status.dias ?? 99999;
        const db = b._status.dias ?? 99999;
        return state.sortDir === 'asc' ? da - db : db - da;
      }
      let va = String(a[state.sortField] || '').toLowerCase();
      let vb = String(b[state.sortField] || '').toLowerCase();
      return state.sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    state.filtered = data;
    _renderTable();
    _renderKPIs();
  };

  const _renderKPIs = () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-total-c', state.all.length);
    set('kpi-ok', state.all.filter(c => c._status.label === 'OK').length);
    set('kpi-atencao-c', state.all.filter(c => ['Atenção','Urgente'].includes(c._status.label)).length);
    set('kpi-vencidos-c', state.all.filter(c => c._status.label === 'Vencido').length);
  };

  const _renderTable = () => {
    const tbody = document.getElementById('cont-tbody');
    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h3>Nenhum contrato encontrado</h3>
        <p>Adicione contratos para os funcionários cadastrados.</p>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.filtered.map(c => {
      const { label, cls, badge, dias } = c._status;
      const diasTxt = dias === null ? '—' : dias < 0 ? `−${Math.abs(dias)}d` : `${dias}d`;
      const pct = dias === null ? 100 : Math.max(0, Math.min(100, (dias / 365) * 100));
      const barColor = { ok: 'var(--success)', monitorar: 'var(--info)', atencao: 'var(--warning)', urgente: '#f97316', vencido: 'var(--danger)' }[cls];
      return `
        <tr>
          <td>
            <div class="contract-func">${c._funcNome}</div>
            <div class="contract-func-sub">${c._funcDept}</div>
          </td>
          <td><span class="badge badge-primary">${c.tipoContrato || '—'}</span></td>
          <td>${Utils.formatDate(c.dataAdmissao)}</td>
          <td>${c.dataTermino ? Utils.formatDate(c.dataTermino) : '<span style="color:var(--text-2)">Indeterminado</span>'}</td>
          <td>
            <strong style="color:${barColor}">${diasTxt}</strong>
            <div class="days-bar"><div class="days-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
          </td>
          <td><span class="badge ${badge}">${label}</span></td>
          <td>${c.observacoes ? `<span title="${c.observacoes}" style="cursor:help;color:var(--text-2);font-size:.8rem">${c.observacoes.slice(0,30)}${c.observacoes.length>30?'…':''}</span>` : '—'}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" onclick="Contratos.openEdit('${c.id}')" title="Editar">✏️</button>
              <button class="action-btn delete" onclick="Contratos.confirmDelete('${c.id}')" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('');
    _updateSortHeaders();
  };

  // ─── Modal ────────────────────────────────────────────────
  const _populateFuncSelect = () => {
    const sel = document.getElementById('form-c-func');
    if (!sel) return;
    const funcs = Storage.findAll('funcionarios');
    sel.innerHTML = '<option value="">Selecione o funcionário...</option>' +
      funcs.map(f => `<option value="${f.id}">${f.nome} — ${f.departamento || ''}</option>`).join('');
  };

  const openNew = () => {
    state.editingId = null;
    _resetForm();
    document.getElementById('modal-c-title').textContent = 'Novo Contrato';
    Utils.openModal('cont-modal');
  };

  const openEdit = (id) => {
    const c = Storage.find(STORE, id);
    if (!c) return;
    state.editingId = id;
    document.getElementById('modal-c-title').textContent = 'Editar Contrato';
    const fill = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val || ''; };
    fill('form-c-func', c.funcionarioId);
    fill('form-c-tipo', c.tipoContrato);
    fill('form-c-admissao', Utils.toInputDate(c.dataAdmissao));
    fill('form-c-termino', Utils.toInputDate(c.dataTermino));
    fill('form-c-obs', c.observacoes);
    Utils.openModal('cont-modal');
  };

  const closeModal = () => { Utils.closeModal('cont-modal'); state.editingId = null; };

  const _resetForm = () => {
    ['form-c-func','form-c-tipo','form-c-admissao','form-c-termino','form-c-obs']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  };

  // ─── CRUD ─────────────────────────────────────────────────
  const save = () => {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const data = {
      funcionarioId: get('form-c-func'),
      tipoContrato:  get('form-c-tipo'),
      dataAdmissao:  get('form-c-admissao'),
      dataTermino:   get('form-c-termino'),
      observacoes:   get('form-c-obs'),
    };
    if (!data.funcionarioId) return Utils.toast('Selecione um funcionário.', 'error');
    if (!data.tipoContrato)  return Utils.toast('Selecione o tipo de contrato.', 'error');
    if (!data.dataAdmissao)  return Utils.toast('Informe a data de admissão.', 'error');

    if (state.editingId) {
      Storage.update(STORE, state.editingId, data);
      Utils.toast('Contrato atualizado!', 'success');
    } else {
      Storage.save(STORE, data);
      Utils.toast('Contrato registado!', 'success');
    }
    closeModal();
    _loadData(); _applyFilters();
  };

  const confirmDelete = (id) => {
    Utils.confirm('Remover este contrato?', () => {
      Storage.remove(STORE, id);
      Utils.toast('Contrato removido.', 'warning');
      _loadData(); _applyFilters();
    });
  };

  // ─── Bindings ─────────────────────────────────────────────
  const sortBy = (f) => {
    state.sortDir = state.sortField === f && state.sortDir === 'asc' ? 'desc' : 'asc';
    state.sortField = f;
    _applyFilters();
  };

  const _updateSortHeaders = () => {
    document.querySelectorAll('.table thead th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc','sort-desc');
      if (th.dataset.sort === state.sortField) th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    });
  };

  const _bindEvents = () => {
    const s = document.getElementById('cont-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _applyFilters(); });
    const fs = document.getElementById('filter-status-c');
    if (fs) fs.addEventListener('change', e => { state.filterStatus = e.target.value; _applyFilters(); });
    document.querySelectorAll('.table thead th[data-sort]').forEach(th =>
      th.addEventListener('click', () => sortBy(th.dataset.sort)));
    const modal = document.getElementById('cont-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openNew, openEdit, closeModal, save, confirmDelete, sortBy };
})();

document.addEventListener('DOMContentLoaded', () => Contratos.init());
