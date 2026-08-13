let state = { q: '', ficha: '', estado: '', juicio: '', page: 1, total: 0, pages: 1 };

// Read URL params on load
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('ficha')) state.ficha = urlParams.get('ficha');

async function loadFichas() {
  const fichas = await API.get('/fichas');
  const sel = document.getElementById('filter-ficha');
  fichas.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id_ficha;
    opt.textContent = `Ficha ${f.numero}${f.programa_nombre ? ' · ' + f.programa_nombre.substring(0,30) : ''}`;
    // Pre-select if URL param matches numero
    if (state.ficha && (String(f.id_ficha) === state.ficha || f.numero === state.ficha)) {
      opt.selected = true;
      state.ficha = String(f.id_ficha);
    }
    sel.appendChild(opt);
  });
}

async function loadAprendices() {
  const tbody = document.getElementById('aprendices-tbody');
  tbody.innerHTML = `<tr><td colspan="9"><div class="spinner"></div></td></tr>`;

  const qs = new URLSearchParams({ q: state.q, ficha: state.ficha, estado: state.estado, juicio: state.juicio, page: state.page, limit: 20 });
  const res = await API.get(`/aprendices?${qs}`);

  state.total = res.total;
  state.pages = res.pages;

  document.getElementById('total-badge').textContent = `${res.total} aprendices`;
  document.getElementById('table-title').textContent =
    state.ficha ? `Aprendices — Ficha ${document.querySelector('#filter-ficha option:checked')?.textContent || ''}` : 'Aprendices';

  if (!res.data.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon"><i class="ph ph-magnifying-glass"></i></div><p>No se encontraron aprendices con esos filtros.</p></div></td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = res.data.map(a => {
    const evaluadas = (a.aprobadas||0) + (a.no_aprobadas||0);
    const total = a.total_juicios || 0;
    const pct = total ? Math.round((evaluadas / total) * 100) : 0;
    
    return `<tr data-id="${a.id_aprendiz}">
      <td><span class="badge badge-gray">${a.tipo_documento||'—'}</span></td>
      <td><strong>${a.documento}</strong></td>
      <td>
        <div style="font-weight:600">${a.nombre} ${a.apellido||''}</div>
      </td>
      <td>${estadoBadge(a.estado)}</td>
      <td>${a.ficha_numero ? `<span class="badge badge-blue">Ficha ${a.ficha_numero}</span>` : '—'}</td>
      <td>
        <div class="progress-row">
          <div class="progress-bar-wrap">
            <div class="progress-bar green" style="width:${pct}%"></div>
          </div>
          <span style="font-size:12px;color:var(--muted);width:36px">${pct}%</span>
        </div>
      </td>
      <td>
        <button class="btn btn-outline btn-sm btn-detalle" data-id="${a.id_aprendiz}">Ver Competencias →</button>
      </td>
    </tr>`;
  }).join('');

  renderPagination();

  // Click row or button
  document.querySelectorAll('tbody tr, .btn-detalle').forEach(el => {
    el.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) openModal(id);
    });
  });
}

function renderPagination() {
  const pag = document.getElementById('pagination');
  if (state.pages <= 1) { pag.innerHTML = ''; return; }
  const from = (state.page - 1) * 20 + 1;
  const to   = Math.min(state.page * 20, state.total);
  pag.innerHTML = `
    <span class="pag-info">Mostrando ${from}–${to} de ${state.total}</span>
    <div class="pag-btns">
      <button class="pag-btn" id="pag-prev" ${state.page===1?'disabled':''}>← Anterior</button>
      <button class="pag-btn active">${state.page}</button>
      <button class="pag-btn" id="pag-next" ${state.page===state.pages?'disabled':''}>Siguiente →</button>
    </div>`;
  document.getElementById('pag-prev')?.addEventListener('click', () => { state.page--; loadAprendices(); });
  document.getElementById('pag-next')?.addEventListener('click', () => { state.page++; loadAprendices(); });
}

let searchTimer;
let currentModalCompetencias = [];

