const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

function norm(v) { return String(v || '').trim().toLowerCase(); }
function cap(v)  { return String(v || '').trim(); }

function parseDate(serial) {
  if (!serial) return null;
  const s = String(serial).trim();
  
  // Si ya es YYYY-MM-DD HH:MM
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;

  // Si es DD/MM/YYYY
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2].trim();
      if (year.includes(' ')) year = year.split(' ')[0]; // Quitar hora si viene pegada
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
  }

  // Si es un número serial de Excel (puede tener decimales para la hora)
  const num = Number(s);
  if (!isNaN(num) && num > 30000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      
      // Extraer hora si hay decimales
      const fraction = num - Math.floor(num);
      if (fraction > 0) {
        const totalSeconds = Math.round(fraction * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const mins  = Math.floor((totalSeconds % 3600) / 60);
        return `${yyyy}-${mm}-${dd} ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
      }
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return s;
}

function mapJuicio(v) {
  const s = norm(v);
  if (s.includes('aprobado') && !s.includes('no')) return 'Aprobado';
  if (s.includes('no aprobado') || s.includes('no_aprobado'))  return 'No Aprobado';
  return 'Por Evaluar';
}

function mapEstado(v) {
  const s = norm(v);
  if (s.includes('retiro')) return 'Retiro Voluntario';
  if (s.includes('cedid') || s.includes('traslad')) return 'Traslado';
  return 'En Formación';
}

function mapTipoDoc(v) {
  const s = norm(v);
  if (s === 'ti') return 'TI';
  return 'CC';
}

function mapJornada(v) {
  const s = norm(v);
  if (s.includes('noche')) return 'Noche';
  if (s.includes('mix'))   return 'Mixta';
  return 'Mañana';
}

// Extract metadata reliably by scanning all cells in top rows
function extractMeta(rows) {
  const meta = {};
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    for (let j = 0; j < row.length; j++) {
      const rawCell = String(row[j] || '');
      const cell = rawCell.toLowerCase().trim();
      if (!cell) continue;
      
      const getValue = (c, r, idx) => {
        if (c.includes(':')) {
          const parts = c.split(':');
          if (parts[1].trim()) return parts[1].trim();
        }
        return cap(r[idx+1] || r[idx+2] || r[idx+3] || '');
      };

      if (cell.includes('ficha de caracterizaci') && !cell.includes('estado')) {
        const val = getValue(rawCell, row, j);
        if (val) meta.ficha = val.match(/\d+/)?.[0] || val;
      }
      else if (cell.includes('denominaci')) meta.programa = getValue(rawCell, row, j);
      else if (cell.includes('fecha inicio')) meta.fechaInicio = getValue(rawCell, row, j);
      else if (cell.includes('fecha fin'))    meta.fechaFin = getValue(rawCell, row, j);
      else if (cell.includes('jornada'))      meta.jornada = getValue(rawCell, row, j);
    }
  }
  return meta;
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const wb    = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws    = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const meta = extractMeta(rows);
    let headerRowIndex = -1;

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const rowStr = rows[i].map(norm).join(' ');
      if (rowStr.includes('nombre') && (rowStr.includes('tipo') || rowStr.includes('documento') || rowStr.includes('estado'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1)
      return res.status(400).json({ error: 'No se encontró la fila de encabezados (Tipo doc, Nombre, etc)' });

    let dataStartIndex = headerRowIndex + 1;
    let scanRows = 1;
    const r2Str = rows[headerRowIndex + 1] ? rows[headerRowIndex + 1].map(norm).join(' ') : '';
    if (r2Str.includes('evaluaci') || r2Str.includes('documento') || r2Str.includes('apellido')) {
      dataStartIndex = headerRowIndex + 2;
      scanRows = 2;
    }

    const col = {};
    for (let i = headerRowIndex; i < headerRowIndex + scanRows; i++) {
      if (!rows[i]) continue;
      rows[i].forEach((h, j) => {
        const k = norm(h);
        if (!k) return;
        if (k.includes('tipo') && col.tipo_doc === undefined) col.tipo_doc = j;
        else if ((k.includes('mero') || k.includes('numero') || k.includes('documento')) && col.documento === undefined) col.documento = j;
        else if (k === 'nombre' && col.nombre === undefined) col.nombre = j;
        else if (k.includes('apellido') && col.apellido === undefined) col.apellido = j;
        else if (k === 'estado' && col.estado === undefined) col.estado = j;
        else if (k === 'competencia' && col.competencia === undefined) col.competencia = j;
        else if (k.includes('resultado') && col.resultado === undefined) col.resultado = j;
        else if ((k.includes('juicio') || k.includes('evaluaci')) && !k.includes('fecha') && col.juicio === undefined) col.juicio = j;
        else if (k.includes('fecha') && col.fecha === undefined) col.fecha = j;
        else if (k.includes('funcionario') && col.funcionario === undefined) col.funcionario = j;
      });
    }

    const dataRows = rows.slice(dataStartIndex).filter(r => r.some(c => c !== ''));
    if (dataRows.length === 0)
      return res.status(400).json({ error: 'El archivo no contiene filas de datos' });

    const importAll = db.transaction(() => {
      let id_programa = null;
      if (meta.programa) {
        const pExist = db.prepare('SELECT id_programa FROM Programa WHERE nombre = ?').get(meta.programa);
        if (pExist) {
          id_programa = pExist.id_programa;
        } else {
          id_programa = db.prepare('INSERT INTO Programa (codigo, nombre) VALUES (?,?)')
            .run(meta.equipo || null, meta.programa).lastInsertRowid;
        }
      }

      let id_ficha = null;
      if (meta.ficha) {
        const fInicio = parseDate(meta.fechaInicio);
        const fFin    = parseDate(meta.fechaFin);
        const fExist = db.prepare('SELECT id_ficha FROM Ficha WHERE numero = ?').get(meta.ficha);
        if (fExist) {
          id_ficha = fExist.id_ficha;
          db.prepare('UPDATE Ficha SET fecha_inicio=?, fecha_fin=? WHERE id_ficha=?').run(fInicio, fFin, id_ficha);
          // Delete existing evaluations first to satisfy FK constraints without CASCADE on DB schema
          db.prepare('DELETE FROM JuicioEvaluacion WHERE id_aprendiz IN (SELECT id_aprendiz FROM Aprendiz WHERE id_ficha = ?)').run(id_ficha);
          // Delete existing apprentices of this ficha to prevent duplicate evaluations on re-import
          db.prepare('DELETE FROM Aprendiz WHERE id_ficha = ?').run(id_ficha);
        } else {
          id_ficha = db.prepare('INSERT INTO Ficha (numero, jornada, fecha_inicio, fecha_fin, id_programa) VALUES (?,?,?,?,?)')
            .run(meta.ficha, meta.jornada ? mapJornada(meta.jornada) : null, fInicio, fFin, id_programa).lastInsertRowid;
        }
      }

      let inserted = 0, skipped = 0, errors = [];

      for (const row of dataRows) {
        try {
          const tipo_doc     = mapTipoDoc(row[col.tipo_doc] ?? '');
          const documento    = cap(row[col.documento]  ?? '');
          const nombre       = cap(row[col.nombre]     ?? '');
          const apellido     = cap(row[col.apellido]   ?? '');
          const estadoRaw    = cap(row[col.estado]     ?? '');
          const compNombre   = cap(row[col.competencia] ?? '');
          const resNombre    = cap(row[col.resultado]  ?? '');
          const juicioRaw    = cap(row[col.juicio]     ?? '');
          const fechaRaw     = parseDate(row[col.fecha] ?? '');
          const funcRaw      = cap(row[col.funcionario] ?? '');

          if (!documento || !nombre) { skipped++; continue; }

          // Aprendiz: Unique by documento
          let id_aprendiz;
          const aExist = db.prepare('SELECT id_aprendiz FROM Aprendiz WHERE documento=?').get(documento);
          if (aExist) {
            id_aprendiz = aExist.id_aprendiz;
            db.prepare('UPDATE Aprendiz SET nombre=?, apellido=?, tipo_documento=?, estado=?, id_ficha=? WHERE id_aprendiz=?')
              .run(nombre, apellido, tipo_doc, mapEstado(estadoRaw), id_ficha, id_aprendiz);
          } else {
            id_aprendiz = db.prepare(
              'INSERT INTO Aprendiz (documento, tipo_documento, nombre, apellido, estado, id_ficha) VALUES (?,?,?,?,?,?)'
            ).run(documento, tipo_doc, nombre, apellido, mapEstado(estadoRaw), id_ficha).lastInsertRowid;
          }

          // JuicioEvaluacion flat
          const estadoJuicio = mapJuicio(juicioRaw);
          db.prepare(`
            INSERT INTO JuicioEvaluacion 
            (estado_juicio, funcionario_nombre, fecha_hora, competencia_nombre, resultado_nombre, id_aprendiz) 
            VALUES (?,?,?,?,?,?)
          `).run(estadoJuicio, funcRaw || null, fechaRaw || null, compNombre || null, resNombre || null, id_aprendiz);

          inserted++;
        } catch (rowErr) {
          errors.push(rowErr.message);
          skipped++;
        }
      }

      return { inserted, skipped, errors: errors.slice(0, 10) };
    });

    const result = importAll();
    try { fs.unlinkSync(req.file.path); } catch (e) { console.error('Error borrando archivo:', e.message); }
    res.json({ ok: true, ficha: meta.ficha, programa: meta.programa, ...result });

  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const wb   = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const meta = extractMeta(rows);
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const rowStr = rows[i].map(norm).join(' ');
      if (rowStr.includes('nombre') && (rowStr.includes('tipo') || rowStr.includes('documento') || rowStr.includes('estado'))) {
        headerIdx = i;
        break;
      }
    }

    let scanRows = 1;
    if (headerIdx >= 0 && rows[headerIdx + 1]) {
      const r2Str = rows[headerIdx + 1].map(norm).join(' ');
      if (r2Str.includes('evaluaci') || r2Str.includes('documento') || r2Str.includes('apellido')) scanRows = 2;
    }

    const headers = [];
    if (headerIdx >= 0) {
      for (let i = headerIdx; i < headerIdx + scanRows; i++) {
        rows[i].forEach((h, j) => {
          if (h && !headers[j]) headers[j] = h;
          else if (h && headers[j]) headers[j] += ' ' + h;
        });
      }
    }

    const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + scanRows).filter(r => r.some(c => c !== '')) : [];
    const preview  = dataRows.slice(0, 5);

    try { fs.unlinkSync(req.file.path); } catch (e) { console.error('Error borrando archivo preview:', e.message); }
    res.json({ meta, headers, preview, totalRows: dataRows.length });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
