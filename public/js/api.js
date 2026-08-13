// Shared nav helper
const NAV_ITEMS = [
  { href: 'index.html',        icon: '<i class="ph ph-house"></i>', label: 'Dashboard' },
  { href: 'aprendices.html',   icon: '<i class="ph ph-users"></i>', label: 'Aprendices' },
  { href: 'fichas.html',       icon: '<i class="ph ph-clipboard-text"></i>', label: 'Fichas' },
  { href: 'import.html',       icon: '<i class="ph ph-upload-simple"></i>', label: 'Importar Excel' },
];

function buildNav(activeHref) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(item => {
    const active = location.pathname.endsWith(item.href) || (item.href === 'index.html' && location.pathname.endsWith('/')) ? 'active' : '';
    return `<a href="${item.href}" class="nav-item ${active}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
    </a>`;
  }).join('');
}

// API helper
const API = {
  get: (url) => fetch('/api' + url).then(r => r.json()),
  post: (url, body) => fetch('/api' + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  put: (url, body) => fetch('/api' + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  del: (url) => fetch('/api' + url, { method: 'DELETE' }).then(r => r.json()),
  upload: (url, formData) => fetch('/api' + url, { method: 'POST', body: formData }).then(r => r.json()),
};

// Badge helpers
function juicioBadge(v) {
  if (!v) return `<span class="badge badge-gray">—</span>`;
  if (v === 'Aprobado')    return `<span class="badge badge-green"><i class="ph ph-check-circle"></i> Aprobado</span>`;
  if (v === 'No Aprobado') return `<span class="badge badge-red"><i class="ph ph-x-circle"></i> No Aprobado</span>`;
  return `<span class="badge badge-orange"><i class="ph ph-hourglass"></i> Por Evaluar</span>`;
}
function estadoBadge(v) {
  if (!v) return `<span class="badge badge-gray">—</span>`;
  if (v === 'En Formación')      return `<span class="badge badge-blue">${v}</span>`;
  if (v === 'Retiro Voluntario') return `<span class="badge badge-red">${v}</span>`;
  if (v === 'Cedido')            return `<span class="badge badge-orange">${v}</span>`;
  return `<span class="badge badge-gray">${v}</span>`;
}
function dotColor(v) {
  if (v === 'Aprobado')    return 'green';
  if (v === 'No Aprobado') return 'red';
  return 'orange';
}

document.addEventListener('DOMContentLoaded', () => buildNav());
