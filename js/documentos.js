/**
 * Documentos — Lógica do módulo
 */
const Documentos = (() => {
  const STORE = 'documentos';

  const DOCS_LIST = [
    { key: 'contratoAssinado', label: 'Contrato Assinado', ico: '📝' },
    { key: 'inss',             label: 'Inscrição INSS',    ico: '🏥' },
    { key: 'exameMedico',      label: 'Exame Médico',      ico: '🩺' },
    { key: 'bi',               label: 'Bilhete de Identidade', ico: '🪪' },
    { key: 'nif',              label: 'NIF',               ico: '🔢' },
    { key: 'certificados',     label: 'Certificados',      ico: '🎓' },
  ];

  const STATUS_OPTIONS = ['Completo', 'Pendente', 'Vencido'];

  let state = { all: [], search: '', filterStatus: '', editingFuncId: null };

  const init = () => {
    _autoGenerate();
    _loadData();
    _renderCards();
    _bindEvents();
  };

  const _autoGenerate = () => {
    const funcs = Storage.findAll('funcionarios');
    const existentes = Storage.findAll(STORE).map(r => r.funcionarioId);
    funcs.forEach(f => {
      if (!existentes.includes(f.id)) {
        const doc = { funcionarioId: f.id };
        DOCS_LIST.forEach(d => { doc[d.key] = 'Pendente'; doc[d.key + 'Data'] = ''; });
        Storage.save(STORE, doc);
      }
    });
  };

  const _loadData = () => {
    const funcs = Storage.findAll('funcionarios');
    const docs = Storage.findAll(STORE);
    const validDocs = docs.filter(d => funcs.some(f => f.id === d.funcionarioId));

    state.all = validDocs.map(d => {
      const f = funcs.find(fn => fn.id === d.funcionarioId);
      const completos = DOCS_LIST.filter(dl => d[dl.key] === 'Completo').length;
      const pct = Math.round((completos / DOCS_LIST.length) * 100);
      return { ...d, _nome: f ? f.nome : '—', _dept: f ? f.departamento : '—', _pct: pct };
    }).filter(d => d._nome !== '—');
  };

  const _filtered = () => {
    let data = [...state.all];
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(d => d._nome.toLowerCase().includes(q));
    }
    if (state.filterStatus) {
      data = data.filter(d => DOCS_LIST.some(dl => d[dl.key] === state.filterStatus));
    }
    return data.sort((a, b) => a._pct - b._pct);
  };

  const _renderCards = () => {
    const grid = document.getElementById('docs-grid');
    if (!grid) return;
    const data = _filtered();

    // KPIs
    const total = state.all.length;
    const completos = state.all.filter(d => d._pct === 100).length;
    const pendentes = state.all.filter(d => DOCS_LIST.some(dl => d[dl.key] === 'Pendente')).length;
    const vencidos  = state.all.filter(d => DOCS_LIST.some(dl => d[dl.key] === 'Vencido')).length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-doc-total', total);
    set('kpi-doc-completos', completos);
    set('kpi-doc-pendentes', pendentes);
    set('kpi-doc-vencidos', vencidos);

    if (!data.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state">
        <div class="empty-state-icon">🗂</div>
        <h3>Sem registos de documentação</h3>
        <p>Cadastre funcionários no módulo de Funcionários para gerir o estado da documentação.</p>
      </div></div>`;
      return;
    }

    grid.innerHTML = data.map(d => {
      const pctColor = d._pct === 100 ? 'var(--success)' : d._pct >= 50 ? 'var(--warning)' : 'var(--danger)';

      const items = DOCS_LIST.map(dl => {
        const s = d[dl.key] || 'Pendente';
        const badge = s === 'Completo' ? 'badge-success' : s === 'Vencido' ? 'badge-danger' : 'badge-warning';
        return `
          <div class="doc-item">
            <span class="doc-item-name"><span class="ico">${dl.ico}</span>${dl.label}</span>
            <span class="badge ${badge}">${s}</span>
          </div>`;
      }).join('');

      return `
        <div class="doc-card" style="--doc-color:${pctColor}">
          <div class="doc-card-header">
            <div>
              <div class="doc-func-name">${d._nome}</div>
              <div class="doc-func-dept">${d._dept}</div>
            </div>
            <span class="badge ${d._pct === 100 ? 'badge-success' : d._pct >= 50 ? 'badge-warning' : 'badge-danger'}">${d._pct}%</span>
          </div>
          <div class="doc-items">${items}</div>
          <div class="doc-progress">
            <div class="doc-progress-bar">
              <div class="doc-progress-fill" style="width:${d._pct}%;background:${pctColor}"></div>
            </div>
            <span>${d._pct}%</span>
          </div>
          <div class="doc-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="Documentos.openEdit('${d.id}')">✏️ Editar</button>
          </div>
        </div>`;
    }).join('');
  };

  // ─── Modal ────────────────────────────────────────────────
  const openEdit = (id) => {
    const d = Storage.find(STORE, id);
    if (!d) return;
    state.editingFuncId = id;
    const f = Storage.findAll('funcionarios').find(fn => fn.id === d.funcionarioId) || {};
    document.getElementById('modal-doc-nome').textContent = f.nome || '—';
    DOCS_LIST.forEach(dl => {
      const s = document.getElementById(`doc-status-${dl.key}`);
      const dt = document.getElementById(`doc-data-${dl.key}`);
      if (s) s.value = d[dl.key] || 'Pendente';
      if (dt) dt.value = Utils.toInputDate(d[dl.key + 'Data']);
    });
    Utils.openModal('doc-modal');
  };

  const closeModal = () => { Utils.closeModal('doc-modal'); state.editingFuncId = null; };

  const save = () => {
    const changes = {};
    DOCS_LIST.forEach(dl => {
      changes[dl.key] = document.getElementById(`doc-status-${dl.key}`)?.value || 'Pendente';
      changes[dl.key + 'Data'] = document.getElementById(`doc-data-${dl.key}`)?.value || '';
    });
    Storage.update(STORE, state.editingFuncId, changes);
    Utils.toast('Documentação atualizada!', 'success');
    closeModal();
    _loadData();
    _renderCards();
  };

  const _buildModalBody = () => {
    const body = document.getElementById('doc-modal-body');
    if (!body || body.children.length > 0) return;
    body.innerHTML = DOCS_LIST.map(dl => `
      <div class="form-grid" style="align-items:center;margin-bottom:14px">
        <div>
          <label class="form-label">${dl.ico} ${dl.label}</label>
          <select id="doc-status-${dl.key}" class="form-control">
            ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Data do Documento</label>
          <input type="date" id="doc-data-${dl.key}" class="form-control">
        </div>
      </div>`).join('');
  };

  const _bindEvents = () => {
    const s = document.getElementById('docs-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _renderCards(); });
    const fs = document.getElementById('filter-doc-status');
    if (fs) fs.addEventListener('change', e => { state.filterStatus = e.target.value; _renderCards(); });
    const modal = document.getElementById('doc-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    _buildModalBody();
  };

  return { init, openEdit, closeModal, save };
})();

document.addEventListener('DOMContentLoaded', () => Documentos.init());
