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

  const MAX_PDF_SIZE = 15 * 1024 * 1024;

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
      const hasPdf = !!c.pdf;
      const pdfBadge = hasPdf
        ? `<span class="pdf-status-badge has">📄 Anexado</span>`
        : `<span class="pdf-status-badge missing">📄 Sem anexo</span>`;
      const pdfActions = hasPdf
        ? `<button class="action-btn pdf-view" onclick="Contratos.viewStoredPDF('${c.id}')" title="Ver PDF">👁️</button>
           <button class="action-btn pdf-download" onclick="Contratos.downloadStoredPDF('${c.id}')" title="Baixar PDF">⬇️</button>`
        : '';
      return `
        <tr>
          <td>
            <div class="contract-func">${c._funcNome}</div>
            <div class="contract-func-sub">${c._funcDept}</div>
            ${pdfBadge}
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
              ${pdfActions}
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
    fill('form-c-pdf', c.pdf || '');
    fill('form-c-pdf-name', c.pdfName || '');
    _refreshPDFUI();
    Utils.openModal('cont-modal');
  };

  const closeModal = () => { Utils.closeModal('cont-modal'); state.editingId = null; };

  const _resetForm = () => {
    ['form-c-func','form-c-tipo','form-c-admissao','form-c-termino','form-c-obs','form-c-pdf','form-c-pdf-name']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fileInput = document.getElementById('form-c-pdf-input');
    if (fileInput) fileInput.value = '';
    _refreshPDFUI();
  };

  // ─── PDF Helpers ──────────────────────────────────────────
  const _formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB'];
    let i = 0, val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const _refreshPDFUI = () => {
    const pdfValue = document.getElementById('form-c-pdf')?.value || '';
    const pdfName = document.getElementById('form-c-pdf-name')?.value || '';
    const filenameEl = document.getElementById('pdf-filename');
    const filesizeEl = document.getElementById('pdf-filesize');
    const removeBtn = document.getElementById('pdf-remove-btn');
    const viewBtn = document.getElementById('pdf-view-btn');
    const downloadBtn = document.getElementById('pdf-download-btn');
    const iconEl = document.querySelector('#pdf-dropzone .pdf-icon');

    const hasPdf = !!pdfValue;
    if (filenameEl) filenameEl.textContent = pdfName || 'Nenhum ficheiro selecionado';
    if (filesizeEl) {
      if (hasPdf) {
        const approx = (pdfValue.length * 3) / 4;
        filesizeEl.textContent = `Tamanho aprox.: ${_formatBytes(approx)}`;
      } else {
        filesizeEl.textContent = 'Arraste aqui ou clique para selecionar';
      }
    }
    if (removeBtn) removeBtn.style.display = hasPdf ? 'inline-flex' : 'none';
    if (viewBtn) viewBtn.style.display = hasPdf ? 'inline-flex' : 'none';
    if (downloadBtn) downloadBtn.style.display = hasPdf ? 'inline-flex' : 'none';
    if (iconEl) iconEl.classList.toggle('has-pdf', hasPdf);
  };

  const _handlePDFUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      Utils.toast('Por favor, selecione um ficheiro PDF.', 'error');
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      Utils.toast('O PDF excede o tamanho máximo de 15MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const hidden = document.getElementById('form-c-pdf');
      const nameEl = document.getElementById('form-c-pdf-name');
      if (hidden) hidden.value = ev.target.result;
      if (nameEl) nameEl.value = file.name;
      _refreshPDFUI();
      Utils.toast('PDF anexado com sucesso!', 'success');
    };
    reader.onerror = () => Utils.toast('Erro ao ler o ficheiro PDF.', 'error');
    reader.readAsDataURL(file);
  };

  const removePDF = () => {
    const hidden = document.getElementById('form-c-pdf');
    const nameEl = document.getElementById('form-c-pdf-name');
    const fileInput = document.getElementById('form-c-pdf-input');
    if (hidden) hidden.value = '';
    if (nameEl) nameEl.value = '';
    if (fileInput) fileInput.value = '';
    _refreshPDFUI();
  };

  const _base64ToBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  };

  const _openPDFViewer = (pdfData, filename) => {
    const blob = _base64ToBlob(pdfData);
    const url = URL.createObjectURL(blob);
    const modalId = 'pdf-viewer-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal pdf-viewer-modal';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="pdf-viewer-header">
            <div class="pdf-viewer-title">
              <span>📄</span>
              <span id="pdf-viewer-filename">Contrato</span>
            </div>
            <div class="pdf-viewer-actions">
              <a id="pdf-viewer-download" class="btn btn-success btn-sm" href="#" download>⬇️  Baixar</a>
              <button class="btn btn-ghost btn-sm" id="pdf-viewer-close">✕  Fechar</button>
            </div>
          </div>
          <div class="pdf-viewer-body">
            <iframe id="pdf-viewer-frame" src=""></iframe>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closePDFViewer(); });
      modal.querySelector('#pdf-viewer-close').addEventListener('click', closePDFViewer);
    }
    modal.querySelector('#pdf-viewer-filename').textContent = filename || 'Contrato.pdf';
    const dl = modal.querySelector('#pdf-viewer-download');
    dl.href = url;
    dl.download = filename || 'Contrato.pdf';
    modal.querySelector('#pdf-viewer-frame').src = url;
    modal.classList.add('modal-open');
  };

  const closePDFViewer = () => {
    const modal = document.getElementById('pdf-viewer-modal');
    if (modal) {
      modal.classList.remove('modal-open');
      const frame = modal.querySelector('#pdf-viewer-frame');
      if (frame) {
        try { URL.revokeObjectURL(frame.src); } catch (_) {}
        frame.src = '';
      }
    }
  };

  const viewPDF = () => {
    const pdfData = document.getElementById('form-c-pdf')?.value;
    const pdfName = document.getElementById('form-c-pdf-name')?.value;
    if (!pdfData) return Utils.toast('Nenhum PDF anexado.', 'warning');
    _openPDFViewer(pdfData, pdfName);
  };

  const downloadPDF = () => {
    const pdfData = document.getElementById('form-c-pdf')?.value;
    const pdfName = document.getElementById('form-c-pdf-name')?.value || 'Contrato.pdf';
    if (!pdfData) return Utils.toast('Nenhum PDF anexado.', 'warning');
    const blob = _base64ToBlob(pdfData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = pdfName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const viewStoredPDF = (id) => {
    const c = Storage.find(STORE, id);
    if (!c || !c.pdf) return Utils.toast('Contrato sem PDF anexado.', 'warning');
    _openPDFViewer(c.pdf, c.pdfName);
  };

  const downloadStoredPDF = (id) => {
    const c = Storage.find(STORE, id);
    if (!c || !c.pdf) return Utils.toast('Contrato sem PDF anexado.', 'warning');
    const blob = _base64ToBlob(c.pdf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = c.pdfName || 'Contrato.pdf';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      pdf:           document.getElementById('form-c-pdf')?.value || '',
      pdfName:       document.getElementById('form-c-pdf-name')?.value || '',
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

    // PDF: input file
    const pdfInput = document.getElementById('form-c-pdf-input');
    if (pdfInput) pdfInput.addEventListener('change', _handlePDFUpload);

    // PDF: click on dropzone opens file picker
    const dropzone = document.getElementById('pdf-dropzone');
    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('label')) return;
        pdfInput?.click();
      });
      ['dragenter','dragover'].forEach(ev =>
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault(); e.stopPropagation();
          dropzone.classList.add('dragover');
        })
      );
      ['dragleave','drop'].forEach(ev =>
        dropzone.addEventListener(ev, (e) => {
          e.preventDefault(); e.stopPropagation();
          dropzone.classList.remove('dragover');
        })
      );
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (pdfInput) {
          const dt = new DataTransfer();
          dt.items.add(file);
          pdfInput.files = dt.files;
        }
        _handlePDFUpload({ target: { files: [file] } });
      });
    }
  };

  return { init, openNew, openEdit, closeModal, save, confirmDelete, sortBy,
           viewPDF, downloadPDF, removePDF, viewStoredPDF, downloadStoredPDF, closePDFViewer };
})();

document.addEventListener('DOMContentLoaded', () => Contratos.init());
