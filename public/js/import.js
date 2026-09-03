let selectedFile = null;

function setStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById(`step${i}`);
    if (el) el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  });
}

function showPane(name) {
  ['upload', 'preview', 'result'].forEach(p => {
    const el = document.getElementById(`pane-${p}`);
    if (el) el.style.display = p === name ? '' : 'none';
  });
}

// ── Drag & Drop ──────────────────────────────────────────────────
const zone  = document.getElementById('upload-zone');
const input = document.getElementById('file-input');

if (zone) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
}
if (input) {
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
}

// ── Handle file → preview ────────────────────────────────────────
async function handleFile(file) {
  selectedFile = file;
  setStep(2);
  showPane('preview');

  const form = new FormData();
  form.append('file', file);

  const metaDiv = document.getElementById('meta-section');
  const btnImport = document.getElementById('btn-import');
  metaDiv.innerHTML = '<div class="spinner"></div>';

  try {
    const data = await API.upload('/import/preview', form);

    if (data.error) {
      btnImport.style.display = 'none';
      metaDiv.innerHTML = `
        <div class="panel" style="margin-bottom:20px; border-color: rgba(239,68,68,0.4);">
          <div class="panel-body" style="padding:24px;">
            <div style="display:flex; gap:16px; align-items:flex-start;">
              <div style="font-size:32px; color:var(--danger); flex-shrink:0;"><i class="ph ph-warning-circle"></i></div>
              <div>
                <h4 style="font-size:16px; font-weight:700; color:var(--text); margin-bottom:6px;">No se pudo procesar el archivo</h4>
                <p style="color:var(--muted); font-size:14px; margin-bottom:12px;">${data.error}</p>
                ${data.missing && data.missing.length ? `
                  <div style="background:rgba(239,68,68,0.08); border-radius:8px; padding:12px 16px; font-size:13px;">
                    <strong style="color:var(--text);">Campos no detectados:</strong>
                    <ul style="margin:6px 0 0 18px; color:var(--muted);">
                      ${data.missing.map(m => `<li>${m}</li>`).join('')}
                    </ul>
                  </div>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      return;
    }

    btnImport.style.display = '';

    // Status Banner: Ficha Existente vs Nueva Ficha
    let statusBannerHtml = '';
    let statusBadgeHtml = '';

    if (data.fichaExists && data.existingFicha) {
      statusBadgeHtml = '<span class="badge badge-orange"><i class="ph ph-arrows-clockwise"></i> Ficha Existente (Actualización)</span>';
      statusBannerHtml = `
        <div class="alert alert-warning" style="margin-bottom:20px; border-left:4px solid var(--warning); background:rgba(245,158,11,0.08); display:flex; gap:14px; align-items:flex-start; padding:16px 20px; border-radius:10px;">
          <i class="ph ph-arrows-clockwise" style="font-size:26px; color:var(--warning); flex-shrink:0; margin-top:2px;"></i>
          <div style="flex:1">
            <div style="font-weight:700; font-size:15px; color:var(--text); margin-bottom:4px;">
              Ficha ${data.meta.ficha} ya registrada — Modo de Actualización
            </div>
            <div style="color:var(--muted); font-size:13px; line-height:1.5;">
              Esta ficha ya existe en el sistema (cuenta con <strong>${data.existingFicha.total_aprendices}</strong> aprendices y <strong>${data.existingFicha.total_juicios}</strong> juicios evaluativos).
              Al continuar, <strong>se actualizarán los datos de la ficha, aprendices y juicios evaluativos</strong> sin crear duplicados y <strong>conservando la información previa</strong>.
            </div>
          </div>
        </div>`;
      btnImport.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Actualizar Ficha y Datos';
    } else {
      statusBadgeHtml = '<span class="badge badge-green"><i class="ph ph-plus-circle"></i> Nueva Ficha</span>';
      statusBannerHtml = `
        <div class="alert alert-info" style="margin-bottom:20px; border-left:4px solid var(--accent); background:rgba(57,169,0,0.08); display:flex; gap:14px; align-items:flex-start; padding:16px 20px; border-radius:10px;">
          <i class="ph ph-plus-circle" style="font-size:26px; color:var(--accent); flex-shrink:0; margin-top:2px;"></i>
          <div style="flex:1">
            <div style="font-weight:700; font-size:15px; color:var(--text); margin-bottom:4px;">
              Nueva Ficha ${data.meta.ficha}
            </div>
            <div style="color:var(--muted); font-size:13px; line-height:1.5;">
              Esta ficha no está registrada en el sistema. Se creará la ficha <strong>${data.meta.ficha}</strong> con sus respectivos aprendices y juicios de evaluación.
            </div>
          </div>
        </div>`;
      btnImport.innerHTML = '<i class="ph ph-download-simple"></i> Registrar Nueva Ficha';
    }

    // Meta cards
    const metaFields = [
      { key:'ficha',         label:'Ficha',         icon:'<i class="ph ph-clipboard-text"></i>' },
      { key:'programa',      label:'Programa',      icon:'<i class="ph ph-books"></i>' },
      { key:'codigo',        label:'Código Prog.',  icon:'<i class="ph ph-barcode"></i>' },
      { key:'fechaInicio',   label:'Inicio',        icon:'<i class="ph ph-calendar"></i>' },
      { key:'fechaFin',      label:'Fin',           icon:'<i class="ph ph-calendar"></i>' },
      { key:'jornada',       label:'Jornada',       icon:'<i class="ph ph-sun"></i>' },
      { key:'modalidad',     label:'Modalidad',     icon:'<i class="ph ph-buildings"></i>' },
      { key:'regional',      label:'Regional',      icon:'<i class="ph ph-map-pin"></i>' },
      { key:'centro',        label:'Centro',        icon:'<i class="ph ph-bank"></i>' },
      { key:'fechaReporte',  label:'Reporte del',   icon:'<i class="ph ph-clock"></i>' },
    ].filter(f => data.meta && data.meta[f.key]);

    metaDiv.innerHTML = `
      ${statusBannerHtml}
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-header">
          <span class="panel-title"><i class="ph ph-file-text"></i> Metadatos detectados del reporte</span>
          ${statusBadgeHtml}
        </div>
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
    document.getElementById('preview-count').textContent = `${data.totalRows} filas de evaluación`;
    const thead = document.getElementById('preview-thead');
    const tbody = document.getElementById('preview-tbody');

    thead.innerHTML = `<tr>${(data.headers || []).filter(h => h).map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = (data.preview || []).map(row =>
      `<tr>${row.map(c => `<td title="${c}">${String(c).substring(0, 45)}</td>`).join('')}</tr>`
    ).join('');

  } catch (err) {
    btnImport.style.display = 'none';
    metaDiv.innerHTML = `<div class="alert alert-error">⚠ Error al conectar con el servidor: ${err.message}</div>`;
  }
}

// ── Confirm Import ───────────────────────────────────────────────
document.getElementById('btn-import').addEventListener('click', async () => {
  if (!selectedFile) return;
  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando datos…';

  const form = new FormData();
  form.append('file', selectedFile);

  try {
    const res = await API.upload('/import', form);

    setStep(3);
    showPane('result');

    const rc = document.getElementById('result-content');
    if (res.error) {
      rc.innerHTML = `
        <div class="result-box error">
          <div style="font-size:52px; color: #ef4444;"><i class="ph ph-x-circle"></i></div>
          <div style="font-size:20px; font-weight:700; margin:12px 0;">Error al importar</div>
          <div style="color:var(--muted); font-size:14px; max-width:600px; margin:0 auto;">${res.error}</div>
        </div>`;
      return;
    }

    const isUpdate = res.isUpdate;
    const titleText = isUpdate ? 'Ficha actualizada con éxito' : 'Importación exitosa';
    const subText = isUpdate
      ? 'Los datos de la ficha, aprendices y juicios fueron actualizados sin crear duplicados y conservando los registros previos.'
      : 'La nueva ficha y todos sus registros han sido creados correctamente en el sistema.';
    const iconColor = isUpdate ? '#f59e0b' : '#10b981';
    const iconClass = isUpdate ? 'ph-arrows-clockwise' : 'ph-check-circle';

    rc.innerHTML = `
      <div class="result-box success" style="margin-bottom:24px;">
        <div style="font-size:52px; color:${iconColor}; margin-bottom:8px;"><i class="ph ${iconClass}"></i></div>
        <div style="font-size:22px; font-weight:800; margin:8px 0;">${titleText}</div>
        <div style="color:var(--muted); font-size:14px; max-width:650px; margin:0 auto 16px;">${subText}</div>
        <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap; font-size:14px;">
          ${res.ficha    ? `<div><i class="ph ph-clipboard-text"></i> Ficha: <strong style="color:var(--text)">${res.ficha}</strong></div>` : ''}
          ${res.programa ? `<div><i class="ph ph-books"></i> Programa: <strong style="color:var(--text)">${res.programa}</strong></div>` : ''}
        </div>
      </div>

      <div class="cards-grid" style="margin-bottom:0;">
        <div class="stat-card">
          <div class="stat-icon green"><i class="ph ph-user-check"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.aprendicesNuevos}</div>
            <div class="stat-label">Aprendices nuevos</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ph ph-user-gear"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.aprendicesActualizados}</div>
            <div class="stat-label">Aprendices actualizados</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal"><i class="ph ph-check-square"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.juiciosNuevos}</div>
            <div class="stat-label">Juicios nuevos</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="ph ph-arrows-clockwise"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.juiciosActualizados}</div>
            <div class="stat-label">Juicios actualizados</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="ph ph-equals"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.juiciosSinCambio}</div>
            <div class="stat-label">Juicios sin cambios</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ph ph-files"></i></div>
          <div class="stat-body">
            <div class="stat-value">${res.totalProcesados}</div>
            <div class="stat-label">Total filas evaluadas</div>
          </div>
        </div>
      </div>

      ${res.errors && res.errors.length ? `
        <div class="alert alert-error" style="margin-top:20px;">
          <div><strong>Avisos o filas omitidas (${res.skipped}):</strong><br>${res.errors.map(e => `• ${e}`).join('<br>')}</div>
        </div>` : ''}
    `;

  } catch (err) {
    setStep(3);
    showPane('result');
    document.getElementById('result-content').innerHTML = `
      <div class="result-box error">
        <div style="font-size:52px; color: #ef4444;"><i class="ph ph-x-circle"></i></div>
        <div style="font-size:20px; font-weight:700; margin:12px 0;">Error de conexión</div>
        <div style="color:var(--muted);">${err.message}</div>
      </div>`;
  }
});

document.getElementById('btn-back').addEventListener('click', () => {
  setStep(1);
  showPane('upload');
  selectedFile = null;
  if (input) input.value = '';
});

document.getElementById('btn-another').addEventListener('click', () => {
  setStep(1);
  showPane('upload');
  selectedFile = null;
  if (input) input.value = '';
});
