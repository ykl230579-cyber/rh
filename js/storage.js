/**
 * Storage - Camada de armazenamento centralizada via LocalStorage
 */
const Storage = (() => {
  const PREFIX = 'gestaoRH_';

  const _key = (store) => `${PREFIX}${store}`;

  const _load = (store) => {
    try {
      return JSON.parse(localStorage.getItem(_key(store))) || [];
    } catch {
      return [];
    }
  };

  const _persist = (store, data) => {
    localStorage.setItem(_key(store), JSON.stringify(data));
  };

  const _purgeDemoData = () => {
    const stores = ['funcionarios', 'contratos', 'folha', 'ferias', 'avaliacoes', 'documentos', 'recrutamento'];
    const funcs = _load('funcionarios');
    const funcIds = new Set(funcs.map(f => f.id));

    stores.forEach(store => {
      const data = _load(store);
      const cleaned = data.filter(item => {
        // Se for uma tabela vinculada a funcionário, verifica se o funcionário ainda existe
        if (item.funcionarioId && !funcIds.has(item.funcionarioId)) {
          return false;
        }
        // Se contiver IDs demo legados
        if (item.id && typeof item.id === 'string' && (
          item.id.startsWith('f-') || item.id.startsWith('c-') ||
          item.id.startsWith('fo-') || item.id.startsWith('fe-') ||
          item.id.startsWith('av-') || item.id.startsWith('d-') ||
          item.id.startsWith('r-')
        )) {
          return false;
        }
        return true;
      });
      if (cleaned.length !== data.length) {
        _persist(store, cleaned);
      }
    });
  };

  // Garante que a base de dados inicia totalmente limpa sem dados fictícios ou órfãos
  _purgeDemoData();

  /** Retorna todos os registros de uma store */
  const findAll = (store) => _load(store);

  /** Retorna um registro pelo ID */
  const find = (store, id) => _load(store).find((r) => r.id === id) || null;

  /** Salva um novo registro (gera ID automático) */
  const save = (store, record) => {
    const data = _load(store);
    const newRecord = { ...record, id: record.id || Utils.generateId(), createdAt: new Date().toISOString() };
    data.push(newRecord);
    _persist(store, data);
    return newRecord;
  };

  /** Atualiza um registro existente pelo ID */
  const update = (store, id, changes) => {
    const data = _load(store);
    const idx = data.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...changes, updatedAt: new Date().toISOString() };
    _persist(store, data);
    return data[idx];
  };

  /** Remove um registro pelo ID */
  const remove = (store, id) => {
    const data = _load(store).filter((r) => r.id !== id);
    _persist(store, data);
  };

  /** Remove todos os registros de uma store */
  const clear = (store) => _persist(store, []);

  /** Busca registros com filtro funcional */
  const query = (store, predicate) => _load(store).filter(predicate);

  return { findAll, find, save, update, remove, clear, query };
})();
