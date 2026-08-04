/**
 * Recrutamento — Lógica do módulo de Vagas e Funil de Seleção
 */
const Recrutamento = (() => {
  const STORE = 'recrutamento';

  const DEPARTAMENTOS = [
    'Recursos Humanos', 'Tecnologia', 'Financeiro', 'Comercial',
    'Operações', 'Jurídico', 'Marketing', 'Logística', 'Administração'
  ];

  const STATUS_OPTIONS = ['Aberta', 'Em Triagem', 'Em Entrevista', 'Encerrada', 'Cancelada'];

  let state = {
    all: [],
    filtered: [],
    search: '',
    filterDept: '',
    filterStatus: '',
    editingId: null
  };

  // ─── Init ─────────────────────────────────────────────────
  const init = () => {
    _loadData();
    _populateSelects();
    _applyFilters();
    _bindEvents();
  };

  const _loadData = () => {
    state.all = Storage.findAll(STORE);
  };

  const _populateSelects = () => {
    const deptFilter = document.getElementById('filter-rec-dept');
    if (deptFilter) {
      deptFilter.innerHTML = '<option value="">Todos os Departamentos</option>' +
        DEPARTAMENTOS.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const deptForm = document.getElementById('form-rec-dept');
    if (deptForm) {
      deptForm.innerHTML = '<option value="">Selecione...</option>' +
        DEPARTAMENTOS.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const statusForm = document.getElementById('form-rec-status');
    if (statusForm) {
      statusForm.innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  };

  const _applyFilters = () => {
    let data = [...state.all];

    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(v =>
        v.titulo.toLowerCase().includes(q) ||
        v.departamento?.toLowerCase().includes(q)
      );
    }

    if (state.filterDept)   data = data.filter(v => v.departamento === state.filterDept);
    if (state.filterStatus) data = data.filter(v => v.status === state.filterStatus);

    state.filtered = data;
    _renderKPIs();
    _renderFunnel();
    _renderCards();
  };

  const _renderKPIs = () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const total = state.all.length;
    const abertas = state.all.filter(v => v.status !== 'Encerrada' && v.status !== 'Cancelada').length;
    const candidatos = state.all.reduce((s, v) => s + (parseInt(v.candidatosTotal) || 0), 0);
    const contratados = state.all.reduce((s, v) => s + (parseInt(v.contratados) || 0), 0);

    set('kpi-rec-total', total);
    set('kpi-rec-abertas', abertas);
    set('kpi-rec-candidatos', candidatos);
    set('kpi-rec-contratados', contratados);
  };

  // ─── Render: Funil Resumido por Fase ───────────────────────
  const _renderFunnel = () => {
    const totalTriagem = state.all.reduce((s, v) => s + (parseInt(v.triagem) || 0), 0);
    const totalEntrevista = state.all.reduce((s, v) => s + (parseInt(v.entrevista) || 0), 0);
    const totalContratados = state.all.reduce((s, v) => s + (parseInt(v.contratados) || 0), 0);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('funnel-count-triagem', totalTriagem);
    set('funnel-count-entrevista', totalEntrevista);
    set('funnel-count-contratados', totalContratados);
  };

  // ─── Render: Cards de Vagas ────────────────────────────────
  const _renderCards = () => {
    const grid = document.getElementById('rec-job-grid');
    if (!grid) return;

    if (!state.filtered.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1">
          <div class="empty-state">
            <div class="empty-state-icon">🎯</div>
            <h3>${state.search ? 'Nenhuma vaga encontrada' : 'Nenhuma vaga aberta'}</h3>
            <p>${state.search ? 'Tente outros filtros ou termos.' : 'Clique em "Nova Vaga" para registar um processo seletivo.'}</p>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = state.filtered.map(v => {
      const isEncerrada = v.status === 'Encerrada' || v.status === 'Cancelada';
      const badgeCls = v.status === 'Aberta' ? 'badge-success' :
                       v.status === 'Em Triagem' ? 'badge-info' :
                       v.status === 'Em Entrevista' ? 'badge-warning' :
                       v.status === 'Encerrada' ? 'badge-muted' : 'badge-danger';

      const totalCand = parseInt(v.candidatosTotal) || 0;
      const triagem = parseInt(v.triagem) || 0;
      const entrevista = parseInt(v.entrevista) || 0;
      const contratados = parseInt(v.contratados) || 0;

      const pctT = totalCand ? (triagem / totalCand) * 100 : 0;
      const pctE = totalCand ? (entrevista / totalCand) * 100 : 0;
      const pctC = totalCand ? (contratados / totalCand) * 100 : 0;

      const accentColor = isEncerrada ? 'var(--text-3)' : 'var(--primary)';

      return `
        <div class="job-card" style="--job-accent: ${accentColor}">
          <div class="job-card-header">
            <div>
              <div class="job-title">${v.titulo}</div>
              <div class="job-dept">${v.departamento || '—'}</div>
            </div>
            <span class="badge ${badgeCls}">${v.status}</span>
          </div>

          <div class="job-stats-row">
            <div>
              <div class="stat-mini-val">${triagem}</div>
              <div class="stat-mini-lbl">Triagem</div>
            </div>
            <div>
              <div class="stat-mini-val" style="color:var(--warning)">${entrevista}</div>
              <div class="stat-mini-lbl">Entrevista</div>
            </div>
            <div>
              <div class="stat-mini-val" style="color:var(--success)">${contratados}</div>
              <div class="stat-mini-lbl">Admitidos</div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-2);margin-bottom:6px">
              <span>Progresso do Funil</span>
              <span>Total: <strong>${totalCand} candidatos</strong></span>
            </div>
            <div class="job-funnel-bar">
              <div class="job-funnel-segment" style="width:${pctT}%;background:var(--info)" title="Triagem: ${triagem}"></div>
              <div class="job-funnel-segment" style="width:${pctE}%;background:var(--warning)" title="Entrevista: ${entrevista}"></div>
              <div class="job-funnel-segment" style="width:${pctC}%;background:var(--success)" title="Contratados: ${contratados}"></div>
            </div>
          </div>

          <div class="job-footer">
            <span>Abertura: ${Utils.formatDate(v.dataAbertura)}</span>
            <div class="job-actions">
              <button class="btn btn-ghost btn-sm" onclick="Recrutamento.openEdit('${v.id}')">✏️ Editar</button>
              <button class="btn btn-danger btn-sm" onclick="Recrutamento.confirmDelete('${v.id}')">🗑️</button>
            </div>
          </div>
        </div>`;
    }).join('');
  };

  // ─── Modal ────────────────────────────────────────────────
  const openNew = () => {
    state.editingId = null;
    _resetForm();
    document.getElementById('modal-rec-title').textContent = 'Nova Vaga';
    document.getElementById('form-rec-abertura').value = Utils.toInputDate(new Date().toISOString());
    Utils.openModal('rec-modal');
  };

  const openEdit = (id) => {
    const v = Storage.find(STORE, id);
    if (!v) return;
    state.editingId = id;
    document.getElementById('modal-rec-title').textContent = 'Editar Vaga';

    const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val ?? ''; };
    setVal('form-rec-titulo', v.titulo);
    setVal('form-rec-dept', v.departamento);
    setVal('form-rec-abertura', Utils.toInputDate(v.dataAbertura));
    setVal('form-rec-status', v.status);
    setVal('form-rec-candidatos', v.candidatosTotal);
    setVal('form-rec-triagem', v.triagem);
    setVal('form-rec-entrevista', v.entrevista);
    setVal('form-rec-contratados', v.contratados);

    Utils.openModal('rec-modal');
  };

  const closeModal = () => {
    Utils.closeModal('rec-modal');
    state.editingId = null;
    _resetForm();
  };

  const _resetForm = () => {
    ['form-rec-titulo','form-rec-dept','form-rec-abertura','form-rec-status',
     'form-rec-candidatos','form-rec-triagem','form-rec-entrevista','form-rec-contratados']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  };

  // ─── CRUD ─────────────────────────────────────────────────
  const save = () => {
    const getVal = (id) => document.getElementById(id)?.value.trim() || '';

    const data = {
      titulo:          getVal('form-rec-titulo'),
      departamento:    getVal('form-rec-dept'),
      dataAbertura:    getVal('form-rec-abertura'),
      status:          getVal('form-rec-status'),
      candidatosTotal: parseInt(getVal('form-rec-candidatos')) || 0,
      triagem:         parseInt(getVal('form-rec-triagem')) || 0,
      entrevista:      parseInt(getVal('form-rec-entrevista')) || 0,
      contratados:     parseInt(getVal('form-rec-contratados')) || 0
    };

    if (!data.titulo)       return Utils.toast('O título da vaga é obrigatório.', 'error');
    if (!data.departamento) return Utils.toast('Selecione o departamento.', 'error');
    if (!data.dataAbertura) return Utils.toast('Informe a data de abertura.', 'error');

    if (state.editingId) {
      Storage.update(STORE, state.editingId, data);
      Utils.toast('Vaga atualizada com sucesso!', 'success');
    } else {
      Storage.save(STORE, data);
      Utils.toast('Vaga cadastrada com sucesso!', 'success');
    }

    closeModal();
    _loadData();
    _applyFilters();
  };

  const confirmDelete = (id) => {
    const v = Storage.find(STORE, id);
    if (!v) return;
    Utils.confirm(
      `Deseja excluir a vaga <strong>${v.titulo}</strong>?`,
      () => {
        Storage.remove(STORE, id);
        Utils.toast('Vaga excluída.', 'warning');
        _loadData();
        _applyFilters();
      }
    );
  };

  // ─── Bindings ─────────────────────────────────────────────
  const _bindEvents = () => {
    const s = document.getElementById('rec-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _applyFilters(); });

    const fd = document.getElementById('filter-rec-dept');
    if (fd) fd.addEventListener('change', e => { state.filterDept = e.target.value; _applyFilters(); });

    const fs = document.getElementById('filter-rec-status');
    if (fs) fs.addEventListener('change', e => { state.filterStatus = e.target.value; _applyFilters(); });

    const modal = document.getElementById('rec-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openNew, openEdit, closeModal, save, confirmDelete };
})();

document.addEventListener('DOMContentLoaded', () => Recrutamento.init());
