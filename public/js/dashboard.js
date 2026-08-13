const CHART_DEFAULTS = {
  color: '#e8edf5',
  gridColor: 'rgba(255,255,255,.06)',
  colors: ['#39A900','#ef4444','#f59e0b','#3b82f6','#8b5cf6'],
};

let chartEstados, chartJuicios;

async function loadFichas() {
  const fichas = await API.get('/fichas');
  const sel = document.getElementById('dash-ficha-filter');
  fichas.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id_ficha;
    opt.textContent = `Ficha ${f.numero}`;
    sel.appendChild(opt);
  });
}

async function loadDashboard() {
  const fichaId = document.getElementById('dash-ficha-filter')?.value || '';
  const data = await API.get(`/dashboard${fichaId ? '?ficha='+fichaId : ''}`);

  // ── Stat cards ──────────────────────────────────────────────────
  const icons = [
    { icon:'<i class="ph ph-users"></i>', cls:'green',  label:'Total Aprendices', val: data.totalAprendices },
    { icon:'<i class="ph ph-books"></i>', cls:'teal',   label:'En Formación',     val: data.enFormacion },
    { icon:'<i class="ph ph-clipboard-text"></i>', cls:'blue',   label:'Fichas Registradas',val: data.totalFichas },
    { icon:'<i class="ph ph-check-circle"></i>',  cls:'green',  label:'Aprobados',        val: (data.juiciosStats.find(j=>j.estado_juicio==='Aprobado')||{}).total||0 },
    { icon:'<i class="ph ph-x-circle"></i>',  cls:'red',    label:'No Aprobados',     val: (data.juiciosStats.find(j=>j.estado_juicio==='No Aprobado')||{}).total||0 },
    { icon:'<i class="ph ph-hourglass"></i>', cls:'orange', label:'Por Evaluar',      val: (data.juiciosStats.find(j=>j.estado_juicio==='Por Evaluar')||{}).total||0 },
  ];

  document.getElementById('stat-cards').innerHTML = icons.map(i => `
    <div class="stat-card">
      <div class="stat-icon ${i.cls}">${i.icon}</div>
      <div class="stat-body">
        <div class="stat-value">${i.val.toLocaleString()}</div>
        <div class="stat-label">${i.label}</div>
      </div>
    </div>`).join('');

  // ── Chart: Estado aprendices (dona) ──────────────────────────────
  const estadoLabels = data.estadosAprendiz.map(e => e.estado || 'Sin estado');
  const estadoData   = data.estadosAprendiz.map(e => e.total);
  if (chartEstados) chartEstados.destroy();
  chartEstados = new Chart(document.getElementById('chartEstados'), {
    type: 'doughnut',
    data: {
      labels: estadoLabels,
      datasets: [{ data: estadoData, backgroundColor: CHART_DEFAULTS.colors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, padding: 16, font: { size: 12 } } },
      },
      cutout: '62%',
    }
  });

  // ── Chart: Juicios evaluativos (barras) ──────────────────────────
  const jLabels = ['Aprobado', 'No Aprobado', 'Por Evaluar'];
  const jData   = jLabels.map(l => (data.juiciosStats.find(j => j.estado_juicio === l) || {}).total || 0);
  const jColors = ['#39A900','#ef4444','#f59e0b'];
  if (chartJuicios) chartJuicios.destroy();
  chartJuicios = new Chart(document.getElementById('chartJuicios'), {
    type: 'bar',
    data: {
      labels: jLabels,
      datasets: [{
        label: 'Juicios',
        data: jData,
        backgroundColor: jColors,
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.color }, grid: { color: CHART_DEFAULTS.gridColor } },
        y: { ticks: { color: CHART_DEFAULTS.color }, grid: { color: CHART_DEFAULTS.gridColor }, beginAtZero: true },
      }
    }
  });

  // ── Table por ficha ──────────────────────────────────────────────
  const tbody = document.getElementById('ficha-table-body');
  if (!data.aprobadosPorFicha.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><i class="ph ph-folder-open"></i></div><p>Sin datos. Importa un Excel para comenzar.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = data.aprobadosPorFicha.map(f => {
      const total = (f.aprobados||0) + (f.no_aprobados||0) + (f.por_evaluar||0);
      const pct   = total ? Math.round(((f.aprobados||0)+(f.no_aprobados||0)) / total * 100) : 0;
      return `<tr onclick="location.href='aprendices.html?ficha=${f.id_ficha}'">
        <td><strong>${f.numero}</strong></td>
        <td>${f.aprendices}</td>
        <td><span class="badge badge-green">${f.aprobados||0}</span></td>
        <td><span class="badge badge-red">${f.no_aprobados||0}</span></td>
        <td><span class="badge badge-orange">${f.por_evaluar||0}</span></td>
        <td>
          <div class="progress-row">
            <div class="progress-bar-wrap">
              <div class="progress-bar green" style="width:${pct}%"></div>
            </div>
            <span style="font-size:12px;color:var(--muted);width:36px">${pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Alertas y Proyección ─────────────────────────────────────────
  const insightsDiv = document.getElementById('ficha-insights');
  if (fichaId && data.aprobadosPorFicha.length > 0) {
    insightsDiv.style.display = 'grid';
    const f = data.aprobadosPorFicha[0];

    // Proyección
    let velHtml = '<div style="color:var(--muted); font-size:14px; margin-bottom:8px;">Fechas no registradas. Reimporta el Excel.</div>';
    if (f.fecha_inicio && f.fecha_fin) {
      const dInicio = new Date(f.fecha_inicio);
      const dFin = new Date(f.fecha_fin);
      const dHoy = new Date();
      const totalDays = (dFin - dInicio) / (1000 * 60 * 60 * 24);
      let passedDays = (dHoy - dInicio) / (1000 * 60 * 60 * 24);
      if (passedDays < 0) passedDays = 0;
      if (passedDays > totalDays) passedDays = totalDays;
      const pctTime = Math.round((passedDays / totalDays) * 100);

      const totalJuicios = (f.aprobados||0) + (f.no_aprobados||0) + (f.por_evaluar||0);
      const pctGrades = totalJuicios ? Math.round(((f.aprobados||0)+(f.no_aprobados||0)) / totalJuicios * 100) : 0;

      let msg = 'A buen ritmo';
      let msgColor = 'var(--primary)';
      if (pctTime > pctGrades + 10) { msg = 'Atrasados'; msgColor = '#ef4444'; }
      else if (pctGrades > pctTime + 10) { msg = 'Adelantados'; msgColor = '#10b981'; }

      const formatDate = (iso) => {
        if (!iso) return '—';
        if (typeof iso === 'string' && iso.includes('-')) {
          const [y, m, d] = iso.split('-');
          return `${d}/${m}/${y}`;
        }
        // Fallback para números seriales de Excel que hayan llegado al front
        const num = Number(iso);
        if (!isNaN(num) && num > 30000) {
          const d = new Date(Math.round((num - 25569) * 86400 * 1000));
          if (!isNaN(d.getTime())) {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            return `${dd}/${mm}/${yyyy}`;
          }
        }
        return iso;
      };

      velHtml = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
          <span style="font-size:14px; color:var(--muted)">Tiempo transcurrido (${pctTime}%)</span>
          <span style="font-size:14px; color:var(--muted)">Evaluado (${pctGrades}%)</span>
        </div>
        <div class="progress-bar-wrap" style="height:8px; margin-bottom:4px; position:relative;">
          <div class="progress-bar" style="width:${pctTime}%; background-color:#3b82f6; opacity:0.3; position:absolute; height:100%;"></div>
          <div class="progress-bar green" style="width:${pctGrades}%; position:absolute; height:100%;"></div>
        </div>
        <div style="margin-top: 16px; font-size:16px; font-weight:600; color:${msgColor};">
          Estatus: ${msg}
        </div>
        <div style="font-size:12px; color:var(--muted); margin-top:4px;">
          ${formatDate(f.fecha_inicio)} a ${formatDate(f.fecha_fin)}
        </div>
      `;
    }
    document.getElementById('ficha-velocity').innerHTML = velHtml;

    // Alertas
    if (data.alertas && data.alertas.length > 0) {
      document.getElementById('ficha-alerts').innerHTML = data.alertas.map(a => `
        <div style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${a.competencia}</div>
          <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">${a.pct}% calificados. Faltan por evaluar:</div>
          <div style="font-size:12px; color:var(--text); line-height:1.5;">
            ${a.faltantes.map(x => `• ${x}`).join('<br>')}
          </div>
        </div>
      `).join('');
    } else {
      document.getElementById('ficha-alerts').innerHTML = `
        <div class="empty-state" style="padding: 20px 0;">
          <div class="empty-icon" style="font-size:24px;"><i class="ph ph-confetti"></i></div>
          <p style="font-size:14px;">No hay alertas. Calificaciones al día.</p>
        </div>
      `;
    }

  } else {
    insightsDiv.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadFichas();
  loadDashboard();

  document.getElementById('dash-ficha-filter')?.addEventListener('change', loadDashboard);

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (confirm('⚠ ¿Estás seguro de que deseas ELIMINAR TODOS LOS DATOS del sistema?\n\nEsta acción borrará todas las fichas, aprendices, juicios y funcionarios, y no se puede deshacer.')) {
        btnReset.disabled = true;
        btnReset.textContent = 'Borrando...';
        const res = await API.del('/dashboard/reset');
        if (res.ok) {
          alert('✅ Base de datos limpiada con éxito.');
          location.reload();
        } else {
          alert('❌ Error al borrar datos.');
          btnReset.disabled = false;
          btnReset.innerHTML = '<i class="ph ph-trash"></i> Borrar Todo';
        }
      }
    });
  }
});
