/**
 * Folha Salarial — Lógica do módulo (Angola 2026)
 * - INSS: 3% trabalhador / 8% entidade (Decreto Presidencial 227/18)
 * - IRT 2026: Tabela oficial OGE 2026 (Lei 14/25), isenção até 150.000 Kz
 * - Matriz de incidência: subsídios alimentação/transporte com limite isento 30.000 Kz cada
 * - Gratificação de Férias e Subsídio de Natal: 50% salário base (Lei Geral do Trabalho 12/23)
 */
const Folha = (() => {
  const STORE = 'folha';

  // ─── Parâmetros legais Angola 2026 ────────────────────────────────────────
  const PARAMS = {
    inss: {
      taxaTrabalhador: 0.03,
      taxaEntidade:    0.08,
      fonteLegal: 'Decreto Presidencial n.º 227/18, de 27 de Setembro, art. 12.º',
    },
    irt: {
      tabela: [
        { escaleiro: 1,  de: 0,          ate: 150000,    parcelaFixa: 0,        taxa: 0.00, excessoDe: 0 },
        { escaleiro: 2,  de: 150000.01,  ate: 200000,    parcelaFixa: 12500,    taxa: 0.16, excessoDe: 150000 },
        { escaleiro: 3,  de: 200000.01,  ate: 300000,    parcelaFixa: 31250,    taxa: 0.18, excessoDe: 200000 },
        { escaleiro: 4,  de: 300000.01,  ate: 500000,    parcelaFixa: 49250,    taxa: 0.19, excessoDe: 300000 },
        { escaleiro: 5,  de: 500000.01,  ate: 1000000,   parcelaFixa: 87250,    taxa: 0.20, excessoDe: 500000 },
        { escaleiro: 6,  de: 1000000.01, ate: 1500000,   parcelaFixa: 187250,   taxa: 0.21, excessoDe: 1000000 },
        { escaleiro: 7,  de: 1500000.01, ate: 2000000,   parcelaFixa: 292250,   taxa: 0.22, excessoDe: 1500000 },
        { escaleiro: 8,  de: 2000000.01, ate: 2500000,   parcelaFixa: 402250,   taxa: 0.23, excessoDe: 2000000 },
        { escaleiro: 9,  de: 2500000.01, ate: 5000000,   parcelaFixa: 517250,   taxa: 0.24, excessoDe: 2500000 },
        { escaleiro: 10, de: 5000000.01, ate: 10000000,  parcelaFixa: 1117250,  taxa: 0.245,excessoDe: 5000000 },
        { escaleiro: 11, de: 10000000.01,ate: Infinity, parcelaFixa: 2342250,  taxa: 0.25, excessoDe: 10000000 },
      ],
      fonteLegal: 'Lei n.º 14/25, de 30 de Dezembro (OGE 2026), art. 21.º e Anexo I',
    },
    subsidios: {
      limiteIsentoAlimentacao: 30000,
      limiteIsentoTransporte:  30000,
      observacao: 'Rubricas acima do limite isento incidem integralmente em INSS e IRT',
    },
    complementosAnuais: {
      gratificacaoFerias: 0.50,
      subsidioNatal:      0.50,
      fonteLegal: 'Lei Geral do Trabalho n.º 12/23, de 27 de Dezembro, art. 238.º',
    },
  };

  // ─── Matriz de incidência de rubricas ─────────────────────────────────────
  const _calcularRubricas = (salarioBase, subAlimentacao, subTransporte, outrosAbonos) => {
    const sb = parseFloat(salarioBase)    || 0;
    const sa = parseFloat(subAlimentacao) || 0;
    const st = parseFloat(subTransporte)  || 0;
    const oa = parseFloat(outrosAbonos)   || 0;

    const limiteAlim = PARAMS.subsidios.limiteIsentoAlimentacao;
    const limiteTrans = PARAMS.subsidios.limiteIsentoTransporte;

    // Valor sujeito a INSS por rubrica
    const sbINSS    = sb;
    const saINSS    = sa > limiteAlim  ? (sa - limiteAlim) : 0;
    const stINSS    = st > limiteTrans ? (st - limiteTrans) : 0;
    const oaINSS    = oa;
    const baseINSS  = sbINSS + saINSS + stINSS + oaINSS;

    // Valor sujeito a IRT (mesma matriz de incidência do INSS neste modelo)
    const sbIRT    = sb;
    const saIRT    = sa > limiteAlim  ? (sa - limiteAlim) : 0;
    const stIRT    = st > limiteTrans ? (st - limiteTrans) : 0;
    const oaIRT    = oa;
    const baseIRT  = sbIRT + saIRT + stIRT + oaIRT;

    // Remuneração bruta (soma de todas as rubricas pagas)
    const remuneracaoBruta = sb + sa + st + oa;

    return {
      salarioBase: sb,
      subAlimentacao: sa,
      subTransporte: st,
      outrosAbonos: oa,
      remuneracaoBruta,
      baseINSS,
      baseIRTAntesINSS: baseIRT,
      detalheINSS: { sb: sbINSS, sa: saINSS, st: stINSS, oa: oaINSS },
      detalheIRT:  { sb: sbIRT,  sa: saIRT,  st: stIRT,  oa: oaIRT  },
    };
  };

  // ─── Cálculo IRT 2026 (tabela oficial OGE 2026) ──────────────────────────
  const _calcIRT2026 = (materiaColectavel) => {
    const mc = parseFloat(materiaColectavel) || 0;
    if (mc <= PARAMS.irt.tabela[0].ate) return 0;

    for (let i = PARAMS.irt.tabela.length - 1; i >= 0; i--) {
      const t = PARAMS.irt.tabela[i];
      if (mc > t.de) {
        const valor = t.parcelaFixa + ((mc - t.excessoDe) * t.taxa);
        return Math.max(0, valor);
      }
    }
    return 0;
  };

  // ─── Cálculo de meses completos desde admissão ────────────────────────────
  const _mesesCompletos = (dataAdmissao, dataRef = new Date()) => {
    if (!dataAdmissao) return 0;
    const adm = new Date(dataAdmissao);
    const ref = new Date(dataRef);
    let meses = (ref.getFullYear() - adm.getFullYear()) * 12;
    meses += (ref.getMonth() - adm.getMonth());
    if (ref.getDate() < adm.getDate()) meses--;
    return Math.max(0, meses);
  };

  // ─── Complementos anuais (proporcional) ───────────────────────────────────
  const _calcComplementosAnuais = (salarioBase, dataAdmissao) => {
    const sb = parseFloat(salarioBase) || 0;
    const meses = _mesesCompletos(dataAdmissao);
    const pctFerias = PARAMS.complementosAnuais.gratificacaoFerias;
    const pctNatal  = PARAMS.complementosAnuais.subsidioNatal;
    const proporcao = Math.min(1, Math.max(0, meses) / 12);
    return {
      gratificacaoFerias: sb * pctFerias * proporcao,
      subsidioNatal:      sb * pctNatal  * proporcao,
      mesesCompletos: meses,
    };
  };

  // ─── Motor completo do cálculo salarial ───────────────────────────────────
  const calcSalario = (f, valores) => {
    const v = valores || {};
    const rub = _calcularRubricas(
      f.salarioBase,
      v.subAlimentacao,
      v.subTransporte,
      v.outrosAbonos
    );

    // INSS
    const inssTrabalhador = rub.baseINSS * PARAMS.inss.taxaTrabalhador;
    const inssEntidade    = rub.baseINSS * PARAMS.inss.taxaEntidade;

    // IRT — matéria colectável = remuneração tributável − INSS trabalhador
    const materiaColectavelIRT = Math.max(0, rub.baseIRTAntesINSS - inssTrabalhador);
    const irt = _calcIRT2026(materiaColectavelIRT);

    // Outros descontos
    const outrosDescontos = parseFloat(v.outrosDescontos) || 0;

    // Salário líquido
    const descontosTotais = inssTrabalhador + irt + outrosDescontos;
    const salarioLiquido  = rub.remuneracaoBruta - descontosTotais;

    // Custo total empresa
    const custoTotalEmpresa = rub.remuneracaoBruta + inssEntidade;

    // Complementos anuais
    const complementos = _calcComplementosAnuais(f.salarioBase, f.dataAdmissao);

    return {
      ...rub,
      inssTrabalhador,
      inssEntidade,
      inssTotal: inssTrabalhador + inssEntidade,
      taxaINSS: PARAMS.inss.taxaTrabalhador,
      taxaINSSEntidade: PARAMS.inss.taxaEntidade,
      materiaColectavelIRT,
      irt,
      outrosDescontos,
      descontosTotais,
      salarioLiquido,
      custoTotalEmpresa,
      complementos,
    };
  };

  // ─── Validações de conformidade legal ─────────────────────────────────────
  const validarFuncionario = (f) => {
    const erros = [];
    const avisos = [];
    if (!f) { erros.push('Funcionário não encontrado'); return { erros, avisos, valido: false }; }
    if (!f.nome) erros.push('Nome não cadastrado');
    if (!f.nif)  erros.push('NIF não cadastrado — obrigatório para mapa IRT');
    if (!f.niss) erros.push('NISS não cadastrado — obrigatório para mapa INSS');
    if (!f.dataAdmissao) avisos.push('Data de admissão não cadastrada');
    const sb = parseFloat(f.salarioBase) || 0;
    if (sb < 0) erros.push('Salário base negativo');
    if (sb === 0 && f.estado === 'Ativo') avisos.push('Salário base a zero para funcionário ativo');
    if (f.estado !== 'Ativo') avisos.push(`Funcionário em estado "${f.estado}" — processar apenas se aplicável`);
    return { erros, avisos, valido: erros.length === 0 };
  };

  // ─── Estado ───────────────────────────────────────────────
  let state = { mesRef: _currentMonthStr(), editingId: null };

  function _currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ─── Init ─────────────────────────────────────────────────
  const init = () => {
    const isFolhaPage = !!document.getElementById('mes-ref') || !!document.getElementById('folha-tbody');
    if (isFolhaPage) {
      _setupMonthSelector();
      _autoGenerateFolha();
      _renderTable();
      _bindEvents();
    } else {
      _autoGenerateFolha();
    }
  };

  const _setupMonthSelector = () => {
    const sel = document.getElementById('mes-ref');
    if (!sel) return;
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

  // Gera automaticamente folha para funcionários ativos sem registo no mês
  const _autoGenerateFolha = () => {
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    const existentes = Storage.query(STORE, r => r.mesRef === state.mesRef).map(r => r.funcionarioId);
    funcs.forEach(f => {
      if (!existentes.includes(f.id)) {
        const valores = {
          subAlimentacao: 0,
          subTransporte: 0,
          outrosAbonos: 0,
          outrosDescontos: 0,
        };
        const calc = calcSalario(f, valores);
        Storage.save(STORE, {
          funcionarioId: f.id,
          mesRef: state.mesRef,
          ...valores,
          inssTrabalhador: calc.inssTrabalhador,
          inssEntidade: calc.inssEntidade,
          irt: calc.irt,
          salarioLiquido: calc.salarioLiquido,
        });
      }
    });
  };

  const _valoresDoRegisto = (r) => ({
    subAlimentacao: r.subAlimentacao || 0,
    subTransporte:  r.subTransporte  || 0,
    outrosAbonos:   r.outrosAbonos   || 0,
    outrosDescontos: r.outrosDescontos || 0,
  });

  const _getFolhaDoMes = () => {
    const funcs = Storage.findAll('funcionarios');
    const folha = Storage.query(STORE, r => r.mesRef === state.mesRef);
    return folha.map(r => {
      const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
      const valores = _valoresDoRegisto(r);
      const calc = calcSalario(f, valores);
      const valid = validarFuncionario(f);
      return {
        ...r,
        _nome: f.nome || '—',
        _nif:  f.nif  || '—',
        _niss: f.niss || '—',
        _dept: f.departamento || '—',
        _estado: f.estado,
        _calc: calc,
        _valid: valid,
      };
    }).sort((a, b) => a._nome.localeCompare(b._nome));
  };

  const _renderTable = () => {
    const data = _getFolhaDoMes();
    const tbody = document.getElementById('folha-tbody');
    if (!tbody) return;

    const totalBruto      = data.reduce((s, r) => s + r._calc.remuneracaoBruta, 0);
    const totalBaseINSS   = data.reduce((s, r) => s + r._calc.baseINSS, 0);
    const totalBaseIRT    = data.reduce((s, r) => s + r._calc.materiaColectavelIRT, 0);
    const totalINSSTrab   = data.reduce((s, r) => s + r._calc.inssTrabalhador, 0);
    const totalINSSEmp    = data.reduce((s, r) => s + r._calc.inssEntidade, 0);
    const totalIRT        = data.reduce((s, r) => s + r._calc.irt, 0);
    const totalLiq        = data.reduce((s, r) => s + r._calc.salarioLiquido, 0);
    const totalCusto      = data.reduce((s, r) => s + r._calc.custoTotalEmpresa, 0);
    const comErros        = data.filter(r => !r._valid.valido).length;
    const comAvisos       = data.filter(r => r._valid.avisos.length && r._valid.valido).length;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-func-folha', data.length);
    set('kpi-bruto',     Utils.formatCurrency(totalBruto));
    set('kpi-base-inss', Utils.formatCurrency(totalBaseINSS));
    set('kpi-base-irt',  Utils.formatCurrency(totalBaseIRT));
    set('kpi-inss',      Utils.formatCurrency(totalINSSTrab));
    set('kpi-inss-emp',  Utils.formatCurrency(totalINSSEmp));
    set('kpi-irt',       Utils.formatCurrency(totalIRT));
    set('kpi-liq',       Utils.formatCurrency(totalLiq));
    set('kpi-custo',     Utils.formatCurrency(totalCusto));

    const alertasEl = document.getElementById('kpi-alertas');
    if (alertasEl) {
      if (comErros > 0) {
        alertasEl.innerHTML = `<span style="color:var(--danger);font-weight:600">⚠ ${comErros} com erro</span>`;
      } else if (comAvisos > 0) {
        alertasEl.innerHTML = `<span style="color:var(--warning);font-weight:600">ℹ ${comAvisos} com aviso</span>`;
      } else {
        alertasEl.innerHTML = `<span style="color:var(--success);font-weight:600">✓ Tudo conforme</span>`;
      }
    }

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <h3>Sem registos para este mês</h3>
        <p>Cadastre funcionários ativos com NIF e NISS para gerar a folha automaticamente.</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const c = r._calc;
      const badgeConformidade = !r._valid.valido
        ? '<span class="badge badge-danger" title="' + r._valid.erros.join('; ') + '">✗ Erro</span>'
        : r._valid.avisos.length
          ? '<span class="badge badge-warning" title="' + r._valid.avisos.join('; ') + '">! Aviso</span>'
          : '<span class="badge badge-success">✓ OK</span>';

      return `
        <tr>
          <td>
            <div style="font-weight:600;font-size:.87rem">${r._nome}</div>
            <div style="font-size:.74rem;color:var(--text-2)">
              NIF: ${r._nif} · NISS: ${r._niss}
            </div>
            <div style="font-size:.70rem;margin-top:2px">${badgeConformidade}</div>
          </td>
          <td><span class="salary-chip chip-base">${Utils.formatCurrency(c.salarioBase)}</span></td>
          <td><span class="salary-chip chip-subsid">${Utils.formatCurrency(c.subAlimentacao + c.subTransporte + c.outrosAbonos)}</span></td>
          <td style="font-weight:600">${Utils.formatCurrency(c.remuneracaoBruta)}</td>
          <td style="color:var(--info)">${Utils.formatCurrency(c.baseINSS)}</td>
          <td style="color:var(--warning)">${Utils.formatCurrency(c.materiaColectavelIRT)}</td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.inssTrabalhador)}</span></td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.irt)}</span></td>
          <td><span class="salary-chip chip-descont">−${Utils.formatCurrency(c.outrosDescontos)}</span></td>
          <td><span class="salary-chip chip-liquido">${Utils.formatCurrency(c.salarioLiquido)}</span></td>
          <td><span class="salary-chip" style="background:var(--bg-3);color:var(--text-1)">${Utils.formatCurrency(c.inssEntidade)}</span></td>
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
    const valid = validarFuncionario(f);

    document.getElementById('modal-f-nome').textContent = f.nome || '—';
    document.getElementById('modal-f-nif').textContent  = `NIF: ${f.nif || '—'} · NISS: ${f.niss || '—'}`;
    document.getElementById('modal-f-conformidade').innerHTML = !valid.valido
      ? `<span style="color:var(--danger);font-weight:600">⚠ ${valid.erros.length} erro(s): ${valid.erros.join(', ')}</span>`
      : valid.avisos.length
        ? `<span style="color:var(--warning)">ℹ ${valid.avisos.join(', ')}</span>`
        : `<span style="color:var(--success);font-weight:600">✓ Cadastro conforme</span>`;

    document.getElementById('form-f-base').textContent = Utils.formatCurrency(f.salarioBase);
    document.getElementById('form-f-subAlim').value   = r.subAlimentacao || 0;
    document.getElementById('form-f-subTrans').value  = r.subTransporte  || 0;
    document.getElementById('form-f-outrosAb').value  = r.outrosAbonos   || 0;
    document.getElementById('form-f-outrosDesc').value = r.outrosDescontos || 0;

    // Info limites isentos
    document.getElementById('info-limites').innerHTML =
      `Limites isentos (INSS/IRT): Alimentação ${Utils.formatCurrency(PARAMS.subsidios.limiteIsentoAlimentacao)} · Transporte ${Utils.formatCurrency(PARAMS.subsidios.limiteIsentoTransporte)}`;

    const valores = _valoresDoRegisto(r);
    const calc = calcSalario(f, valores);
    const comp = calc.complementos;
    document.getElementById('info-complementos').innerHTML =
      `Meses completos: ${comp.mesesCompletos} · Grat. Férias (50%): ${Utils.formatCurrency(comp.gratificacaoFerias)} · Sub. Natal (50%): ${Utils.formatCurrency(comp.subsidioNatal)}`;

    _previewCalc(f, valores);
    Utils.openModal('folha-modal');
  };

  const _previewCalc = (f, valores) => {
    if (!f) return;
    const c = calcSalario(f, valores);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('prev-subtotal',   Utils.formatCurrency(c.remuneracaoBruta));
    set('prev-base-inss',  Utils.formatCurrency(c.baseINSS));
    set('prev-inss',       Utils.formatCurrency(c.inssTrabalhador));
    set('prev-mc-irt',     Utils.formatCurrency(c.materiaColectavelIRT));
    set('prev-irt',        Utils.formatCurrency(c.irt));
    set('prev-outros',     Utils.formatCurrency(c.outrosDescontos));
    set('prev-liq',        Utils.formatCurrency(c.salarioLiquido));
    set('prev-inss-emp',   Utils.formatCurrency(c.inssEntidade));
    set('prev-custo',      Utils.formatCurrency(c.custoTotalEmpresa));
  };

  const closeModal = () => { Utils.closeModal('folha-modal'); state.editingId = null; };

  const save = () => {
    const getVal = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      const v = parseFloat(el.value);
      return isNaN(v) ? 0 : v;
    };
    const subAlimentacao = getVal('form-f-subAlim');
    const subTransporte  = getVal('form-f-subTrans');
    const outrosAbonos   = getVal('form-f-outrosAb');
    const outrosDescontos = getVal('form-f-outrosDesc');

    if ([subAlimentacao, subTransporte, outrosAbonos, outrosDescontos].some(v => v < 0)) {
      return Utils.toast('Valores monetários não podem ser negativos.', 'error');
    }

    const r = Storage.find(STORE, state.editingId);
    if (!r) return;
    const funcs = Storage.findAll('funcionarios');
    const f = funcs.find(fn => fn.id === r.funcionarioId) || {};
    const valores = { subAlimentacao, subTransporte, outrosAbonos, outrosDescontos };
    const calc = calcSalario(f, valores);

    Storage.update(STORE, state.editingId, {
      ...valores,
      inssTrabalhador: calc.inssTrabalhador,
      inssEntidade:    calc.inssEntidade,
      irt:             calc.irt,
      salarioLiquido:  calc.salarioLiquido,
    });
    Utils.toast('Folha atualizada com conformidade legal 2026!', 'success');
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

    const previewChange = () => {
      if (!state.editingId) return;
      const r = Storage.find(STORE, state.editingId);
      if (!r) return;
      const f = Storage.findAll('funcionarios').find(fn => fn.id === r.funcionarioId);
      const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
      const valores = {
        subAlimentacao: getVal('form-f-subAlim'),
        subTransporte:  getVal('form-f-subTrans'),
        outrosAbonos:   getVal('form-f-outrosAb'),
        outrosDescontos: getVal('form-f-outrosDesc'),
      };
      _previewCalc(f, valores);
    };

    ['form-f-subAlim','form-f-subTrans','form-f-outrosAb','form-f-outrosDesc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', previewChange);
    });

    const modal = document.getElementById('folha-modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };

  return { init, openEdit, closeModal, save, calcSalario, PARAMS, validarFuncionario };
})();

document.addEventListener('DOMContentLoaded', () => Folha.init());
