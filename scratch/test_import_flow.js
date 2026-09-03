const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../database');

// We simulate what routes/import.js does
const filePath = path.join(__dirname, '../uploads/4225daa681eb7a6d1f66f472625c37ae');
if (!fs.existsSync(filePath)) {
  console.error('Sample file not found in uploads/');
  process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const wb = XLSX.read(fileBuffer, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('=== TEST 1: Inspecting rows and structure ===');
console.log('Loaded rows:', rows.length);

// Require router logic or test via direct function
function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}
function cleanStr(v) { return String(v ?? '').trim(); }

function extractMeta(rows) {
  const meta = {};
  const getValue = (c, r, idx) => {
    if (c.includes(':')) {
      const afterColon = c.split(':').slice(1).join(':').trim();
      if (afterColon) return afterColon;
    }
    for (let k = idx + 1; k < Math.min(r.length, idx + 5); k++) {
      const val = cleanStr(r[k]);
      if (val) return val;
    }
    return '';
  };

  const maxRows = Math.min(rows.length, 35);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i] || [];
    for (let j = 0; j < row.length; j++) {
      const rawCell = cleanStr(row[j]);
      const cell = stripAccents(rawCell);
      if (!cell) continue;

      if (cell.includes('ficha') && !cell.includes('estado')) {
        const val = getValue(rawCell, row, j);
        if (val) {
          const matched = String(val).match(/\d{5,10}/);
          meta.ficha = matched ? matched[0] : val;
        }
      }
      else if (cell.includes('denominaci') || (cell.includes('programa') && !cell.includes('modalidad'))) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.programa) meta.programa = val;
      }
      else if (cell.includes('codigo') || cell.includes('cogigo')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.codigo) meta.codigo = val;
      }
      else if (cell.includes('fecha inicio') || cell.includes('fecha de inicio')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.fechaInicio) meta.fechaInicio = val;
      }
      else if (cell.includes('fecha fin') || cell.includes('fecha de fin') || cell.includes('terminacion')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.fechaFin) meta.fechaFin = val;
      }
      else if (cell.includes('jornada')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.jornada) meta.jornada = val;
      }
      else if (cell.includes('regional')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.regional) meta.regional = val;
      }
      else if (cell.includes('centro')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.centro) meta.centro = val;
      }
      else if (cell.includes('modalidad')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.modalidad) meta.modalidad = val;
      }
      else if (cell.includes('reporte') && cell.includes('fecha')) {
        const val = getValue(rawCell, row, j);
        if (val && !meta.fechaReporte) meta.fechaReporte = val;
      }
    }
  }
  return meta;
}

const meta = extractMeta(rows);
console.log('Extracted Meta:', meta);

console.log('=== TEST 2: Ficha existence check in DB ===');
const existingFicha = db.prepare(`
  SELECT f.id_ficha, f.numero, f.fecha_inicio, f.fecha_fin, f.jornada,
         p.nombre as programa_nombre,
         (SELECT COUNT(*) FROM Aprendiz WHERE id_ficha = f.id_ficha) as total_aprendices,
         (SELECT COUNT(*) FROM JuicioEvaluacion j JOIN Aprendiz a ON j.id_aprendiz = a.id_aprendiz WHERE a.id_ficha = f.id_ficha) as total_juicios
  FROM Ficha f
  LEFT JOIN Programa p ON f.id_programa = p.id_programa
  WHERE f.numero = ?
`).get(String(meta.ficha));

console.log('Ficha exists in DB?', !!existingFicha);
if (existingFicha) {
  console.log('Existing Ficha info:', existingFicha);
}

console.log('=== TEST 3: Checking Ficha count before import ===');
const countFichasBefore = db.prepare('SELECT COUNT(*) as c FROM Ficha').get().c;
console.log('Fichas count in DB before:', countFichasBefore);

// Simulate re-importing using the express app or directly
const countJuiciosBefore = db.prepare('SELECT COUNT(*) as c FROM JuicioEvaluacion').get().c;
const countAprendicesBefore = db.prepare('SELECT COUNT(*) as c FROM Aprendiz').get().c;
console.log('Aprendices before:', countAprendicesBefore, 'Juicios before:', countJuiciosBefore);

console.log('All tests ready for full verification.');