async function openModal(id) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  document.getElementById('modal-comps').innerHTML = '<div class="spinner"></div>';
  document.getElementById('modal-info').innerHTML  = '';
  document.getElementById('modal-nombre').textContent = 'Cargando…';
  
  // Limpiar filtros del modal
  document.getElementById('modal-search').value = '';
  document.getElementById('modal-filter-juicio').value = '';

  const data = await API.get(`/aprendices/${id}/detalle`);
  const a    = data.aprendiz;
  currentModalCompetencias = data.competencias;

  document.getElementById('modal-nombre').textContent = `${a.nombre} ${a.apellido || ''}`;
  document.getElementById('modal-doc').textContent    = `${a.tipo_documento || ''} ${a.documento}`;

  document.getElementById('modal-info').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div class="info-item"><div class="info-label">Estado</div><div class="info-value">${estadoBadge(a.estado)}</div></div>
        <div class="info-item"><div class="info-label">Ficha</div><div class="info-value">${a.ficha_numero ? `Ficha ${a.ficha_numero}` : '—'}</div></div>
        <div class="info-item"><div class="info-label">Programa</div><div class="info-value">${a.programa_nombre || '—'}</div></div>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-descargar-pdf" style="gap:8px;"><i class="ph ph-file-pdf" style="font-size:18px;"></i> Descargar Reporte</button>
      </div>
    </div>
  `;

  document.getElementById('btn-descargar-pdf').onclick = () => generatePDF(a, data.competencias);

  if (!data.competencias.length) {
    document.getElementById('modal-comps').innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="ph ph-folder-open"></i></div><p>Sin competencias registradas.</p></div>`;
    return;
  }

  renderModalComps();
}

