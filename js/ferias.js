/**
 * Férias — Lógica do módulo
 * - Direito anual geral: 22 dias úteis (Lei Geral do Trabalho 12/23, art. 204.º)
 * - Ano de admissão: 2 dias úteis por mês completo trabalhado (até máximo 22)
 * - Gratificação férias e subsídio Natal: 50% SB (art. 238.º, cálculo no folha.js)
 */
const Ferias = (() => {
  const STORE = 'ferias';
  const DIAS_ANUAIS_GERAIS = 22;
  const DIAS_POR_MES_ADMISSAO = 2;

  const _mesesCompletosAdmissao = (dataAdmissao, anoRef = new Date().getFullYear()) => {
    if (!dataAdmissao) return 0;
    const adm = new Date(dataAdmissao);
    const anoAdmissao = adm.getFullYear();
    if (anoAdmissao < anoRef) return 12;
    if (anoAdmissao > anoRef) return 0;
    const ref = new Date(anoRef, 11, 31);
    let meses = (ref.getFullYear() - adm.getFullYear()) * 12 + (ref.getMonth() - adm.getMonth());
    if (ref.getDate() < adm.getDate()) meses--;
    return Math.max(0, Math.min(12, meses + 1));
  };

  const _calcDireitoAnual = (dataAdmissao, anoRef = new Date().getFullYear()) => {
    const meses = _mesesCompletosAdmissao(dataAdmissao, anoRef);
    const anoAdmissao = dataAdmissao ? new Date(dataAdmissao).getFullYear() : null;
    if (anoAdmissao === anoRef) {
      return Math.min(DIAS_ANUAIS_GERAIS, meses * DIAS_POR_MES_ADMISSAO);
    }
    return DIAS_ANUAIS_GERAIS;
  };

  let state = { all: [], filtered: [], search: '', editingId: null, anoRef: new Date().getFullYear() };

  const _risco = (saldo, direito) => {
    if (!direito || direito <= 0) return { label: '🔴 Sem direito', cls: 'risco-alto' };
    if (saldo <= 0) return { label: '🔴 Esgotado', cls: 'risco-alto' };
    const pct = saldo / direito;
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
          diasMarcados: 0,
          status: 'Disponível',
          anoRef: state.anoRef,
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
      const marcados = parseFloat(r.diasMarcados) || 0;
      const direito = _calcDireitoAnual(f.dataAdmissao, state.anoRef);
      const pendentes = Math.max(0, direito - gozados - marcados);
      const saldo = Math.max(0, direito - gozados);
      const risco = _risco(saldo, direito);
      const mesesAno = _mesesCompletosAdmissao(f.dataAdmissao, state.anoRef);
      const proporcional = mesesAno < 12 ? mesesAno * DIAS_POR_MES_ADMISSAO : DIAS_ANUAIS_GERAIS;
      return {
        ...r,
        _nome: f.nome || '—',
        _dept: f.departamento || '—',
        _adm: f.dataAdmissao,
        _mesesAno: mesesAno,
        _direitoAnual: direito,
        _vencidas: direito,
        _gozados: gozados,
        _marcados: marcados,
        _pendentes: pendentes,
        _proporcional: proporcional,
        _saldo: saldo,
        _risco: risco,
      };
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
    const totalDireito = state.all.reduce((s, r) => s + r._direitoAnual, 0);
    const totalGozado  = state.all.reduce((s, r) => s + r._gozados, 0);
    set('kpi-f-direito', totalDireito);
    set('kpi-f-saldo',  totalDireito - totalGozado);
    const anoEl = document.getElementById('kpi-f-ano');
    if (anoEl) anoEl.textContent = state.anoRef;
  };

  const _renderTable = () => {
    const tbody = document.getElementById('ferias-tbody');
    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
        <div class="empty-state-icon">🏖</div>
        <h3>Sem registos de férias</h3>
        <p>Os registos são gerados automaticamente para funcionários ativos.</p>
      </div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.filtered.map(r => {
      const direito = r._direitoAnual || 1;
      const pct = Math.max(0, Math.min(100, (r._saldo / direito) * 100));
      const barColor = r._saldo <= 0 ? 'var(--danger)' : r._saldo < 8 ? 'var(--warning)' : 'var(--success)';
      const statusBadge = r.status === 'Em Gozo'
        ? '<span class="badge badge-info">🏖 Em Gozo</span>'
        : r._saldo <= 0
          ? '<span class="badge badge-danger">Esgotado</span>'
          : '<span class="badge badge-success">Disponível</span>';
      const anosServico = r._adm ? Math.floor(Utils.daysBetween(new Date(r._adm), new Date()) / 365) : 0;

      return `
        <tr>
          <td>
            <div style="font-weight:600;font-size:.87rem">${r._nome}</div>
            <div style="font-size:.74rem;color:var(--text-2)">${r._dept} · ${anosServico} ano${anosServico !== 1 ? 's' : ''} de serviço</div>
          </td>
          <td style="text-align:center;font-weight:600">${state.anoRef}</td>
          <td style="text-align:center">${r._mesesAno}/12</td>
          <td style="text-align:center;font-weight:600;color:var(--info)">${r._direitoAnual}</td>
          <td style="text-align:center;color:var(--warning);font-weight:600">${r._gozados}</td>
          <td style="text-align:center;color:var(--text-2)">${r._marcados || 0}</td>
          <td>
            <strong style="color:${barColor}">${r._saldo}</strong>
            <div class="ferias-bar"><div class="ferias-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <div style="font-size:.68rem;color:var(--text-2);margin-top:2px">Pendentes: ${r._pendentes} · Proporcional: ${r._proporcional}</div>
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
    const direito = _calcDireitoAnual(f.dataAdmissao, state.anoRef);
    const gozados = parseFloat(r.diasGozados) || 0;
    const marcados = parseFloat(r.diasMarcados) || 0;
    const saldo = direito - gozados;
    const meses = _mesesCompletosAdmissao(f.dataAdmissao, state.anoRef);

    document.getElementById('modal-fer-nome').textContent = f.nome || '—';
    document.getElementById('modal-fer-info').innerHTML =
      `Ano ${state.anoRef} · ${meses} meses completos · Direito: <strong style="color:var(--info)">${direito} dias</strong> · Saldo atual: <strong>${saldo} dias</strong>`;
    document.getElementById('form-fer-gozados').value = gozados;
    document.getElementById('form-fer-marcados').value = marcados || 0;
    document.getElementById('form-fer-limite').textContent = `Máximo permitido (saldo): ${Math.max(0, direito)} dias`;
    document.getElementById('form-fer-status').value = r.status || 'Disponível';
    document.getElementById('form-fer-inicio').value = Utils.toInputDate(r.dataInicio);
    document.getElementById('form-fer-fim').value = Utils.toInputDate(r.dataFim);
    Utils.openModal('ferias-modal');
  };

  const closeModal = () => { Utils.closeModal('ferias-modal'); state.editingId = null; };

  const save = () => {
    const get = (id) => document.getElementById(id)?.value || '';
    const gozados = parseFloat(get('form-fer-gozados')) || 0;
    const marcados = parseFloat(get('form-fer-marcados')) || 0;
    if (gozados < 0 || marcados < 0) return Utils.toast('Dias inválidos (valor negativo).', 'error');

    const r = Storage.find(STORE, state.editingId);
    if (!r) return;
    const funcs = Storage.findAll('funcionarios');
    const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
    const direito = _calcDireitoAnual(f.dataAdmissao, state.anoRef);

    if (gozados > direito) {
      return Utils.toast(`Dias gozados (${gozados}) excedem o direito anual (${direito}). Verifique.`, 'error');
    }
    if ((gozados + marcados) > direito) {
      Utils.toast(`Aviso: gozados + marcados excedem o direito anual.`, 'warning');
    }

    Storage.update(STORE, state.editingId, {
      diasGozados: gozados,
      diasMarcados: marcados,
      status: get('form-fer-status'),
      dataInicio: get('form-fer-inicio'),
      dataFim: get('form-fer-fim'),
      anoRef: state.anoRef,
    });
    Utils.toast('Registo de férias atualizado!', 'success');
    closeModal();
    _loadData();
    _applyFilters();
  };

  const _bindEvents = () => {
    const s = document.getElementById('ferias-search');
    if (s) s.addEventListener('input', e => { state.search = e.target.value; _applyFilters(); });

    const anoSel = document.getElementById('ferias-ano');
    if (anoSel) {
      const atual = new Date().getFullYear();
      const opts = [];
      for (let y = atual - 3; y <= atual + 1; y++) {
        opts.push(`<option value="${y}"${y === state.anoRef ? ' selected' : ''}>${y}</option>`);
      }
      anoSel.innerHTML = opts.join('');
      anoSel.addEventListener('change', e => {
        state.anoRef = parseInt(e.target.value) || new Date().getFullYear();
        _loadData();
        _applyFilters();
      });
    }

    const modal = document.getElementById('ferias-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openEdit, closeModal, save, _calcDireitoAnual };
})();

document.addEventListener('DOMContentLoaded', () => Ferias.init());
