/**
 * Dashboard — Lógica e gráficos Canvas API
 */
const Dashboard = (() => {

  // ─── Calcular KPIs ────────────────────────────────────────
  const _getKPIs = () => {
    const funcs   = Storage.findAll('funcionarios');
    const contratos = Storage.findAll('contratos');
    const ferias  = Storage.findAll('ferias');
    const avals   = Storage.findAll('avaliacoes');
    const recr    = Storage.findAll('recrutamento');
    const folha   = Storage.findAll('folha');

    const ativos  = funcs.filter(f => f.estado === 'Ativo');
    const hoje    = new Date();

    // Contratos vencendo (≤ 30 dias)
    const vencendo = contratos.filter(c => {
      if (!c.dataTermino) return false;
      const dias = Utils.daysBetween(hoje, new Date(c.dataTermino));
      return dias >= 0 && dias <= 30;
    }).length;

    const vencidos = contratos.filter(c => {
      if (!c.dataTermino) return false;
      return Utils.daysBetween(hoje, new Date(c.dataTermino)) < 0;
    }).length;

    // Folha total
    const totalFolha = folha.reduce((s, f) => s + (parseFloat(f.liquido) || 0), 0);
    const mediaSalarial = ativos.length
      ? ativos.reduce((s, f) => s + (parseFloat(f.salarioBase) || 0), 0) / ativos.length
      : 0;

    // Férias ativas
    const emFerias = ferias.filter(f => f.status === 'Em Gozo').length;

    // Avaliação média
    const notas = avals.map(a => parseFloat(a.nota)).filter(n => !isNaN(n));
    const mediaAval = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—';

    // Vagas abertas
    const vagasAbertas = recr.filter(r => r.status !== 'Encerrada').length;

    return {
      total: funcs.length, ativos: ativos.length,
      vencendo, vencidos, totalFolha, mediaSalarial,
      emFerias, mediaAval, vagasAbertas
    };
  };

  // ─── Render KPIs ─────────────────────────────────────────
  const _renderKPIs = (kpi) => {
    const cards = [
      { id: 'kpi-total',    val: kpi.total,       label: 'Total Funcionários', icon: '👥', color: 'var(--primary)' },
      { id: 'kpi-ativos',   val: kpi.ativos,      label: 'Funcionários Ativos', icon: '✅', color: 'var(--success)' },
      { id: 'kpi-vencendo', val: kpi.vencendo,    label: 'Contratos Vencendo', icon: '⚠️', color: 'var(--warning)' },
      { id: 'kpi-vencidos', val: kpi.vencidos,    label: 'Contratos Vencidos', icon: '🔴', color: 'var(--danger)' },
      { id: 'kpi-folha',    val: Utils.formatCurrency(kpi.totalFolha), label: 'Total Folha', icon: '💰', color: 'var(--cyan)' },
      { id: 'kpi-media',    val: Utils.formatCurrency(kpi.mediaSalarial), label: 'Média Salarial', icon: '📊', color: 'var(--violet)' },
      { id: 'kpi-ferias',   val: kpi.emFerias,    label: 'Em Férias', icon: '🏖', color: 'var(--info)' },
      { id: 'kpi-aval',     val: kpi.mediaAval,   label: 'Avaliação Média', icon: '⭐', color: 'var(--warning)' },
      { id: 'kpi-vagas',    val: kpi.vagasAbertas,label: 'Vagas Abertas', icon: '🎯', color: 'var(--success)' },
    ];

    const grid = document.getElementById('kpi-grid');
    if (!grid) return;
    grid.innerHTML = cards.map(c => `
      <div class="kpi-card" style="--kpi-color:${c.color}">
        <span class="kpi-icon">${c.icon}</span>
        <div class="kpi-value">${c.val}</div>
        <div class="kpi-label">${c.label}</div>
      </div>`).join('');
  };

  // ─── Gráfico: Departamentos (Barra) ──────────────────────
  const _chartDepts = () => {
    const canvas = document.getElementById('chart-depts');
    if (!canvas) return;
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    const map = {};
    funcs.forEach(f => { map[f.departamento || 'N/D'] = (map[f.departamento || 'N/D'] || 0) + 1; });
    const labels = Object.keys(map);
    const values = Object.values(map);
    if (!labels.length) { _emptyChart(canvas, 'Sem dados'); return; }
    _drawBar(canvas, labels, values, '#6366f1');
  };

  // ─── Gráfico: Status Contratos (Donut) ───────────────────
  const _chartContratos = () => {
    const canvas = document.getElementById('chart-contratos');
    if (!canvas) return;
    const contratos = Storage.findAll('contratos');
    const hoje = new Date();
    const map = { 'OK': 0, 'Monitorar': 0, 'Atenção': 0, 'Urgente': 0, 'Vencido': 0 };
    contratos.forEach(c => {
      const s = _contratoStatus(c, hoje);
      map[s] = (map[s] || 0) + 1;
    });
    const labels = Object.keys(map).filter(k => map[k] > 0);
    const values = labels.map(k => map[k]);
    const colors = { 'OK': '#10b981', 'Monitorar': '#3b82f6', 'Atenção': '#f59e0b', 'Urgente': '#f97316', 'Vencido': '#ef4444' };
    if (!values.reduce((a, b) => a + b, 0)) { _emptyChart(canvas, 'Sem contratos'); return; }
    _drawDonut(canvas, labels, values, labels.map(l => colors[l]));

    // Legenda
    const leg = document.getElementById('legend-contratos');
    if (leg) leg.innerHTML = labels.map((l, i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${labels.map(l => colors[l])[i]}"></div>
        ${l}: <strong style="color:var(--text)">${values[i]}</strong>
      </div>`).join('');
  };

  // ─── Gráfico: Contratações por mês (Linha) ───────────────
  const _chartAdmissoes = () => {
    const canvas = document.getElementById('chart-admissoes');
    if (!canvas) return;
    const funcs = Storage.findAll('funcionarios');
    const monthMap = {};
    funcs.forEach(f => {
      if (!f.dataAdmissao) return;
      const key = f.dataAdmissao.slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + 1;
    });
    const sorted = Object.keys(monthMap).sort().slice(-8);
    if (!sorted.length) { _emptyChart(canvas, 'Sem dados de admissão'); return; }
    const labels = sorted.map(k => {
      const [y, m] = k.split('-');
      return `${m}/${y.slice(2)}`;
    });
    const values = sorted.map(k => monthMap[k]);
    _drawLine(canvas, labels, values, '#06b6d4');
  };

  // ─── Gráfico: Avaliação média por departamento ────────────
  const _chartAvaliacoes = () => {
    const canvas = document.getElementById('chart-avaliacoes');
    if (!canvas) return;
    const funcs  = Storage.findAll('funcionarios');
    const avals  = Storage.findAll('avaliacoes');
    const map = {};
    avals.forEach(a => {
      const f = funcs.find(fn => fn.id === a.funcionarioId);
      const dept = f?.departamento || 'N/D';
      if (!map[dept]) map[dept] = [];
      map[dept].push(parseFloat(a.nota) || 0);
    });
    const labels = Object.keys(map);
    const values = labels.map(k => parseFloat((map[k].reduce((s, v) => s + v, 0) / map[k].length).toFixed(1)));
    if (!labels.length) { _emptyChart(canvas, 'Sem avaliações'); return; }
    _drawBar(canvas, labels, values, '#8b5cf6', 5);
  };

  // ─── Alertas ─────────────────────────────────────────────
  const _renderAlerts = () => {
    const contratos = Storage.findAll('contratos');
    const funcs = Storage.findAll('funcionarios');
    const hoje = new Date();
    const alertList = document.getElementById('alert-list');
    if (!alertList) return;

    const alerts = contratos
      .map(c => {
        const dias = c.dataTermino ? Utils.daysBetween(hoje, new Date(c.dataTermino)) : null;
        if (dias === null || dias > 60) return null;
        const f = funcs.find(fn => fn.id === c.funcionarioId);
        return { nome: f?.nome || 'Desconhecido', dias, status: _contratoStatus(c, hoje) };
      })
      .filter(Boolean)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 6);

    if (!alerts.length) {
      alertList.innerHTML = '<div class="dash-empty">✅ Nenhum alerta de contrato no momento.</div>';
      return;
    }

    const iconMap = { 'Vencido': '🔴', 'Urgente': '🟠', 'Atenção': '🟡', 'Monitorar': '🔵', 'OK': '🟢' };
    alertList.innerHTML = alerts.map(a => `
      <div class="alert-item">
        <div class="alert-icon">${iconMap[a.status] || '⚠️'}</div>
        <div class="alert-info">
          <div class="alert-name">${a.nome}</div>
          <div class="alert-sub">${a.dias < 0 ? `Vencido há ${Math.abs(a.dias)} dias` : `Vence em ${a.dias} dias`}</div>
        </div>
        <span class="badge badge-${a.status === 'Vencido' ? 'danger' : a.status === 'Urgente' ? 'danger' : a.status === 'Atenção' ? 'warning' : 'info'}">${a.status}</span>
      </div>`).join('');
  };

  // ─── Status contrato ──────────────────────────────────────
  const _contratoStatus = (c, hoje) => {
    if (!c.dataTermino) return 'OK';
    const dias = Utils.daysBetween(hoje, new Date(c.dataTermino));
    if (dias < 0)   return 'Vencido';
    if (dias <= 7)  return 'Urgente';
    if (dias <= 15) return 'Atenção';
    if (dias <= 30) return 'Monitorar';
    return 'OK';
  };

  // ─── Canvas helpers ───────────────────────────────────────
  const _emptyChart = (canvas, msg) => {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = '#484f58';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  };

  const _drawBar = (canvas, labels, values, color, maxVal) => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 20, right: 16, bottom: 40, left: 40 };
    const max = maxVal || Math.max(...values, 1);
    const bW = ((W - pad.left - pad.right) / labels.length) * 0.6;
    const gap = (W - pad.left - pad.right) / labels.length;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + ((H - pad.top - pad.bottom) / gridLines) * i;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#484f58';
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(max - (max / gridLines) * i), pad.left - 6, y + 3);
    }

    labels.forEach((label, i) => {
      const x = pad.left + i * gap + gap / 2 - bW / 2;
      const barH = ((values[i] / max) * (H - pad.top - pad.bottom)) || 2;
      const y = H - pad.bottom - barH;

      // Gradient bar
      const grad = ctx.createLinearGradient(0, y, 0, H - pad.bottom);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '44');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, bW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Value
      ctx.fillStyle = '#e6edf3';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(values[i], x + bW / 2, y - 5);

      // Label
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px Inter';
      const lbl = label.length > 8 ? label.slice(0, 8) + '…' : label;
      ctx.fillText(lbl, x + bW / 2, H - pad.bottom + 14);
    });
  };

  const _drawLine = (canvas, labels, values, color) => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 20, right: 20, bottom: 36, left: 36 };
    const max = Math.max(...values, 1);
    const n = labels.length;

    ctx.clearRect(0, 0, W, H);

    const xOf = (i) => pad.left + (i / (n - 1)) * (W - pad.left - pad.right);
    const yOf = (v) => pad.top + ((max - v) / max) * (H - pad.top - pad.bottom);

    // Area fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
    ctx.lineTo(xOf(n - 1), H - pad.bottom);
    ctx.lineTo(xOf(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.moveTo(xOf(0), yOf(values[0]));
    values.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
    ctx.stroke();

    // Points + labels
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(v), 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#1c2128';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#e6edf3';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(v, xOf(i), yOf(v) - 9);

      ctx.fillStyle = '#8b949e';
      ctx.fillText(labels[i], xOf(i), H - pad.bottom + 14);
    });
  };

  const _drawDonut = (canvas, labels, values, colors) => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) / 2 - 16;
    const total = values.reduce((a, b) => a + b, 0);
    let angle = -Math.PI / 2;

    values.forEach((v, i) => {
      const slice = (v / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = '#1c2128';
      ctx.lineWidth = 3;
      ctx.stroke();
      angle += slice;
    });

    // Hole
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.56, 0, Math.PI * 2);
    ctx.fillStyle = '#161b22';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#e6edf3';
    ctx.font = `bold 20px Inter`;
    ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 4);
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px Inter';
    ctx.fillText('contratos', cx, cy + 18);
  };

  // ─── Init ─────────────────────────────────────────────────
  const init = () => {
    const kpis = _getKPIs();
    _renderKPIs(kpis);
    _renderAlerts();

    // Pequeno delay para canvas ter dimensões corretas
    setTimeout(() => {
      _chartDepts();
      _chartContratos();
      _chartAdmissoes();
      _chartAvaliacoes();
    }, 100);
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
