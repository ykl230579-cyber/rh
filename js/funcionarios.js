/**
 * Funcionários — Lógica do módulo
 */
const Funcionarios = (() => {
  const STORE = 'funcionarios';

  // ─── Estado ───────────────────────────────────────────────
  let state = {
    all: [],
    filtered: [],
    search: '',
    filterDept: '',
    filterStatus: '',
    filterContrato: '',
    sortField: 'nome',
    sortDir: 'asc',
    editingId: null,
    page: 1,
    perPage: 10,
  };

  // ─── Departamentos e tipos de contrato ────────────────────
  const DEPARTAMENTOS = [
    'Recursos Humanos', 'Tecnologia', 'Financeiro', 'Comercial',
    'Operações', 'Jurídico', 'Marketing', 'Logística', 'Administração'
  ];

  const CONTRATOS = ['Efectivo', 'Termo Certo', 'Termo Incerto', 'Prestação de Serviços', 'Estágio'];

  // ─── Inicialização ─────────────────────────────────────────
  const init = () => {
    _loadData();
    _renderStats();
    _applyFilters();
    _bindEvents();
    _populateSelects();
  };

  const _loadData = () => {
    state.all = Storage.findAll(STORE);
  };

  // ─── Filtros e ordenação ───────────────────────────────────
  const _applyFilters = () => {
    let data = [...state.all];

    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(f =>
        f.nome.toLowerCase().includes(q) ||
        f.funcao?.toLowerCase().includes(q) ||
        f.departamento?.toLowerCase().includes(q) ||
        f.email?.toLowerCase().includes(q) ||
        (f.id_display || '').toLowerCase().includes(q)
      );
    }

    if (state.filterDept)    data = data.filter(f => f.departamento === state.filterDept);
    if (state.filterStatus)  data = data.filter(f => f.estado === state.filterStatus);
    if (state.filterContrato) data = data.filter(f => f.tipoContrato === state.filterContrato);

    // Ordenação
    data.sort((a, b) => {
      let va = a[state.sortField] ?? '';
      let vb = b[state.sortField] ?? '';
      if (state.sortField === 'salarioBase') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return state.sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    state.filtered = data;
    state.page = 1;
    _renderTable();
    _renderStats();
  };

  // ─── Render: Tabela ───────────────────────────────────────
  const _renderTable = () => {
    const tbody = document.getElementById('func-tbody');
    const countEl = document.getElementById('results-count');
    const total = state.filtered.length;
    const start = (state.page - 1) * state.perPage;
    const slice = state.filtered.slice(start, start + state.perPage);

    if (countEl) countEl.textContent = `${total} funcionário${total !== 1 ? 's' : ''}`;

    if (!slice.length) {
      tbody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <h3>${state.search ? 'Nenhum resultado encontrado' : 'Nenhum funcionário cadastrado'}</h3>
            <p>${state.search ? 'Tente outros termos de busca.' : 'Clique em "Novo Funcionário" para começar.'}</p>
          </div>
        </td></tr>`;
    } else {
      tbody.innerHTML = slice.map(f => _rowHTML(f)).join('');
    }

    _renderPagination(total);
    _updateSortHeaders();
  };

  const _rowHTML = (f) => {
    const initials = f.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const statusBadge = f.estado === 'Ativo'
      ? '<span class="badge badge-success">● Ativo</span>'
      : '<span class="badge badge-muted">○ Inativo</span>';
    const q = state.search;
    const avatarHTML = f.foto
      ? `<div class="func-avatar has-photo"><img src="${f.foto}" alt=""></div>`
      : `<div class="func-avatar">${initials}</div>`;

    return `
      <tr data-id="${f.id}">
        <td><span class="id-badge">${Utils.highlight(f.id_display || '#—', q)}</span></td>
        <td>
          <div class="func-cell">
            ${avatarHTML}
            <div>
              <div class="func-name">${Utils.highlight(f.nome, q)}</div>
              <div class="func-email">${Utils.highlight(f.email || '', q)}</div>
            </div>
          </div>
        </td>
        <td>${Utils.highlight(f.funcao || '—', q)}</td>
        <td>${Utils.highlight(f.departamento || '—', q)}</td>
        <td><span class="badge badge-primary">${f.tipoContrato || '—'}</span></td>
        <td>${Utils.formatDate(f.dataAdmissao)}</td>
        <td><span class="salary-val">${Utils.formatCurrency(f.salarioBase)}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" onclick="Funcionarios.openEdit('${f.id}')" title="Editar">✏️</button>
            <button class="action-btn delete" onclick="Funcionarios.confirmDelete('${f.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>`;
  };

  // ─── Render: Stats ─────────────────────────────────────────
  const _renderStats = () => {
    const all = state.all;
    const ativos = all.filter(f => f.estado === 'Ativo').length;
    const inativos = all.length - ativos;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total', all.length);
    set('stat-ativos', ativos);
    set('stat-inativos', inativos);
  };

  // ─── Render: Paginação ─────────────────────────────────────
  const _renderPagination = (total) => {
    const pages = Math.ceil(total / state.perPage) || 1;
    const p = state.page;
    const start = ((p - 1) * state.perPage) + 1;
    const end = Math.min(p * state.perPage, total);

    const infoEl = document.getElementById('pagination-info');
    const btnsEl = document.getElementById('pagination-btns');

    if (infoEl) infoEl.textContent = total ? `Exibindo ${start}–${end} de ${total}` : 'Nenhum registro';

    if (!btnsEl) return;

    const btn = (label, page, disabled = false, current = false) =>
      `<button class="page-btn${current ? ' current' : ''}" ${disabled ? 'disabled' : ''} onclick="Funcionarios.goPage(${page})">${label}</button>`;

    let html = btn('←', p - 1, p <= 1);
    const maxVisible = 5;
    let from = Math.max(1, p - 2), to = Math.min(pages, from + maxVisible - 1);
    if (to - from < maxVisible - 1) from = Math.max(1, to - maxVisible + 1);

    for (let i = from; i <= to; i++) html += btn(i, i, false, i === p);
    html += btn('→', p + 1, p >= pages);

    btnsEl.innerHTML = html;
  };

  const goPage = (p) => {
    const pages = Math.ceil(state.filtered.length / state.perPage) || 1;
    state.page = Math.max(1, Math.min(p, pages));
    _renderTable();
  };

  // ─── Ordenação ─────────────────────────────────────────────
  const sortBy = (field) => {
    if (state.sortField === field) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortField = field;
      state.sortDir = 'asc';
    }
    _applyFilters();
  };

  const _updateSortHeaders = () => {
    document.querySelectorAll('.table thead th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === state.sortField) {
        th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  };

  // ─── Popula selects (filtros + form) ───────────────────────
  const _populateSelects = () => {
    // Filter selects
    const deptFilter = document.getElementById('filter-dept');
    if (deptFilter) {
      deptFilter.innerHTML = '<option value="">Todos os Departamentos</option>' +
        DEPARTAMENTOS.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    // Form selects
    const deptForm = document.getElementById('form-departamento');
    if (deptForm) {
      deptForm.innerHTML = '<option value="">Selecione...</option>' +
        DEPARTAMENTOS.map(d => `<option value="${d}">${d}</option>`).join('');
    }

    const contratoForm = document.getElementById('form-tipoContrato');
    if (contratoForm) {
      contratoForm.innerHTML = '<option value="">Selecione...</option>' +
        CONTRATOS.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  };

  // ─── Modal: Abrir/Fechar ───────────────────────────────────
  const openNew = () => {
    state.editingId = null;
    _resetForm();
    document.getElementById('modal-title').textContent = 'Novo Funcionário';
    document.getElementById('form-estado').value = 'Ativo';
    _generateDisplayId();
    Utils.openModal('func-modal');
  };

  const openEdit = (id) => {
    const f = Storage.find(STORE, id);
    if (!f) return;
    state.editingId = id;
    _fillForm(f);
    document.getElementById('modal-title').textContent = 'Editar Funcionário';
    Utils.openModal('func-modal');
  };

  const closeModal = () => {
    Utils.closeModal('func-modal');
    state.editingId = null;
    _resetForm();
  };

  // ─── Formulário ───────────────────────────────────────────
  const _fields = ['id_display','nome','funcao','departamento','dataAdmissao','dataSaida',
                   'tipoContrato','nif','niss','salarioBase','telefone','email','morada',
                   'banco','numeroConta','iban','estado','foto'];

  const _resetForm = () => {
    _fields.forEach(f => {
      const el = document.getElementById(`form-${f}`);
      if (el) el.value = '';
    });
    document.getElementById('form-estado').value = 'Ativo';
    document.getElementById('form-id_display').readOnly = false;
    _resetPhotoPreview();
    const fileInput = document.getElementById('form-foto-input');
    if (fileInput) fileInput.value = '';
  };

  const _fillForm = (f) => {
    _fields.forEach(field => {
      const el = document.getElementById(`form-${field}`);
      if (!el) return;
      if (field === 'dataAdmissao' || field === 'dataSaida') el.value = Utils.toInputDate(f[field]);
      else el.value = f[field] ?? '';
    });
    document.getElementById('form-id_display').readOnly = true;
    if (f.foto) _showPhotoPreview(f.foto);
    else _resetPhotoPreview();
  };

  // ─── Foto Upload ──────────────────────────────────────────
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

  const _showPhotoPreview = (base64) => {
    const preview = document.getElementById('photo-preview');
    const removeBtn = document.getElementById('photo-remove-btn');
    const hiddenInput = document.getElementById('form-foto');
    if (!preview || !removeBtn || !hiddenInput) return;
    preview.innerHTML = `<img src="${base64}" alt="Foto do funcionário">`;
    preview.classList.add('has-photo');
    removeBtn.style.display = 'inline-flex';
    hiddenInput.value = base64;
  };

  const _resetPhotoPreview = () => {
    const preview = document.getElementById('photo-preview');
    const removeBtn = document.getElementById('photo-remove-btn');
    const hiddenInput = document.getElementById('form-foto');
    if (!preview || !removeBtn || !hiddenInput) return;
    preview.innerHTML = '<span class="photo-placeholder-icon">👤</span>';
    preview.classList.remove('has-photo');
    removeBtn.style.display = 'none';
    hiddenInput.value = '';
  };

  const _handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Utils.toast('Por favor, selecione um ficheiro de imagem (JPG ou PNG).', 'error');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      Utils.toast('A foto excede o tamanho máximo de 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        _showPhotoPreview(ev.target.result);
      } catch (err) {
        Utils.toast('Erro ao processar a imagem.', 'error');
      }
    };
    reader.onerror = () => {
      Utils.toast('Erro ao ler o ficheiro de imagem.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const _handlePhotoRemove = () => {
    _resetPhotoPreview();
    const fileInput = document.getElementById('form-foto-input');
    if (fileInput) fileInput.value = '';
  };

  const _generateDisplayId = () => {
    const all = Storage.findAll(STORE);
    const nextNum = all.length + 1;
    const el = document.getElementById('form-id_display');
    if (el) el.value = `FUN-${String(nextNum).padStart(4, '0')}`;
  };

  // ─── CRUD ─────────────────────────────────────────────────
  const save = () => {
    const data = {};
    _fields.forEach(f => {
      const el = document.getElementById(`form-${f}`);
      if (el) data[f] = el.value.trim();
    });

    // Validação
    if (!data.nome) return Utils.toast('O nome é obrigatório.', 'error');
    if (!data.departamento) return Utils.toast('Selecione um departamento.', 'error');
    if (!data.tipoContrato) return Utils.toast('Selecione o tipo de contrato.', 'error');
    if (!data.dataAdmissao) return Utils.toast('Informe a data de admissão.', 'error');
    if (!data.nif) return Utils.toast('O NIF é obrigatório para fins fiscais.', 'error');
    if (!data.niss) return Utils.toast('O NISS é obrigatório para fins de INSS.', 'error');
    if (data.salarioBase && isNaN(parseFloat(data.salarioBase)))
      return Utils.toast('Salário inválido.', 'error');
    if (parseFloat(data.salarioBase) < 0)
      return Utils.toast('Salário base não pode ser negativo.', 'error');

    if (state.editingId) {
      Storage.update(STORE, state.editingId, data);
      Utils.toast('Funcionário atualizado com sucesso!', 'success');
    } else {
      Storage.save(STORE, data);
      Utils.toast('Funcionário cadastrado com sucesso!', 'success');
    }

    closeModal();
    _loadData();
    _applyFilters();
  };

  const confirmDelete = (id) => {
    const f = Storage.find(STORE, id);
    if (!f) return;
    Utils.confirm(
      `Tem certeza que deseja excluir <strong>${f.nome}</strong>? Esta ação não pode ser desfeita.`,
      () => _delete(id)
    );
  };

  const _delete = (id) => {
    Storage.remove(STORE, id);
    Utils.toast('Funcionário removido.', 'warning');
    _loadData();
    _applyFilters();
  };

  // ─── Event Bindings ───────────────────────────────────────
  const _bindEvents = () => {
    // Busca
    const searchEl = document.getElementById('func-search');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        state.search = e.target.value;
        _applyFilters();
      });
    }

    // Filtros
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', (e) => { state[key] = e.target.value; _applyFilters(); });
    };
    bind('filter-dept',     'filterDept');
    bind('filter-status',   'filterStatus');
    bind('filter-contrato', 'filterContrato');

    // Ordenação via th
    document.querySelectorAll('.table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => sortBy(th.dataset.sort));
    });

    // Fechar modal ao clicar fora
    const modal = document.getElementById('func-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Busca global no topbar
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const searchEl = document.getElementById('func-search');
        if (searchEl) {
          searchEl.value = e.target.value;
          state.search = e.target.value;
          _applyFilters();
        }
      });
    }

    // Upload de foto
    const photoInput = document.getElementById('form-foto-input');
    if (photoInput) {
      photoInput.addEventListener('change', _handlePhotoUpload);
    }
    const photoRemoveBtn = document.getElementById('photo-remove-btn');
    if (photoRemoveBtn) {
      photoRemoveBtn.addEventListener('click', _handlePhotoRemove);
    }
  };

  return { init, openNew, openEdit, closeModal, save, confirmDelete, goPage, sortBy };
})();

document.addEventListener('DOMContentLoaded', () => Funcionarios.init());
