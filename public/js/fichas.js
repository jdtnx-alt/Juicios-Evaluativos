let editingId = null;

async function loadProgramas() {
  const programas = await API.get('/programas');
  const sel = document.getElementById('f-programa');
  programas.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id_programa;
    opt.textContent = p.nombre;
    sel.appendChild(opt);
  });
}

async function loadFichas() {
  const tbody = document.getElementById('fichas-tbody');
  tbody.innerHTML = `<tr><td colspan="5"><div class="spinner"></div></td></tr>`;
  const fichas = await API.get('/fichas');
  document.getElementById('total-fichas').textContent = `${fichas.length} fichas`;

  if (!fichas.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"><i class="ph ph-folder-open"></i></div><p>No hay fichas registradas.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = fichas.map(f => `
    <tr>
      <td><strong>Ficha ${f.numero}</strong></td>
      <td>${f.jornada ? `<span class="badge badge-blue">${f.jornada}</span>` : '—'}</td>
      <td>${f.programa_nombre || '<span style="color:var(--muted)">Sin programa</span>'}</td>
      <td><span class="badge badge-gray">${f.total_aprendices} aprendices</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <a href="aprendices.html?ficha=${f.id_ficha}" class="btn btn-outline btn-sm"><i class="ph ph-users"></i> Ver</a>
          <button class="btn btn-outline btn-sm btn-edit" data-id="${f.id_ficha}"
            data-numero="${f.numero}" data-jornada="${f.jornada||''}" data-prog="${f.id_programa||''}"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn btn-danger btn-sm btn-del" data-id="${f.id_ficha}"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id, btn.dataset.numero, btn.dataset.jornada, btn.dataset.prog));
  });
  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => deleteFicha(btn.dataset.id));
  });
}

function openModal(id = null, numero = '', jornada = '', prog = '') {
  editingId = id;
  document.getElementById('modal-title').textContent = id ? 'Editar Ficha' : 'Nueva Ficha';
  document.getElementById('f-numero').value  = numero;
  document.getElementById('f-jornada').value = jornada;
  document.getElementById('f-programa').value = prog;
  document.getElementById('form-error').innerHTML = '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function saveFicha() {
  const numero     = document.getElementById('f-numero').value.trim();
  const jornada    = document.getElementById('f-jornada').value;
  const id_programa = document.getElementById('f-programa').value || null;
  const errDiv     = document.getElementById('form-error');

  if (!numero) { errDiv.innerHTML = '<div class="alert alert-error">⚠ El número de ficha es requerido.</div>'; return; }

  const payload = { numero, jornada: jornada || null, id_programa };
  const res = editingId ? await API.put(`/fichas/${editingId}`, payload) : await API.post('/fichas', payload);

  if (res.error) { errDiv.innerHTML = `<div class="alert alert-error">⚠ ${res.error}</div>`; return; }
  closeModal();
  loadFichas();
}

async function deleteFicha(id) {
  if (!confirm('¿Eliminar esta ficha? Los aprendices asociados quedarán sin ficha.')) return;
  const res = await API.del(`/fichas/${id}`);
  if (res.ok) {
    loadFichas();
  } else {
    alert('❌ Error al eliminar la ficha: ' + (res.error || 'Desconocido'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProgramas();
  loadFichas();
  document.getElementById('btn-nueva').addEventListener('click', () => openModal());
  document.getElementById('modal-save').addEventListener('click', saveFicha);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
});
