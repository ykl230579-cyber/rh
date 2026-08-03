/**
 * Nav - Injeta o menu lateral e o header em todas as páginas
 */
const Nav = (() => {

  const CURRENT_PAGE = window.location.pathname.split('/').pop().replace('.html', '');

  const NAV_ITEMS = [
    { id: 'dashboard',    label: 'Dashboard',      icon: '◈', href: 'dashboard.html' },
    { id: 'funcionarios', label: 'Funcionários',   icon: '👥', href: 'funcionarios.html' },
    { id: 'contratos',    label: 'Contratos',      icon: '📄', href: 'contratos.html' },
    { id: 'folha',        label: 'Folha Salarial', icon: '💰', href: 'folha.html' },
    { id: 'ferias',       label: 'Férias',         icon: '🏖', href: 'ferias.html' },
    { id: 'desempenho',   label: 'Desempenho',     icon: '⭐', href: 'desempenho.html' },
    { id: 'documentos',   label: 'Documentos',     icon: '🗂', href: 'documentos.html' },
    { id: 'recrutamento', label: 'Recrutamento',   icon: '🎯', href: 'recrutamento.html' },
  ];

  const render = () => {
    const isIndex = CURRENT_PAGE === 'index' || CURRENT_PAGE === '';
    const basePath = isIndex ? 'pages/' : '';
    const backPath = isIndex ? '' : '../';

    const items = NAV_ITEMS.map(item => {
      const active = !isIndex && CURRENT_PAGE === item.id;
      const href = isIndex ? basePath + item.href : item.href;
      return `
        <a href="${href}" class="nav-item ${active ? 'active' : ''}" title="${item.label}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${active ? '<span class="nav-indicator"></span>' : ''}
        </a>`;
    }).join('');

    const sidebar = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo">RH</div>
          <div class="brand-text">
            <span class="brand-name">GestãoRH</span>
            <span class="brand-sub">Sistema de RH</span>
          </div>
        </div>
        <nav class="sidebar-nav">${items}</nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">A</div>
            <div class="user-info">
              <span class="user-name">Administrador</span>
              <span class="user-role">RH Manager</span>
            </div>
          </div>
        </div>
      </aside>`;

    const header = `
      <header class="topbar">
        <button class="menu-toggle" id="menu-toggle" onclick="Nav.toggleSidebar()">☰</button>
        <div class="topbar-search">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Pesquisar no sistema..." class="search-input" id="global-search">
        </div>
        <div class="topbar-actions">
          <div class="topbar-date">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
      </header>`;

    document.body.insertAdjacentHTML('afterbegin', sidebar + header);

    // Overlay para mobile
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    overlay.onclick = () => Nav.closeSidebar();
    document.body.appendChild(overlay);
  };

  const toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
  };

  const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  };

  return { render, toggleSidebar, closeSidebar };
})();

document.addEventListener('DOMContentLoaded', () => Nav.render());
