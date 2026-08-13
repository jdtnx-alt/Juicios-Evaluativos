let selectedFile = null;

function setStep(n) {
  [1,2,3].forEach(i => {
    const el = document.getElementById(`step${i}`);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  });
}

function showPane(name) {
  ['upload','preview','result'].forEach(p => {
    document.getElementById(`pane-${p}`).style.display = p === name ? '' : 'none';
  });
}

// ── Drag & Drop ──────────────────────────────────────────────────
const zone  = document.getElementById('upload-zone');
const input = document.getElementById('file-input');

zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

// ── Handle file → preview ────────────────────────────────────────
async function handleFile(file) {
  selectedFile = file;
  setStep(2);
  showPane('preview');

  const form = new FormData();
  form.append('file', file);

  const metaDiv = document.getElementById('meta-section');
  metaDiv.innerHTML = '<div class="spinner"></div>';

  const data = await API.upload('/import/preview', form);

  if (data.error) {
    metaDiv.innerHTML = `<div class="alert alert-error">⚠ ${data.error}</div>`;
    return;
  }

  // Meta cards
  const metaFields = [
    { key:'ficha',       label:'Ficha',      icon:'<i class="ph ph-clipboard-text"></i>' },
    { key:'programa',    label:'Programa',   icon:'<i class="ph ph-books"></i>' },
    { key:'equipo',      label:'Equipo',     icon:'<i class="ph ph-wrench"></i>' },
    { key:'regional',    label:'Regional',   icon:'<i class="ph ph-map-pin"></i>' },
    { key:'modalidad',   label:'Modalidad',  icon:'<i class="ph ph-buildings"></i>' },
    { key:'centro',      label:'Centro',     icon:'<i class="ph ph-bank"></i>' },
    { key:'fechaInicio', label:'Inicio',     icon:'<i class="ph ph-calendar"></i>' },
    { key:'fechaFin',    label:'Fin',        icon:'<i class="ph ph-calendar"></i>' },
  ].filter(f => data.meta[f.key]);

  metaDiv.innerHTML = `
    <div class="panel" style="margin-bottom:0">
      <div class="panel-header"><span class="panel-title"><i class="ph ph-file-text"></i> Datos detectados del reporte</span></div>
      <div class="panel-body">
        <div class="meta-grid">${metaFields.map(f => `
          <div class="meta-item">
            <div class="meta-key">${f.icon} ${f.label}</div>
            <div class="meta-value">${data.meta[f.key]}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;

  // Preview table
  document.getElementById('preview-count').textContent = `${data.totalRows} filas totales`;
  const thead = document.getElementById('preview-thead');
  const tbody = document.getElementById('preview-tbody');

  thead.innerHTML = `<tr>${(data.headers || []).map(h => `<th>${h}</th>`).join('')}</tr>`;
  tbody.innerHTML = (data.preview || []).map(row =>
    `<tr>${row.map(c => `<td title="${c}">${String(c).substring(0,40)}</td>`).join('')}</tr>`
  ).join('');
}

document.getElementById('btn-import').addEventListener('click', async () => {
  if (!selectedFile) return;
  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Importando…';

  const form = new FormData();
  form.append('file', selectedFile);

  const res = await API.upload('/import', form);

  setStep(3);
  showPane('result');

  const rc = document.getElementById('result-content');
  if (res.error) {
    rc.innerHTML = `<div class="result-box error">
      <div style="font-size:48px; color: #ef4444;"><i class="ph ph-x-circle"></i></div>
      <div style="font-size:18px;font-weight:700;margin:12px 0">Error al importar</div>
      <div style="color:var(--muted)">${res.error}</div>
    </div>`;
    return;
  }

  rc.innerHTML = `
    <div class="result-box success" style="margin-bottom:16px">
      <div style="font-size:48px; color: #10b981;"><i class="ph ph-check-circle"></i></div>
      <div style="font-size:18px;font-weight:700;margin:12px 0">Importación exitosa</div>
      ${res.ficha    ? `<div style="color:var(--muted);margin-bottom:4px"><i class="ph ph-clipboard-text"></i> Ficha: <strong style="color:var(--text)">${res.ficha}</strong></div>` : ''}
      ${res.programa ? `<div style="color:var(--muted)"><i class="ph ph-books"></i> Programa: <strong style="color:var(--text)">${res.programa}</strong></div>` : ''}
    </div>
    <div class="cards-grid" style="margin-bottom:0">
      <div class="stat-card">
        <div class="stat-icon green"><i class="ph ph-check-circle"></i></div>
        <div class="stat-body"><div class="stat-value">${res.inserted}</div><div class="stat-label">Registros importados</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><i class="ph ph-warning"></i></div>
        <div class="stat-body"><div class="stat-value">${res.skipped}</div><div class="stat-label">Omitidos / errores</div></div>
      </div>
    </div>
    ${res.errors?.length ? `<div class="alert alert-error" style="margin-top:16px">
      <div><strong>Detalles de errores:</strong><br>${res.errors.map(e=>`• ${e}`).join('<br>')}</div>
    </div>` : ''}`;
});

document.getElementById('btn-back').addEventListener('click', () => {
  setStep(1); showPane('upload');
  selectedFile = null;
  input.value = '';
});

document.getElementById('btn-another').addEventListener('click', () => {
  setStep(1); showPane('upload');
  selectedFile = null;
  input.value = '';
});
