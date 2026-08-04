/**
 * Utils - Funções utilitárias globais
 */
const Utils = (() => {

  /** Gera um ID único */
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /** Formata data para exibição (DD/MM/AAAA) */
  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-PT');
  };

  /** Formata data ISO para input date (AAAA-MM-DD) */
  const toInputDate = (iso) => {
    if (!iso) return '';
    return iso.slice(0, 10);
  };

  /** Formata valor como moeda (Kz) */
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
  };

  /** Calcula dias entre duas datas */
  const daysBetween = (dateA, dateB) => {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  };

  /** Capitaliza a primeira letra */
  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  // ─── Toast Notifications ──────────────────────────────────────────────────

  const _ensureToastContainer = () => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  const toast = (message, type = 'success', duration = 3500) => {
    const container = _ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;

    container.appendChild(el);
    setTimeout(() => el.classList.add('toast-show'), 10);
    setTimeout(() => {
      el.classList.remove('toast-show');
      setTimeout(() => el.remove(), 400);
    }, duration);
  };

  // ─── Modal ────────────────────────────────────────────────────────────────

  const openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  const showLoading = () => {
    let el = document.getElementById('global-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loading';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    el.classList.add('loading-show');
  };

  const hideLoading = () => {
    const el = document.getElementById('global-loading');
    if (el) el.classList.remove('loading-show');
  };

  // ─── Confirmação ─────────────────────────────────────────────────────────

  const confirm = (message, onConfirm) => {
    let overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'modal modal-open';
    overlay.innerHTML = `
      <div class="modal-box confirm-box">
        <div class="confirm-icon">⚠️</div>
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
          <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('confirm-ok').onclick = () => { onConfirm(); overlay.remove(); };
    document.getElementById('confirm-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  };

  // ─── Highlight de busca ───────────────────────────────────────────────────

  const highlight = (text, query) => {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).replace(re, '<mark>$1</mark>');
  };

  return {
    generateId, formatDate, toInputDate, formatCurrency,
    daysBetween, capitalize, toast, openModal, closeModal,
    showLoading, hideLoading, confirm, highlight
  };
})();
