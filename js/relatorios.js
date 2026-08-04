/**
 * Relatórios — Recibos Individuais, Mapa IRT/INSS, Mapa Bancário
 * Angola 2026 — OGE 2026 · Decreto 227/18 INSS · Lei Geral do Trabalho 12/23
 */
const Relatorios = (() => {

  const EMPRESA_DEFAULT = {
    nome: 'Empresa de Demonstração, Lda.',
    nif: '5000000000',
    morada: 'Luanda, Angola',
    telefone: '+244 900 000 000',
    email: 'rh@empresa.co.ao',
  };

  const state = {
    mesRef: _currentMonthStr(),
  };

  function _currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function _mesExtenso(mesRef) {
    const [yy, mm] = (mesRef || '').split('-');
    const d = new Date(parseInt(yy), parseInt(mm) - 1, 1);
    return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  }

  // ─── Setup inicial (comum) ──────────────────────────────────────────────
  const _setupMesSelector = (selectId, onChange) => {
    const sel = document.getElementById(selectId);
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
    if (onChange) sel.addEventListener('change', e => onChange(e.target.value));
  };

  const _setupFuncSelector = (selectId) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const funcs = Storage.findAll('funcionarios').filter(f => f.estado === 'Ativo');
    if (funcs.length === 0) {
      sel.innerHTML = `<option value="">Nenhum funcionário ativo</option>`;
      return;
    }
    sel.innerHTML = funcs.map(f =>
      `<option value="${f.id}">${f.id_display || ''} ${f.nome} — ${f.departamento || ''}</option>`
    ).join('');
  };

  // ─── Abas ───────────────────────────────────────────────────────────────
  const _setupTabs = () => {
    document.querySelectorAll('.report-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  };

  // ─── 1) RECIBO INDIVIDUAL DE SALÁRIO ────────────────────────────────────
  const _buscarFolhaFuncionario = (funcId, mesRef) => {
    const f = Storage.find('funcionarios', funcId);
    if (!f) return null;
    const folhas = Storage.query('folha', r => r.funcionarioId === funcId && r.mesRef === mesRef);
    let valores;
    if (folhas.length > 0) {
      const r = folhas[0];
      valores = {
        subAlimentacao: r.subAlimentacao,
        subTransporte: r.subTransporte,
        outrosAbonos: r.outrosAbonos,
        outrosDescontos: r.outrosDescontos,
      };
    } else {
      valores = { subAlimentacao: 0, subTransporte: 0, outrosAbonos: 0, outrosDescontos: 0 };
    }
    const calc = Folha.calcSalario(f, valores);
    return { funcionario: f, valores, calc, mesRef };
  };

  const _renderRecibo = (dados) => {
    const out = document.getElementById('recibo-output');
    if (!dados) {
      out.innerHTML = `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-2)">
          <div style="font-size:3rem;margin-bottom:10px">🧾</div>
          <strong style="display:block;font-size:1.05rem;margin-bottom:4px">Sem dados para exibir</strong>
          <p>Seleccione um mês e um funcionário e clique em <strong>"Gerar Recibo"</strong>.</p>
        </div>`;
      return;
    }

    const { funcionario: f, valores: v, calc: c, mesRef } = dados;
    const emp = EMPRESA_DEFAULT;
    const val = Folha.validarFuncionario(f);
    const alertas = !val.valido ? `
      <div style="background:#fff5f5;border:1px solid #ffcdd2;border-left:4px solid #e53935;color:#b71c1c;padding:10px 14px;border-radius:6px;margin:14px 0;font-size:.82rem">
        <strong>⚠ Aviso:</strong> ${val.erros.concat(val.avisos).join(' · ')}
      </div>` : (val.avisos.length ? `
      <div style="background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #f9a825;color:#795548;padding:10px 14px;border-radius:6px;margin:14px 0;font-size:.82rem">
        <strong>ℹ Observações:</strong> ${val.avisos.join(' · ')}
      </div>` : '');

    out.innerHTML = `
      <div class="recibo-wrapper" id="area-impressao-recibo">
        <!-- Cabeçalho -->
        <div class="recibo-header">
          <div class="recibo-empresa">
            <h2>${emp.nome}</h2>
            <p><strong>NIF:</strong> ${emp.nif} · <strong>Morada:</strong> ${emp.morada}</p>
            <p><strong>Tel:</strong> ${emp.telefone} · <strong>Email:</strong> ${emp.email}</p>
          </div>
          <div class="recibo-titulo">
            RECIBO DE SALÁRIO
            <small>Referência: ${_mesExtenso(mesRef)}</small>
          </div>
        </div>

        ${alertas}

        <!-- Dados do trabalhador -->
        <div class="recibo-section-title">Identificação do Trabalhador</div>
        <div class="info-grid">
          <div class="info-row"><span class="lbl">Nº Interno:</span><span class="val">${f.id_display || '—'}</span></div>
          <div class="info-row"><span class="lbl">Nome Completo:</span><span class="val">${f.nome || '—'}</span></div>
          <div class="info-row"><span class="lbl">NIF:</span><span class="val">${f.nif || '—'}</span></div>
          <div class="info-row"><span class="lbl">NISS:</span><span class="val">${f.niss || '—'}</span></div>
          <div class="info-row"><span class="lbl">Função:</span><span class="val">${f.funcao || '—'}</span></div>
          <div class="info-row"><span class="lbl">Departamento:</span><span class="val">${f.departamento || '—'}</span></div>
          <div class="info-row"><span class="lbl">Contrato:</span><span class="val">${f.tipoContrato || '—'}</span></div>
          <div class="info-row"><span class="lbl">Admissão:</span><span class="val">${f.dataAdmissao || '—'}</span></div>
        </div>

        <!-- Dados bancários (se existirem) -->
        ${(f.banco || f.numeroConta || f.iban) ? `
        <div class="recibo-section-title">Dados Bancários</div>
        <div class="info-grid">
          <div class="info-row"><span class="lbl">Banco:</span><span class="val">${f.banco || '—'}</span></div>
          <div class="info-row"><span class="lbl">Nº Conta:</span><span class="val">${f.numeroConta || '—'}</span></div>
          <div class="info-row" style="grid-column:1/-1"><span class="lbl">IBAN:</span><span class="val iban-cell">${f.iban || '—'}</span></div>
        </div>` : ''}

        <!-- Rubricas (Vencimentos) -->
        <div class="recibo-section-title">Vencimentos e Abonos</div>
        <table class="rubricas-table">
          <thead>
            <tr>
              <th style="width:40%">Descrição</th>
              <th class="num" style="width:20%">Base Cálculo</th>
              <th class="num" style="width:15%">%</th>
              <th class="num" style="width:25%">Valor (Kz)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Salário Base</td>
              <td class="num">${Utils.formatCurrency(c.salarioBase)}</td>
              <td class="num">100%</td>
              <td class="num posit">${Utils.formatCurrency(c.salarioBase)}</td>
            </tr>
            ${(v.subAlimentacao > 0) ? `
            <tr>
              <td>Subsídio de Alimentação ${c.saIncidenciaINSS > 0 || c.saIncidenciaIRT > 0 ? `<span style="color:var(--warning)">(¹)</span>` : ''}</td>
              <td class="num">${Utils.formatCurrency(v.subAlimentacao)}</td>
              <td class="num">100%</td>
              <td class="num posit">${Utils.formatCurrency(v.subAlimentacao)}</td>
            </tr>` : ''}
            ${(v.subTransporte > 0) ? `
            <tr>
              <td>Subsídio de Transporte ${c.stIncidenciaINSS > 0 || c.stIncidenciaIRT > 0 ? `<span style="color:var(--warning)">(¹)</span>` : ''}</td>
              <td class="num">${Utils.formatCurrency(v.subTransporte)}</td>
              <td class="num">100%</td>
              <td class="num posit">${Utils.formatCurrency(v.subTransporte)}</td>
            </tr>` : ''}
            ${(v.outrosAbonos > 0) ? `
            <tr>
              <td>Outros Abonos / Prémios</td>
              <td class="num">${Utils.formatCurrency(v.outrosAbonos)}</td>
              <td class="num">100%</td>
              <td class="num posit">${Utils.formatCurrency(v.outrosAbonos)}</td>
            </tr>` : ''}
            ${(c.complementos.gratificacaoFerias > 0) ? `
            <tr>
              <td>Gratificação de Férias (50% SB pro-rata)</td>
              <td class="num">${Utils.formatCurrency(c.salarioBase)}</td>
              <td class="num">50% × ${(c.complementos.mesesCompletos)}/12</td>
              <td class="num posit">${Utils.formatCurrency(c.complementos.gratificacaoFerias)}</td>
            </tr>` : ''}
            ${(c.complementos.subsidioNatal > 0) ? `
            <tr>
              <td>Subsídio de Natal (50% SB pro-rata)</td>
              <td class="num">${Utils.formatCurrency(c.salarioBase)}</td>
              <td class="num">50% × ${c.complementos.mesesCompletos}/12</td>
              <td class="num posit">${Utils.formatCurrency(c.complementos.subsidioNatal)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="3">Remuneração Bruta</td>
              <td class="num">${Utils.formatCurrency(c.remuneracaoBruta)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Rubricas (Descontos) -->
        <div class="recibo-section-title">Descontos Obrigatórios e Retenções</div>
        <table class="rubricas-table">
          <thead>
            <tr>
              <th style="width:40%">Descrição</th>
              <th class="num" style="width:20%">Matéria Colectável</th>
              <th class="num" style="width:15%">%</th>
              <th class="num" style="width:25%">Valor (Kz)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INSS — Contribuinte Trabalhador (Decreto 227/18)</td>
              <td class="num">${Utils.formatCurrency(c.baseINSS)}</td>
              <td class="num">3,00%</td>
              <td class="num negat">− ${Utils.formatCurrency(c.inssTrabalhador)}</td>
            </tr>
            <tr>
              <td>Imposto sobre o Rendimento do Trabalho (IRT OGE 2026)</td>
              <td class="num">${Utils.formatCurrency(c.materiaColectavelIRT)}</td>
              <td class="num">Escalão ${c.escalaoIRT || '—'}</td>
              <td class="num negat">− ${Utils.formatCurrency(c.irt)}</td>
            </tr>
            ${(v.outrosDescontos > 0) ? `
            <tr>
              <td>Outros Descontos</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num negat">− ${Utils.formatCurrency(v.outrosDescontos)}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="3">Total de Descontos</td>
              <td class="num">− ${Utils.formatCurrency(c.descontosTotais)}</td>
            </tr>
            <tr class="net-row">
              <td colspan="3"><strong>VALOR LÍQUIDO A RECEBER</strong></td>
              <td class="num"><strong>${Utils.formatCurrency(c.salarioLiquido)}</strong></td>
            </tr>
          </tbody>
        </table>

        <!-- Informação para a empresa -->
        <div class="recibo-section-title">Encargos Patronos (para informação da empresa)</div>
        <div class="info-grid">
          <div class="info-row"><span class="lbl">INSS Entidade (8%):</span><span class="val" style="color:var(--danger);font-weight:700">${Utils.formatCurrency(c.inssEntidade)}</span></div>
          <div class="info-row"><span class="lbl">Custo Total Mensal:</span><span class="val" style="color:var(--primary);font-weight:700">${Utils.formatCurrency(c.custoTotalEmpresa)}</span></div>
        </div>

        <!-- Nota legal -->
        <div class="legal-note">
          <strong>Base legal:</strong> INSS (Decreto Presidencial n.º 227/18, de 27 de Setembro, art. 12.º — 3% trabalhador / 8% entidade).
          IRT (Lei n.º 14/25, de 30 de Dezembro — OGE 2026, isenção até 150.000 Kz, 11 escalões).
          Complementos anuais: Lei Geral do Trabalho n.º 12/23, art. 238.º (50% do salário base).
          ${((c.saIncidenciaINSS > 0 || c.stIncidenciaINSS > 0)) ? `<br><strong>(¹)</strong> Parte do subsídio tributável por ultrapassar limite isento de 30.000 Kz (Lei 14/25 OGE 2026).` : ''}
        </div>

        <!-- Assinaturas -->
        <div class="recibo-footer">
          <div class="assinatura">
            <div class="linha"></div>
            <strong>${emp.nome}</strong>
            <small>Assinatura / Carimbo do Responsável de RH</small>
          </div>
          <div class="assinatura">
            <div class="linha"></div>
            <strong>${f.nome || 'O trabalhador'}</strong>
            <small>Declaro ter recebido o valor acima indicado</small>
          </div>
          <div class="legal-note" style="font-size:.75rem;text-align:center">
            Data de emissão: ${new Date().toLocaleDateString('pt-PT')} · Documento processado automaticamente por GestãoRH
          </div>
        </div>
      </div>`;
  };

  // ─── 2) MAPA CONSOLIDADO IRT / INSS ─────────────────────────────────────
  const _renderMapaIRT_INSS = (mesRef) => {
    const out = document.getElementById('mapa-irt-output');
    const folhas = Storage.query('folha', r => r.mesRef === mesRef);
    if (folhas.length === 0) {
      out.innerHTML = `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-2)">
          <div style="font-size:3rem;margin-bottom:10px">🏦</div>
          <strong style="display:block;font-size:1.05rem;margin-bottom:4px">Sem processamento para ${_mesExtenso(mesRef)}</strong>
          <p>Aceda ao módulo Folha Salarial, seleccione o mês e processe os vencimentos primeiro.</p>
        </div>`;
      return;
    }

    const linhas = [];
    let tot = {
      sb: 0, bruto: 0, baseINSS: 0, materiaIRT: 0,
      inssT: 0, inssE: 0, irt: 0, outros: 0, liquido: 0,
      custoEmp: 0, subA: 0, subT: 0, abonos: 0,
      ferias: 0, natal: 0,
    };
    let qtd = 0;

    folhas.forEach(r => {
      const f = Storage.find('funcionarios', r.funcionarioId);
      if (!f) return;
      qtd++;
      const valores = {
        subAlimentacao: r.subAlimentacao,
        subTransporte: r.subTransporte,
        outrosAbonos: r.outrosAbonos,
        outrosDescontos: r.outrosDescontos,
      };
      const c = Folha.calcSalario(f, valores);
      tot.sb += c.salarioBase;
      tot.bruto += c.remuneracaoBruta;
      tot.baseINSS += c.baseINSS;
      tot.materiaIRT += c.materiaColectavelIRT;
      tot.inssT += c.inssTrabalhador;
      tot.inssE += c.inssEntidade;
      tot.irt += c.irt;
      tot.outros += (r.outrosDescontos || 0);
      tot.liquido += c.salarioLiquido;
      tot.custoEmp += c.custoTotalEmpresa;
      tot.subA += (r.subAlimentacao || 0);
      tot.subT += (r.subTransporte || 0);
      tot.abonos += (r.outrosAbonos || 0);
      tot.ferias += c.complementos.gratificacaoFerias;
      tot.natal += c.complementos.subsidioNatal;

      linhas.push({ f, r, c });
    });

    const inssTotal = tot.inssT + tot.inssE;

    out.innerHTML = `
      <div class="mapa-header">
        <h2>🏦 MAPA CONSOLIDADO — IRT E INSS</h2>
        <p>Mês de referência: <strong>${_mesExtenso(mesRef).toUpperCase()}</strong></p>
        <p>${EMPRESA_DEFAULT.nome} · NIF: ${EMPRESA_DEFAULT.nif}</p>
      </div>

      <div class="mapa-kpis">
        <div class="mapa-kpi primary"><div class="lbl">Funcionários</div><div class="val">${qtd}</div></div>
        <div class="mapa-kpi info"><div class="lbl">Total Rem. Bruta</div><div class="val">${Utils.formatCurrency(tot.bruto)}</div></div>
        <div class="mapa-kpi"><div class="lbl">Base INSS</div><div class="val">${Utils.formatCurrency(tot.baseINSS)}</div></div>
        <div class="mapa-kpi"><div class="lbl">Matéria IRT</div><div class="val">${Utils.formatCurrency(tot.materiaIRT)}</div></div>
        <div class="mapa-kpi danger"><div class="lbl">INSS Trab (3%)</div><div class="val">${Utils.formatCurrency(tot.inssT)}</div></div>
        <div class="mapa-kpi danger"><div class="lbl">INSS Ent (8%)</div><div class="val">${Utils.formatCurrency(tot.inssE)}</div></div>
        <div class="mapa-kpi warning"><div class="lbl">INSS TOTAL (11%)</div><div class="val">${Utils.formatCurrency(inssTotal)}</div></div>
        <div class="mapa-kpi warning"><div class="lbl">Total IRT a Ret</div><div class="val">${Utils.formatCurrency(tot.irt)}</div></div>
        <div class="mapa-kpi success"><div class="lbl">Total Líquido</div><div class="val">${Utils.formatCurrency(tot.liquido)}</div></div>
        <div class="mapa-kpi primary"><div class="lbl">Custo Empresa</div><div class="val">${Utils.formatCurrency(tot.custoEmp)}</div></div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-container" style="border:none;overflow-x:auto">
          <table class="table table-mapa" style="min-width:1500px">
            <thead>
              <tr>
                <th style="min-width:70px">Nº</th>
                <th style="min-width:210px">Funcionário</th>
                <th style="min-width:110px">NIF</th>
                <th style="min-width:110px">NISS</th>
                <th class="num" style="min-width:120px">Sal. Base</th>
                <th class="num" style="min-width:110px">Sub. Alim</th>
                <th class="num" style="min-width:110px">Sub. Transp</th>
                <th class="num" style="min-width:110px">Abonos</th>
                <th class="num" style="min-width:120px">Bruto</th>
                <th class="num" style="min-width:120px">Base INSS</th>
                <th class="num" style="min-width:120px">Mat. IRT</th>
                <th class="num" style="min-width:110px">INSS 3%</th>
                <th class="num" style="min-width:110px">INSS 8%</th>
                <th class="num" style="min-width:110px">IRT</th>
                <th class="num" style="min-width:110px">Out. Desc.</th>
                <th class="num" style="min-width:130px">Líquido</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map((l, i) => `
                <tr>
                  <td>${String(i+1).padStart(2,'0')}</td>
                  <td><strong>${l.f.nome}</strong><br><span style="color:var(--text-2);font-size:.75rem">${l.f.funcao || ''} · ${l.f.departamento || ''}</span></td>
                  <td>${l.f.nif || '—'}</td>
                  <td>${l.f.niss || '—'}</td>
                  <td class="num">${Utils.formatCurrency(l.c.salarioBase)}</td>
                  <td class="num">${Utils.formatCurrency(l.r.subAlimentacao || 0)}</td>
                  <td class="num">${Utils.formatCurrency(l.r.subTransporte || 0)}</td>
                  <td class="num">${Utils.formatCurrency(l.r.outrosAbonos || 0)}</td>
                  <td class="num" style="font-weight:600">${Utils.formatCurrency(l.c.remuneracaoBruta)}</td>
                  <td class="num" style="color:#4361ee">${Utils.formatCurrency(l.c.baseINSS)}</td>
                  <td class="num" style="color:#7209b7">${Utils.formatCurrency(l.c.materiaColectavelIRT)}</td>
                  <td class="num" style="color:var(--danger)">${Utils.formatCurrency(l.c.inssTrabalhador)}</td>
                  <td class="num" style="color:var(--danger)">${Utils.formatCurrency(l.c.inssEntidade)}</td>
                  <td class="num" style="color:var(--warning);font-weight:600">${Utils.formatCurrency(l.c.irt)}</td>
                  <td class="num">${Utils.formatCurrency(l.r.outrosDescontos || 0)}</td>
                  <td class="num" style="font-weight:700;color:var(--success)">${Utils.formatCurrency(l.c.salarioLiquido)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"><strong>TOTAIS DO MÊS</strong></td>
                <td class="num">${Utils.formatCurrency(tot.sb)}</td>
                <td class="num">${Utils.formatCurrency(tot.subA)}</td>
                <td class="num">${Utils.formatCurrency(tot.subT)}</td>
                <td class="num">${Utils.formatCurrency(tot.abonos)}</td>
                <td class="num">${Utils.formatCurrency(tot.bruto)}</td>
                <td class="num">${Utils.formatCurrency(tot.baseINSS)}</td>
                <td class="num">${Utils.formatCurrency(tot.materiaIRT)}</td>
                <td class="num">${Utils.formatCurrency(tot.inssT)}</td>
                <td class="num">${Utils.formatCurrency(tot.inssE)}</td>
                <td class="num">${Utils.formatCurrency(tot.irt)}</td>
                <td class="num">${Utils.formatCurrency(tot.outros)}</td>
                <td class="num">${Utils.formatCurrency(tot.liquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Resumo para entrega à AT e INSS -->
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <strong>📋 Resumo para entrega às entidades</strong>
        </div>
        <div style="padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
          <div style="padding:14px;border:1px solid var(--border);border-radius:8px;border-left:4px solid var(--warning)">
            <div style="font-weight:700;color:var(--warning);margin-bottom:8px">➊ Declaração à AT (Impostos) — IRT</div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Nº trabalhadores:</span><span class="val">${qtd}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Matéria colectável total:</span><span class="val">${Utils.formatCurrency(tot.materiaIRT)}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">IRT retido no mês:</span><span class="val" style="color:var(--warning);font-weight:700">${Utils.formatCurrency(tot.irt)}</span></div>
            <div style="margin-top:8px;font-size:.75rem;color:var(--text-2)">Fonte: Lei 14/25 OGE 2026 — entregar declaração mensal Modelo 3 até ao dia 20 do mês seguinte.</div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:8px;border-left:4px solid var(--danger)">
            <div style="font-weight:700;color:var(--danger);margin-bottom:8px">➋ Declaração ao INSS — Segurança Social</div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Nº segurados:</span><span class="val">${qtd}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Base de incidência:</span><span class="val">${Utils.formatCurrency(tot.baseINSS)}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Contribuição trab (3%):</span><span class="val">${Utils.formatCurrency(tot.inssT)}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Contribuição ent (8%):</span><span class="val">${Utils.formatCurrency(tot.inssE)}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Total a entregar INSS:</span><span class="val" style="color:var(--danger);font-weight:700">${Utils.formatCurrency(inssTotal)}</span></div>
            <div style="margin-top:8px;font-size:.75rem;color:var(--text-2)">Fonte: Decreto 227/18 art.12º — entregar até ao último dia útil do mês seguinte.</div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:8px;border-left:4px solid var(--primary)">
            <div style="font-weight:700;color:var(--primary);margin-bottom:8px">➌ Complementos anuais informativos</div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Grat. Férias (pro-rata):</span><span class="val">${Utils.formatCurrency(tot.ferias)}</span></div>
            <div class="info-row" style="padding:4px 0"><span class="lbl" style="min-width:160px">Subs. Natal (pro-rata):</span><span class="val">${Utils.formatCurrency(tot.natal)}</span></div>
            <div style="margin-top:8px;font-size:.75rem;color:var(--text-2)">Fonte: Lei Geral do Trabalho 12/23 art. 238º — 50% SB pro-rata meses completos.</div>
          </div>
        </div>
      </div>`;
  };

  // ─── 3) MAPA BANCÁRIO PARA TRANSFERÊNCIA ─────────────────────────────────
  const _renderMapaBancario = (mesRef) => {
    const out = document.getElementById('mapa-banco-output');
    const folhas = Storage.query('folha', r => r.mesRef === mesRef);
    if (folhas.length === 0) {
      out.innerHTML = `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-2)">
          <div style="font-size:3rem;margin-bottom:10px">💸</div>
          <strong style="display:block;font-size:1.05rem;margin-bottom:4px">Sem processamento para ${_mesExtenso(mesRef)}</strong>
          <p>Primeiro processe a folha salarial do mês.</p>
        </div>`;
      return;
    }

    const linhas = [];
    const contagem = { total: 0, comIBAN: 0, semIBAN: 0 };
    let totLiquido = 0;

    folhas.forEach(r => {
      const f = Storage.find('funcionarios', r.funcionarioId);
      if (!f) return;
      contagem.total++;
      const valores = {
        subAlimentacao: r.subAlimentacao, subTransporte: r.subTransporte,
        outrosAbonos: r.outrosAbonos, outrosDescontos: r.outrosDescontos,
      };
      const c = Folha.calcSalario(f, valores);
      totLiquido += c.salarioLiquido;

      if (f.iban && f.iban.trim()) contagem.comIBAN++;
      else contagem.semIBAN++;

      linhas.push({ f, r, c });
    });

    out.innerHTML = `
      <div class="mapa-header">
        <h2>💸 MAPA BANCÁRIO — ORDEM DE TRANSFERÊNCIA</h2>
        <p>Mês de referência: <strong>${_mesExtenso(mesRef).toUpperCase()}</strong> · Data de processamento: ${new Date().toLocaleDateString('pt-PT')}</p>
        <p>Ordem de Pagamento emitida por: <strong>${EMPRESA_DEFAULT.nome}</strong> · ${EMPRESA_DEFAULT.morada}</p>
      </div>

      <div class="mapa-kpis">
        <div class="mapa-kpi primary"><div class="lbl">Total Funcionários</div><div class="val">${contagem.total}</div></div>
        <div class="mapa-kpi success"><div class="lbl">Com IBAN cadastrado</div><div class="val">${contagem.comIBAN}</div></div>
        <div class="mapa-kpi danger"><div class="lbl">Sem IBAN</div><div class="val">${contagem.semIBAN}</div></div>
        <div class="mapa-kpi info"><div class="lbl">VALOR TOTAL A TRANSFERIR</div><div class="val">${Utils.formatCurrency(totLiquido)}</div></div>
      </div>

      ${contagem.semIBAN > 0 ? `
      <div class="card" style="margin-bottom:18px;padding:14px 18px;background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #f9a825;color:#795548;font-size:.85rem">
        ⚠ <strong>Aviso:</strong> Existem <strong>${contagem.semIBAN}</strong> funcionário(s) sem IBAN/Nº de Conta cadastrado.
        Edite o cadastro no módulo <a href="funcionarios.html" style="color:var(--primary);font-weight:700">Funcionários</a> para incluir os dados bancários antes de enviar ao banco.
      </div>` : ''}

      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-container" style="border:none;overflow-x:auto">
          <table class="table table-mapa" style="min-width:1200px">
            <thead>
              <tr>
                <th style="min-width:50px">Nº</th>
                <th style="min-width:110px">Nº Int.</th>
                <th style="min-width:240px">Nome do Beneficiário</th>
                <th style="min-width:110px">NIF</th>
                <th style="min-width:160px">Banco</th>
                <th style="min-width:180px">Número da Conta</th>
                <th style="min-width:260px">IBAN (Formato AO06…)</th>
                <th style="min-width:100px">Moeda</th>
                <th class="num" style="min-width:160px">Valor a Transferir (Kz)</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map((l, i) => {
                const faltaIBAN = !l.f.iban || !l.f.iban.trim();
                return `
                <tr style="${faltaIBAN ? 'background:#fff8e1' : ''}">
                  <td>${String(i+1).padStart(2,'0')}</td>
                  <td>${l.f.id_display || '—'}</td>
                  <td><strong>${l.f.nome}</strong><br><span style="color:var(--text-2);font-size:.75rem">${l.f.funcao || ''}</span></td>
                  <td>${l.f.nif || '—'}</td>
                  <td>${faltaIBAN && !l.f.banco ? '<span style="color:var(--danger)"><strong>Preencher</strong></span>' : (l.f.banco || '—')}</td>
                  <td>${faltaIBAN && !l.f.numeroConta ? '<span style="color:var(--danger)"><strong>Preencher</strong></span>' : (l.f.numeroConta || '—')}</td>
                  <td class="iban-cell" style="${faltaIBAN ? 'color:var(--danger);font-weight:700' : ''}">
                    ${faltaIBAN ? '⚠ SEM IBAN' : l.f.iban}
                  </td>
                  <td>AOA — Kz</td>
                  <td class="num" style="font-weight:700;color:var(--success)">${Utils.formatCurrency(l.c.salarioLiquido)}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8" style="text-align:right;padding-right:20px">
                  <strong style="font-size:1rem">TOTAL GERAL A TRANSFERIR</strong>
                </td>
                <td class="num" style="font-size:1.1rem">${Utils.formatCurrency(totLiquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Bloco de instruções para o banco -->
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <strong>📝 Instruções para o Departamento Financeiro / Banco</strong>
        </div>
        <div style="padding:18px">
          <ol style="line-height:1.9;color:var(--text-2);font-size:.88rem;padding-left:20px;margin:0">
            <li>Confirmar que o montante <strong>${Utils.formatCurrency(totLiquido)}</strong> está disponível na conta de origem da empresa.</li>
            <li>Para cada linha, verificar o <strong>IBAN</strong> e o nome do beneficiário antes de autorizar a transferência.</li>
            <li>Funcionários assinalados a <span style="color:var(--danger);font-weight:700">amarelo/vermelho</span> não têm IBAN — pedir os dados e proceder ao pagamento por outro meio (cheque, numerário) ou actualizar o cadastro e re-gerar o mapa.</li>
            <li>Moeda de pagamento: <strong>Kwanza Angolano (AOA)</strong>. Transferências interbancárias através do sistema <em>Transferências Interbancárias Angolanas</em>.</li>
            <li>Referência de pagamentos a indicar no extracto: <strong style="color:var(--primary)">SALÁRIOS ${_mesExtenso(mesRef).toUpperCase().replace(' DE ', '/').replace(' ','')}</strong></li>
            <li>Após confirmação das transferências, arquivar este mapa juntamente com os comprovativos de pagamento para efeitos de auditoria interna.</li>
          </ol>

          <div style="margin-top:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px;text-align:center">
            <div class="assinatura">
              <div class="linha"></div>
              <strong>Responsável de Recursos Humanos</strong>
              <small>Aprovação dos vencimentos</small>
            </div>
            <div class="assinatura">
              <div class="linha"></div>
              <strong>Responsável Financeiro</strong>
              <small>Autorização de pagamento</small>
            </div>
            <div class="assinatura">
              <div class="linha"></div>
              <strong>Administrador-Delegado</strong>
              <small>Visto final</small>
            </div>
          </div>
        </div>
      </div>`;
  };

  // ─── Bindings gerais ────────────────────────────────────────────────────
  const _bind = () => {
    _setupTabs();

    // Selectores de mês — sincronizados mas independentes
    _setupMesSelector('recibo-mes', v => { state.mesRef = v; _setupFuncSelector('recibo-func'); });
    _setupMesSelector('mapa-mes',   v => { state.mesRef = v; });
    _setupMesSelector('banco-mes',  v => { state.mesRef = v; });

    _setupFuncSelector('recibo-func');

    // Botões
    const btn1 = document.getElementById('btn-gerar-recibo');
    if (btn1) btn1.addEventListener('click', () => {
      const funcId = document.getElementById('recibo-func').value;
      const mes = document.getElementById('recibo-mes').value;
      if (!funcId) {
        Utils.toast('Seleccione um funcionário para gerar o recibo.', 'warning');
        return;
      }
      const d = _buscarFolhaFuncionario(funcId, mes);
      _renderRecibo(d);
      Utils.toast('Recibo de salário gerado!', 'success');
    });

    const btn2 = document.getElementById('btn-gerar-mapa-irt');
    if (btn2) btn2.addEventListener('click', () => {
      const mes = document.getElementById('mapa-mes').value;
      _renderMapaIRT_INSS(mes);
      Utils.toast('Mapa IRT / INSS consolidado gerado!', 'success');
    });

    const btn3 = document.getElementById('btn-gerar-mapa-banco');
    if (btn3) btn3.addEventListener('click', () => {
      const mes = document.getElementById('banco-mes').value;
      _renderMapaBancario(mes);
      Utils.toast('Mapa bancário para transferência gerado!', 'success');
    });
  };

  // ─── Inicialização ──────────────────────────────────────────────────────
  const init = () => {
    Nav.render();
    _bind();
    // Placeholders iniciais
    _renderRecibo(null);
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Relatorios.init());
