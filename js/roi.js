/**
 * ROI & Métricas de RH — Lógica dedicada
 * Turnover, Absentismo, ROI de Formação
 */
const ROI = (() => {

  const STORE_ASSID = 'assiduidade';
  const STORE_FORM = 'formacoes';
  const DIAS_UTEIS_MES = 22;

  // ─────────────────────────────────────────────────────
  // CÁLCULOS DAS MÉTRICAS
  // ─────────────────────────────────────────────────────
  const _calcTurnover = () => {
    const funcs = Storage.findAll('funcionarios');
    const saidas = funcs.filter(f => f.estado === 'Inativo').length;
    const ativos = funcs.filter(f => f.estado === 'Ativo').length;
    const medio = funcs.length || 1;
    const taxa = medio > 0 ? (saidas / medio) * 100 : 0;

    let classificacao, insight, classe;
    if (taxa < 3)       { classificacao = '🟢 Excelente'; insight = 'Retenção de talentos exemplar. A equipa está estável e motivada.'; classe = 'success'; }
    else if (taxa < 7)  { classificacao = '🔵 Bom';       insight = 'Rotatividade dentro dos padrões aceitáveis. Continue a monitorizar.'; classe = 'info'; }
    else if (taxa < 12) { classificacao = '🟡 Atenção';   insight = 'Rotatividade a subir. Considere investigar as causas das saídas recentes.'; classe = 'warning'; }
    else if (taxa < 20) { classificacao = '🟠 Preocupante'; insight = 'Rotatividade elevada. Impacto negativo em produtividade e custos de contratação.'; classe = 'warning'; }
    else                { classificacao = '🔴 Crítico';    insight = 'ROTATIVIDADE MUITO ELEVADA! Ação urgente necessária: análise de clima, revisão salarial e benefícios.'; classe = 'danger'; }

    return { saidas, ativos, medio, taxa, classificacao, insight, classe };
  };

  const _calcAbsentismo = () => {
    const funcs = Storage.findAll('funcionarios');
    const assid = Storage.findAll(STORE_ASSID);
    const ativos = funcs.filter(f => f.estado === 'Ativo').length;

    const faltas  = assid.filter(a => a.tipo === 'falta').length;
    const atrasos = assid.filter(a => a.tipo === 'atraso').length;
    const abonos  = assid.filter(a => a.tipo === 'abono').length;
    const totalOcorrencias = faltas + atrasos; // abonos contam separado

    const diasEsperados = ativos * DIAS_UTEIS_MES;
    const taxa = diasEsperados > 0 ? ((totalOcorrencias / diasEsperados) * 100) : 0;

    return { faltas, atrasos, abonos, taxa, diasUteis: DIAS_UTEIS_MES, ativos };
  };

  const _calcFormacao = () => {
    const form = Storage.findAll(STORE_FORM);
    const total = form.reduce((s, f) => s + (parseFloat(f.custo) || 0), 0);
    const qtd = form.length;
    const horas = form.reduce((s, f) => s + (parseFloat(f.horas) || 0), 0);
    const formados = new Set(form.map(f => f.funcionarioId).filter(Boolean)).size;
    const medio = qtd ? total / qtd : 0;
    return { total, qtd, horas, formados, medio };
  };

  // ─────────────────────────────────────────────────────
  // RENDER: KPI CARDs (topo)
  // ─────────────────────────────────────────────────────
  const _renderKPIGrid = (t, a, f) => {
    const grid = document.getElementById('roi-kpi-grid');
    if (!grid) return;

    const cards = [
      {
        cls: 'roi-kpi-card--turnover',
        glow: 'rgba(239,68,68,.28)',
        icon: '🔄',
        label: 'Turnover',
        value: t.taxa.toFixed(1) + '%',
        sub: `${t.saidas} saída${t.saidas !== 1 ? 's' : ''} · ${t.medio} colaboradores`
      },
      {
        cls: 'roi-kpi-card--absentismo',
        glow: 'rgba(245,158,11,.28)',
        icon: '📉',
        label: 'Absentismo',
        value: a.taxa.toFixed(1) + '%',
        sub: `${a.faltas} faltas · ${a.atrasos} atrasos · ${a.abonos} abonadas`
      },
      {
        cls: 'roi-kpi-card--formacao',
        glow: 'rgba(59,130,246,.28)',
        icon: '🎓',
        label: 'Investimento em Formação',
        value: Utils.formatCurrency(f.total),
        sub: `${f.qtd} formacões · ${f.formados} colaborador${f.formados !== 1 ? 'es' : ''}`
      },
      {
        cls: 'roi-kpi-card--geral',
        glow: 'rgba(99,102,241,.32)',
        icon: '👥',
        label: 'Total Capital Humano',
        value: t.ativos,
        sub: `${t.medio} registado${t.medio !== 1 ? 's' : ''} · ${t.ativos} ativo${t.ativos !== 1 ? 's' : ''}`
      }
    ];

    grid.innerHTML = cards.map(c => `
      <div class="roi-kpi-card ${c.cls}" style="--glow:${c.glow}">
        <div class="roi-kpi-label">${c.icon} ${c.label}</div>
        <div class="roi-kpi-value">${c.value}</div>
        <div class="roi-kpi-sub">${c.sub}</div>
      </div>`).join('');
  };

  // ─────────────────────────────────────────────────────
  // RENDER: Cards Principais
  // ─────────────────────────────────────────────────────
  const _renderTurnover = (t) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('main-turnover-value', t.taxa.toFixed(1).replace('.', ',') + '%');
    set('main-turnover-saidas', t.saidas);
    set('main-turnover-medio', t.medio);
    set('main-turnover-ativos', t.ativos);
    set('main-turnover-class', t.classificacao);

    const bar = document.getElementById('main-turnover-bar');
    if (bar) bar.style.width = Math.min(100, t.taxa) + '%';

    const insight = document.getElementById('main-turnover-insight');
    if (insight) {
      insight.className = `roi-insight-box roi-insight-box--${t.classe}`;
      insight.innerHTML = `<strong>💡 Insight:</strong> ${t.insight}`;
    }
  };

  const _renderAbsentismo = (a) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('main-absentismo-value', a.taxa.toFixed(1).replace('.', ',') + '%');
    set('main-faltas', a.faltas);
    set('main-atrasos', a.atrasos);
    set('main-abonos', a.abonos);
    set('main-dias-uteis', a.diasUteis);
    _drawChartAbsentismo(a);
  };

  const _renderFormacao = (f) => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('main-formacao-value', Utils.formatCurrency(f.total));
    set('main-formacoes', f.qtd);
    set('main-formados', f.formados);
    set('main-custo-medio', Utils.formatCurrency(f.medio));
    set('main-horas-total', f.horas + 'h');
    _drawChartFormacao();
  };

  // ─────────────────────────────────────────────────────
  // POPULATE: selects / defaults
  // ─────────────────────────────────────────────────────
  const _populateSelects = () => {
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    const opts = '<option value="">Selecione o funcionário...</option>' +
      funcs.map(f => `<option value="${f.id}">${f.nome}${f.departamento ? ` — ${f.departamento}` : ''}</option>`).join('');

    const a = document.getElementById('assiduidade-func');
    const b = document.getElementById('formacao-func');
    if (a) a.innerHTML = opts;
    if (b) b.innerHTML = opts;

    const d = document.getElementById('assiduidade-data');
    if (d) d.value = Utils.toInputDate(new Date());
  };

  // ─────────────────────────────────────────────────────
  // CRUD: Assiduidade
  // ─────────────────────────────────────────────────────
  const addAssiduidade = () => {
    const funcionarioId = document.getElementById('assiduidade-func')?.value;
    const tipo = document.getElementById('assiduidade-tipo')?.value || 'falta';
    const data = document.getElementById('assiduidade-data')?.value;
    const motivo = document.getElementById('assiduidade-motivo')?.value.trim() || '';

    if (!funcionarioId) { Utils.toast('Selecione um funcionário.', 'error'); return; }
    if (!data) { Utils.toast('Informe a data.', 'error'); return; }

    Storage.save(STORE_ASSID, { funcionarioId, tipo, data, motivo });

    const elMotivo = document.getElementById('assiduidade-motivo');
    if (elMotivo) elMotivo.value = '';

    Utils.toast(`Ocorrência (${_tipoLabel(tipo)}) registada!`, 'success');
    init();
  };

  const removeAssiduidade = (id) => {
    Utils.confirm('Remover esta ocorrência de assiduidade?', () => {
      Storage.remove(STORE_ASSID, id);
      Utils.toast('Ocorrência removida.', 'warning');
      init();
    });
  };

  // ─────────────────────────────────────────────────────
  // CRUD: Formações
  // ─────────────────────────────────────────────────────
  const addFormacao = () => {
    const nome  = document.getElementById('formacao-nome')?.value.trim();
    const custoInput = document.getElementById('formacao-custo')?.value;
    const horasInput = document.getElementById('formacao-horas')?.value;
    const funcionarioId = document.getElementById('formacao-func')?.value;
    const custo = custoInput === '' ? 0 : parseFloat(custoInput) || 0;
    const horas = horasInput === '' ? 0 : parseFloat(horasInput) || 0;
    const data  = Utils.toInputDate(new Date());

    if (!nome) { Utils.toast('Informe o nome da formação.', 'error'); return; }
    if (isNaN(custo) || custo < 0) { Utils.toast('Custo inválido.', 'error'); return; }
    if (isNaN(horas) || horas < 0) { Utils.toast('Horas inválidas.', 'error'); return; }
    if (!funcionarioId) { Utils.toast('Selecione um funcionário.', 'error'); return; }

    Storage.save(STORE_FORM, { nome, custo, horas, funcionarioId, data });

    const cleanId = (id) => { const el = document.getElementById(id); if (el) el.value = ''; };
    cleanId('formacao-nome');
    cleanId('formacao-custo');
    cleanId('formacao-horas');
    cleanId('formacao-func');

    Utils.toast('Formação registada com sucesso!', 'success');
    init();
  };

  const removeFormacao = (id) => {
    Utils.confirm('Remover este registo de formação?', () => {
      Storage.remove(STORE_FORM, id);
      Utils.toast('Formação removida.', 'warning');
      init();
    });
  };

  // ─────────────────────────────────────────────────────
  // HISTÓRICO: Tabelas
  // ─────────────────────────────────────────────────────
  const renderListas = () => {
    _renderTableAssiduidade();
    _renderTableFormacoes();
  };

  const _renderTableAssiduidade = () => {
    const funcs = Storage.findAll('funcionarios');
    let assid = Storage.findAll(STORE_ASSID);

    const q = document.getElementById('search-assiduidade')?.value.trim().toLowerCase() || '';
    const ft = document.getElementById('filter-assiduidade-tipo')?.value || '';

    const getFunc = (id) => funcs.find(f => f.id === id) || {};

    assid = assid.filter(r => {
      const f = getFunc(r.funcionarioId);
      if (ft && r.tipo !== ft) return false;
      if (q) {
        const hay = [f.nome, f.departamento, f.funcao, r.motivo, r.tipo, r.data].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    assid.sort((a, b) => new Date(b.data) - new Date(a.data));

    const tbody = document.querySelector('#table-assiduidade tbody');
    if (!tbody) return;

    if (!assid.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="roi-table-empty">
        <span class="roi-table-empty-icon">📋</span>
        Sem registos de assiduidade ainda. Use o formulário acima para adicionar ocorrências.
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = assid.map(r => {
      const f = getFunc(r.funcionarioId);
      return `<tr>
        <td><span class="fw-600">${Utils.formatDate(r.data)}</span></td>
        <td><span class="fw-600">${f.nome || '—'}</span><br><span class="text-3" style="font-size:.72rem">${f.funcao || ''}</span></td>
        <td class="text-2">${f.departamento || '—'}</td>
        <td><span class="badge-rh badge-rh--${r.tipo}">${_tipoLabel(r.tipo)}</span></td>
        <td class="text-2" style="font-size:.78rem">${r.motivo || '—'}</td>
        <td><div class="roi-row-actions"><button class="roi-btn-del" onclick="ROI.removeAssiduidade('${r.id}')" title="Remover">🗑️</button></div></td>
      </tr>`;
    }).join('');
  };

  const _renderTableFormacoes = () => {
    const funcs = Storage.findAll('funcionarios');
    let form = Storage.findAll(STORE_FORM);

    const q = document.getElementById('search-formacao')?.value.trim().toLowerCase() || '';
    const getFunc = (id) => funcs.find(f => f.id === id) || {};

    if (q) {
      form = form.filter(r => {
        const f = getFunc(r.funcionarioId);
        const hay = [f.nome, f.departamento, r.nome, r.custo, r.horas, r.data].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    form.sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt));

    const tbody = document.querySelector('#table-formacoes tbody');
    if (!tbody) return;

    if (!form.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="roi-table-empty">
        <span class="roi-table-empty-icon">🎓</span>
        Sem formações registadas. Utilize o formulário para registar investimentos em desenvolvimento.
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = form.map(r => {
      const f = getFunc(r.funcionarioId);
      return `<tr>
        <td><span class="fw-600">${Utils.formatDate(r.data)}</span></td>
        <td><span class="fw-600">${r.nome || '—'}</span></td>
        <td>${f.nome || '—'}<br><span class="text-3" style="font-size:.72rem">${f.departamento || ''}</span></td>
        <td><span class="badge-rh badge-rh--horas">${r.horas || 0}h</span></td>
        <td><span class="badge-rh badge-rh--custo">${Utils.formatCurrency(r.custo)}</span></td>
        <td><div class="roi-row-actions"><button class="roi-btn-del" onclick="ROI.removeFormacao('${r.id}')" title="Remover">🗑️</button></div></td>
      </tr>`;
    }).join('');
  };

  // ─────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────
  const _tipoLabel = (t) => {
    if (t === 'falta') return 'Falta';
    if (t === 'atraso') return 'Atraso';
    if (t === 'abono') return 'Abonada';
    return t;
  };

  // ─────────────────────────────────────────────────────
  // GRÁFICOS (Canvas API)
  // ─────────────────────────────────────────────────────
  const _drawChartAbsentismo = (a) => {
    const canvas = document.getElementById('chart-absentismo');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const dados = [
      { label: 'Faltas',   val: a.faltas,  cor: '#ef4444' },
      { label: 'Atrasos',  val: a.atrasos, cor: '#f59e0b' },
      { label: 'Abonadas', val: a.abonos,  cor: '#3b82f6' }
    ];
    const total = dados.reduce((s, d) => s + d.val, 0);
    if (!total) {
      ctx.fillStyle = '#484f58';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Sem ocorrências registadas', W / 2, H / 2);
      return;
    }

    const padL = 90, padR = 16, padT = 16, padB = 20;
    const chartH = H - padT - padB;
    const maxVal = Math.max(...dados.map(d => d.val), 1);
    const barH = 22;
    const gap = 16;
    const totalHBar = dados.length * barH + (dados.length - 1) * gap;
    const startY = padT + (chartH - totalHBar) / 2;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = padL + ((W - padL - padR) / 4) * i;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      ctx.fillStyle = '#484f58';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), x, H - 6);
    }

    dados.forEach((d, i) => {
      const y = startY + i * (barH + gap);
      const wMax = W - padL - padR;
      const w = wMax * (d.val / maxVal);

      // Label
      ctx.fillStyle = '#8b949e';
      ctx.font = '11px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(d.label, padL - 10, y + barH / 2 + 4);

      // Bar
      const grad = ctx.createLinearGradient(padL, 0, padL + w, 0);
      grad.addColorStop(0, d.cor);
      grad.addColorStop(1, d.cor + '40');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(padL, y, Math.max(4, w), barH, 6);
      ctx.fill();

      // Value
      ctx.fillStyle = '#e6edf3';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(d.val, padL + w + 8, y + barH / 2 + 4);
    });
  };

  const _drawChartFormacao = () => {
    const canvas = document.getElementById('chart-formacao-evolucao');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const form = Storage.findAll(STORE_FORM);

    // Últimos 6 meses
    const hoje = new Date();
    const meses = [];
    const valores = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      meses.push(key);
      const totalMes = form
        .filter(r => (r.data || r.createdAt || '').slice(0, 7) === key)
        .reduce((s, r) => s + (parseFloat(r.custo) || 0), 0);
      valores.push(totalMes);
    }

    const labels = meses.map(k => {
      const [, m] = k.split('-');
      const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return nomes[parseInt(m, 10) - 1];
    });

    const pad = { top: 24, right: 16, bottom: 32, left: 52 };
    const max = Math.max(...valores, 1);
    const n = labels.length;

    ctx.clearRect(0, 0, W, H);

    const xOf = (i) => pad.left + (i / (n - 1)) * (W - pad.left - pad.right);
    const yOf = (v) => pad.top + ((max - v) / max) * (H - pad.top - pad.bottom);

    // Grid lines
    const gl = 4;
    for (let i = 0; i <= gl; i++) {
      const y = pad.top + ((H - pad.top - pad.bottom) / gl) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#484f58';
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      const v = max - (max / gl) * i;
      const k = v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0);
      ctx.fillText(k, pad.left - 6, y + 3);
    }

    // Área
    const color = '#3b82f6';
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(valores[0]));
    valores.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
    ctx.lineTo(xOf(n - 1), H - pad.bottom);
    ctx.lineTo(xOf(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Linha
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.moveTo(xOf(0), yOf(valores[0]));
    valores.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
    ctx.stroke();

    // Pontos + labels
    valores.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(v), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#161b22';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (v > 0) {
        ctx.fillStyle = '#e6edf3';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        const txt = v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0);
        ctx.fillText(txt, xOf(i), yOf(v) - 10);
      }

      ctx.fillStyle = '#8b949e';
      ctx.font = '10px Inter';
      ctx.fillText(labels[i], xOf(i), H - pad.bottom + 14);
    });
  };

  // ─────────────────────────────────────────────────────
  // EXPORT CSV
  // ─────────────────────────────────────────────────────
  const exportarCSV = () => {
    const funcs = Storage.findAll('funcionarios');
    const getF = (id) => funcs.find(f => f.id === id) || {};

    const linhas = [];
    linhas.push('=== MÉTRICAS DE RH (RESUMO) ===');
    const t = _calcTurnover();
    const a = _calcAbsentismo();
    const f = _calcFormacao();
    linhas.push('Métrica;Valor;Detalhe');
    linhas.push(`Turnover;${t.taxa.toFixed(2)}%;${t.saidas} saídas / ${t.medio} médio`);
    linhas.push(`Absentismo;${a.taxa.toFixed(2)}%;${a.faltas} faltas, ${a.atrasos} atrasos`);
    linhas.push(`Investimento Formação;${Utils.formatCurrency(f.total)};${f.qtd} ações, ${f.formados} colaboradores`);
    linhas.push('');
    linhas.push('=== ASSIDUIDADE ===');
    linhas.push('Data;Funcionário;Departamento;Tipo;Motivo');
    Storage.findAll(STORE_ASSID).sort((x, y) => new Date(x.data) - new Date(y.data)).forEach(r => {
      const fn = getF(r.funcionarioId);
      linhas.push(`${r.data};${fn.nome || ''};${fn.departamento || ''};${_tipoLabel(r.tipo)};"${r.motivo || ''}"`);
    });
    linhas.push('');
    linhas.push('=== FORMAÇÕES ===');
    linhas.push('Data;Nome;Funcionário;Departamento;Horas;Custo (Kz)');
    Storage.findAll(STORE_FORM).sort((x, y) => new Date(x.data) - new Date(y.data)).forEach(r => {
      const fn = getF(r.funcionarioId);
      linhas.push(`${r.data};"${r.nome || ''}";${fn.nome || ''};${fn.departamento || ''};${r.horas || 0};${(parseFloat(r.custo) || 0).toFixed(2)}`);
    });

    const csv = linhas.join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');
    const hoje = new Date().toISOString().slice(0, 10);
    a2.href = url;
    a2.download = `ROI_Metricas_RH_${hoje}.csv`;
    a2.click();
    URL.revokeObjectURL(url);
    Utils.toast('CSV exportado com sucesso!', 'success');
  };

  // ─────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────
  const init = () => {
    const t = _calcTurnover();
    const a = _calcAbsentismo();
    const f = _calcFormacao();

    _renderKPIGrid(t, a, f);
    _renderTurnover(t);
    _renderAbsentismo(a);
    _renderFormacao(f);
    _populateSelects();
    renderListas();

    // Repinta canvas após layout
    setTimeout(() => {
      _drawChartAbsentismo(_calcAbsentismo());
      _drawChartFormacao();
    }, 120);

    // Responsividade: re-desenhar ao redimensionar
    window.onresize = () => {
      clearTimeout(window.__roiResizeTimer);
      window.__roiResizeTimer = setTimeout(() => {
        _drawChartAbsentismo(_calcAbsentismo());
        _drawChartFormacao();
      }, 250);
    };
  };

  return {
    init,
    addAssiduidade, removeAssiduidade,
    addFormacao, removeFormacao,
    renderListas, exportarCSV
  };
})();

document.addEventListener('DOMContentLoaded', () => ROI.init());