function renderModalComps() {
  const q = document.getElementById('modal-search').value.toLowerCase();
  const j = document.getElementById('modal-filter-juicio').value;
  
  const filtered = currentModalCompetencias.filter(c => {
    const matchQ = !q || (c.competencia && c.competencia.toLowerCase().includes(q));
    const matchJ = !j || c.estado_juicio === j;
    return matchQ && matchJ;
  });

  if (!filtered.length) {
    document.getElementById('modal-comps').innerHTML = `<div class="empty-state" style="padding:20px 0;"><p>No se encontraron competencias con esos filtros.</p></div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(c => {
    const compName = c.competencia || '—';
    if (!grouped[compName]) grouped[compName] = [];
    grouped[compName].push(c);
  });

  document.getElementById('modal-comps').innerHTML = Object.keys(grouped).map((compName, idx) => {
    const group = grouped[compName];
    // General dot color for the group: red if any No Aprobado, orange if any Por Evaluar, else green
    let groupStatus = 'Aprobado';
    if (group.some(c => c.estado_juicio === 'No Aprobado')) groupStatus = 'No Aprobado';
    else if (group.some(c => c.estado_juicio === 'Por Evaluar')) groupStatus = 'Por Evaluar';
    const groupDc = dotColor(groupStatus);

    return `
      <div class="comp-group" style="margin-bottom: 8px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--card2);">
        <div class="comp-group-header" onclick="const res = document.getElementById('group-res-${idx}'); const icon = document.getElementById('group-icon-${idx}'); if(res.style.display==='none'){res.style.display='block'; icon.style.transform='rotate(180deg)';}else{res.style.display='none'; icon.style.transform='rotate(0deg)';}" style="padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
          <div style="display:flex; align-items:center; gap: 12px; flex: 1;">
            <div class="comp-item-dot ${groupDc}" style="position:static;"></div>
            <div style="font-weight: 600; font-size: 13px; line-height: 1.4;">${compName}</div>
          </div>
          <div style="font-size: 12px; color: var(--muted); display:flex; align-items:center; gap: 8px; white-space:nowrap;">
            <span class="badge badge-gray" style="font-weight:600;">${group.length} resultado(s)</span>
            <i id="group-icon-${idx}" class="ph ph-caret-down" style="transition: transform 0.2s; font-size: 16px;"></i>
          </div>
        </div>
        <div id="group-res-${idx}" style="display: none; padding: 12px 16px; background: var(--surface); border-top: 1px solid var(--border);">
          ${group.map((c, i) => {
             const dc = dotColor(c.estado_juicio);
             const func = c.func_nombre ? c.func_nombre : 'Sin asignar';
             return `
               <div style="margin-bottom: ${i === group.length - 1 ? '0' : '12px'}; display:flex; gap: 12px;">
                 <div class="comp-item-dot ${dc}" style="position:static; margin-top: 6px;"></div>
                 <div style="flex:1;">
                   <div style="font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 4px;">${c.resultado || '—'}</div>
                   <div class="comp-item-meta" style="margin-top: 0;">
                     <span>${juicioBadge(c.estado_juicio)}</span>
                     <span><i class="ph ph-user"></i> ${func}</span>
                     ${c.fecha_hora ? `<span><i class="ph ph-clock"></i> ${formatDateTime(c.fecha_hora)}</span>` : ''}
                   </div>
                 </div>
               </div>
               ${i < group.length - 1 ? '<hr style="border:0; border-top:1px dashed var(--border); margin:12px 0;">' : ''}
             `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function generatePDF(aprendiz, competencias) {
  // Construir HTML invisible para el PDF
  const d = new Date().toLocaleDateString();
  const html = `
    <div style="padding:40px; font-family:sans-serif; color:#333;">
      <div style="text-align:center; border-bottom:2px solid #00A651; padding-bottom:20px; margin-bottom:30px;">
        <h1 style="color:#00A651; margin:0 0 10px 0; font-size:24px;">SENA — Reporte de Evaluaciones</h1>
        <div style="font-size:14px; color:#666;">Generado el ${d}</div>
      </div>
      
      <table style="width:100%; margin-bottom:30px; font-size:14px; border-collapse:collapse;">
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Aprendiz:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${aprendiz.nombre} ${aprendiz.apellido||''}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Documento:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${aprendiz.tipo_documento||''} ${aprendiz.documento}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Programa:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${aprendiz.programa_nombre||'—'}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Ficha:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${aprendiz.ficha_numero||'—'}</td></tr>
        <tr><td style="padding:8px; border-bottom:1px solid #eee;"><strong>Estado:</strong></td><td style="padding:8px; border-bottom:1px solid #eee;">${aprendiz.estado}</td></tr>
      </table>

      <h3 style="margin-bottom:16px; font-size:18px;">Competencias y Resultados</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px; border:1px solid #ddd;">Competencia</th>
            <th style="padding:10px; border:1px solid #ddd;">Resultado</th>
            <th style="padding:10px; border:1px solid #ddd;">Juicio</th>
            <th style="padding:10px; border:1px solid #ddd;">Funcionario</th>
          </tr>
        </thead>
        <tbody>
          ${competencias.map(c => `
            <tr>
              <td style="padding:10px; border:1px solid #ddd;">${c.competencia||'—'}</td>
              <td style="padding:10px; border:1px solid #ddd;">${c.resultado||'—'}</td>
              <td style="padding:10px; border:1px solid #ddd; font-weight:bold; color:${c.estado_juicio==='Aprobado'?'#00A651':c.estado_juicio==='No Aprobado'?'#ef4444':'#f59e0b'};">${c.estado_juicio||'Por Evaluar'}</td>
              <td style="padding:10px; border:1px solid #ddd;">${c.func_nombre||'—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const opt = {
    margin:       [0.5, 0.5, 0.5, 0.5],
    filename:     `Reporte_SENA_${aprendiz.documento}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  const btn = document.getElementById('btn-descargar-pdf');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generando...';
  btn.disabled = true;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  
  html2pdf().set(opt).from(wrapper).save().then(() => {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  // Si ya viene formateado YYYY-MM-DD HH:MM
  if (typeof iso === 'string' && iso.includes('-')) {
    const [date, time] = iso.split(' ');
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}${time ? ' ' + time : ''}`;
  }
  // Fallback para números seriales de Excel
  const num = Number(iso);
  if (!isNaN(num) && num > 30000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      const fraction = num - Math.floor(num);
      let timeStr = '';
      if (fraction > 0) {
        const totalSeconds = Math.round(fraction * 86400);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2,'0');
        const mins  = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2,'0');
        timeStr = ` ${hours}:${mins}`;
      }
      return `${dd}/${mm}/${yyyy}${timeStr}`;
    }
  }
  return iso;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}



document.addEventListener('DOMContentLoaded', async () => {
  await loadFichas();
  loadAprendices();

  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.page = 1;
      loadAprendices();
    }, 350);
  });

  document.getElementById('filter-ficha').addEventListener('change', e => {
    state.ficha = e.target.value;
    state.page  = 1;
    loadAprendices();
  });

  document.getElementById('filter-juicio').addEventListener('change', e => {
    state.juicio = e.target.value;
    state.page   = 1;
    loadAprendices();
  });

  document.getElementById('filter-estado').addEventListener('change', e => {
    state.estado = e.target.value;
    state.page   = 1;
    loadAprendices();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    state = { q:'', ficha:'', estado:'', juicio:'', page:1, total:0, pages:1 };
    document.getElementById('search-input').value   = '';
    document.getElementById('filter-ficha').value   = '';
    document.getElementById('filter-estado').value  = '';
    document.getElementById('filter-juicio').value  = '';
    loadAprendices();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Event listeners para filtros del modal
  document.getElementById('modal-search').addEventListener('input', renderModalComps);
  document.getElementById('modal-filter-juicio').addEventListener('change', renderModalComps);
});
