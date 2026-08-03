/**
 * Folha Salarial — Lógica do módulo (Angola: INSS 3%, IRT progressivo)
 */
const Folha = (() => {
  const STORE = 'folha';

  // ─── Tabela IRT Angola (simplificada) ────────────────────
  const _calcIRT = (base) => {
    const b = parseFloat(base) || 0;
    if (b <= 34450)   return 0;
    if (b <= 70000)   return (b - 34450) * 0.10;
    if (b <= 100000)  return 70000 * 0.10 - 34450 * 0.10 + (b - 70000) * 0.13;
    if (b <= 150000)  return _calcIRT(100000) + (b - 100000) * 0.16;
    if (b <= 200000)  return _calcIRT(150000) + (b - 150000) * 0.18;
    if (b <= 250000)  return _calcIRT(200000) + (b - 200000) * 0.19;
    if (b <= 500000)  return _calcIRT(250000) + (b - 250000) * 0.20;
    if (b <= 1000000) return _calcIRT(500000) + (b - 500000) * 0.21;
    return _calcIRT(1000000) + (b - 1000000) * 0.25;
  };

  const calcSalario = (f, subsidios = 0, outrosDescontos = 0) => {
    const base    = parseFloat(f.salarioBase) || 0;
    const sub     = parseFloat(subsidios) || 0;
    const bruto   = base + sub;
    const inss    = bruto * 0.03;
    const irt     = _calcIRT(bruto - inss);
    const outros  = parseFloat(outrosDescontos) || 0;
    const descTotal = inss + irt + outros;
    const liquido = bruto - descTotal;
    return { base, sub, bruto, inss, irt, outros, descTotal, liquido };
  };

  // ─── Estado ───────────────────────────────────────────────
  let state = { mesRef: _currentMonthStr(), editingId: null };

  function _currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ─── Init ─────────────────────────────────────────────────
  const init = () => {
    _setupMonthSelector();
    _autoGenerateFolha();
    _renderTable();
    _bindEvents();
  };

  const _setupMonthSelector = () => {
    const sel = document.getElementById('mes-ref');
    if (!sel) return;
    // Últimos 12 meses
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${yr}-${mo}`;
      const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      opts.push(`<option value="${val}"${val === state.mesRef ? ' selected' : ''}>${label}</option>`);
      d.setMonth(d.getMonth() - 1);
    }
    sel.innerHTML = opts.join('');
  };

  // Gera automaticamente folha para funcionários que não têm registo no mês
  const _autoGenerateFolha = () => {
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    const existentes = Storage.query(STORE, r => r.mesRef === state.mesRef).map(r => r.funcionarioId);
    funcs.forEach(f => {
      if (!existentes.includes(f.id)) {
        const calc = calcSalario(f);
        Storage.save(STORE, {
          funcionarioId: f.id,
          mesRef: state.mesRef,
          subsidios: 0,
          outrosDescontos: 0,
          inss: calc.inss,
          irt: calc.irt,
          liquido: calc.liquido,
        });
      }
    });
  };

  const _getFolhaDoMes = () => {
    const funcs = Storage.findAll('funcionarios');
    const folha = Storage.query(STORE, r => r.mesRef === state.mesRef);
    return folha.map(r => {
      const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
      const calc = calcSalario(f, r.subsidios, r.outrosDescontos);
      return { ...r, _nome: f.nome || '—', _dept: f.departamento || '—', _calc: calc };
    }).sort((a, b) => a._nome.localeCompare(b._nome));
  };

  const _renderTable = () => {
    const data = _getFolhaDoMes();
    const tbody = document.getElementById('folha-tbody');

    // KPIs
    const totalBruto  = data.reduce((s, r) => s + r._calc.bruto, 0);
    const totalLiq    = data.reduce((s, r) => s + r._calc.liquido, 0);
    const totalINSS   = data.reduce((s, r) => s + r._calc.inss, 0);
    const totalIRT    = data.reduce((s, r) => s + r._calc.irt, 0);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-bruto', Utils.formatCurrency(totalBruto));
    set('kpi-liq', Utils.formatCurrency(totalLiq));
    set('kpi-inss', Utils.formatCurrency(totalINSS));
    set('kpi-irt', Utils.formatCurrency(totalIRT));
    set('kpi-func-folha', data.length);

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <h3>Sem registos para este mês</h3>
        <p>Cadastre funcionários para gerar a folha automaticamente.</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const c = r._calc;
      return `
        <tr>
          <td>
            <div style="font-weight:600;font-size:.87rem">${r._nome}</div>
            <div style="font-size:.74rem;color:var(--text-2)">${r._dept}</div>
          </td>
          <td><span class="salary-chip chip-base">${Utils.formatCurrency(c.base)}</span></td>
          <td><span class="salary-chip chip-subsid">${Utils.formatCurrency(c.sub)}</span></td>
          <td style="font-weight:600">${Utils.formatCurrency(c.bruto)}</td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.inss)}</span></td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.irt)}</span></td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.outros)}</span></td>
          <td><span class="salary-chip chip-liquido">${Utils.formatCurrency(c.liquido)}</span></td>
          <td>
            <button class="action-btn edit" onclick="Folha.openEdit('${r.id}')" title="Editar subsídios/descontos">✏️</button>
          </td>
        </tr>`;
    }).join('');
  };

  // ─── Modal editar ─────────────────────────────────────────
  const openEdit = (id) => {
    const r = Storage.find(STORE, id);
    if (!r) return;
    state.editingId = id;
    const funcs = Storage.findAll('funcionarios');
    const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
    document.getElementById('modal-f-nome').textContent = f.nome || '—';
    document.getElementById('form-f-base').textContent = Utils.formatCurrency(f.salarioBase);
    document.getElementById('form-f-sub').value    = r.subsidios || 0;
    document.getElementById('form-f-outros').value = r.outrosDescontos || 0;
    _previewCalc(f, r.subsidios, r.outrosDescontos);
    Utils.openModal('folha-modal');
  };

  const _previewCalc = (f, sub, outros) => {
    if (!f) return;
    const c = calcSalario(f, sub, outros);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('prev-bruto', Utils.formatCurrency(c.bruto));
    set('prev-inss',  Utils.formatCurrency(c.inss));
    set('prev-irt',   Utils.formatCurrency(c.irt));
    set('prev-liq',   Utils.formatCurrency(c.liquido));
  };

  const closeModal = () => { Utils.closeModal('folha-modal'); state.editingId = null; };

  const save = () => {
    const sub    = parseFloat(document.getElementById('form-f-sub')?.value) || 0;
    const outros = parseFloat(document.getElementById('form-f-outros')?.value) || 0;
    const r = Storage.find(STORE, state.editingId);
    if (!r) return;
    const funcs = Storage.findAll('funcionarios');
    const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
    const calc = calcSalario(f, sub, outros);
    Storage.update(STORE, state.editingId, {
      subsidios: sub, outrosDescontos: outros,
      inss: calc.inss, irt: calc.irt, liquido: calc.liquido,
    });
    Utils.toast('Folha atualizada!', 'success');
    closeModal();
    _renderTable();
  };

  // ─── Bindings ─────────────────────────────────────────────
  const _bindEvents = () => {
    const sel = document.getElementById('mes-ref');
    if (sel) sel.addEventListener('change', e => {
      state.mesRef = e.target.value;
      _autoGenerateFolha();
      _renderTable();
    });

    // Preview em tempo real
    const previewChange = () => {
      if (!state.editingId) return;
      const r = Storage.find(STORE, state.editingId);
      if (!r) return;
      const f = Storage.findAll('funcionarios').find(fn => fn.id === r.funcionarioId);
      const sub    = parseFloat(document.getElementById('form-f-sub')?.value) || 0;
      const outros = parseFloat(document.getElementById('form-f-outros')?.value) || 0;
      _previewCalc(f, sub, outros);
    };

    ['form-f-sub','form-f-outros'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', previewChange);
    });

    const modal = document.getElementById('folha-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openEdit, closeModal, save };
})();

document.addEventListener('DOMContentLoaded', () => Folha.init());
