const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function cleanStr(v) {
  return String(v ?? '').trim();
}

function parseDate(serial) {
  if (serial === null || serial === undefined) return null;
  const s = cleanStr(serial);
  if (!s || s === '-' || s === '--' || s === '  -   ' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null') {
    return null;
  }

  // Already standard format: YYYY-MM-DD or YYYY-MM-DD HH:MM
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;

  // Format DD/MM/YYYY or DD/MM/YYYY HH:MM:SS or DD/MM/YYYY HH:MM a/p
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let rest = parts[2].trim();
      let year = rest;
      let timePart = '';
      if (rest.includes(' ')) {
        const sub = rest.split(/\s+/);
        year = sub[0];
        timePart = sub.slice(1).join(' ').replace(/[^\d:]/g, ''); // Extract HH:MM
      }
      if (year.length === 2) year = '20' + year;
      if (timePart) {
        return `${year}-${month}-${day} ${timePart}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  // Excel serial number
  const num = Number(s);
  if (!isNaN(num) && num > 30000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');

      const fraction = num - Math.floor(num);
      if (fraction > 0) {
        const totalSeconds = Math.round(fraction * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const mins  = Math.floor((totalSeconds % 3600) / 60);
        return `${yyyy}-${mm}-${dd} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return s;
}

function mapJuicio(v) {
  const s = stripAccents(v);
  if (s.includes('aprobado') && !s.includes('no')) return 'Aprobado';
  if (s.includes('no aprobado') || s.includes('no_aprobado')) return 'No Aprobado';
  return 'Por Evaluar';
}

function mapEstado(v) {
  const s = stripAccents(v);
  if (s.includes('retiro')) return 'Retiro Voluntario';
  if (s.includes('cedid') || s.includes('traslad')) return 'Traslado';
  return 'En Formación';
}

function mapTipoDoc(v) {
  const s = stripAccents(v);
  if (s === 'ti') return 'TI';
  return 'CC';
}

function mapJornada(v) {
  const s = stripAccents(v);
  if (s.includes('noche') || s.includes('nocturna')) return 'Noche';
  if (s.includes('mix')) return 'Mixta';
  return 'Mañana';
}

// Extract metadata flexibly by scanning cells across top rows
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

// Find header row and map columns dynamically
function findColumns(rows) {
  let headerRowIndex = -1;
  let scanRows = 1;

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const joined = row.map(stripAccents).join(' ');

    const hasDoc = joined.includes('documento') || joined.includes('numero') || joined.includes('identificacion') || joined.includes('tipo de');
    const hasNom = joined.includes('nombre') || joined.includes('aprendiz');
    const hasComp = joined.includes('competencia') || joined.includes('resultado') || joined.includes('juicio') || joined.includes('evaluac');

    if ((hasDoc && hasNom) || (hasNom && hasComp) || (hasDoc && hasComp)) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return null;

  // Check if headerRowIndex + 1 is a header continuation or actual data
  const nextRow = rows[headerRowIndex + 1] || [];
  const nextRow0 = stripAccents(nextRow[0]);
  const nextRow1 = stripAccents(nextRow[1]);
  const isDataRow = ['cc', 'ti', 'ce', 'pas'].includes(nextRow0) || /^\d{6,12}$/.test(nextRow1) || /^\d{6,12}$/.test(nextRow0);

  if (!isDataRow && nextRow.length > 0) {
    const nextJoined = nextRow.map(stripAccents).join(' ');
    if (nextJoined.includes('documento') || nextJoined.includes('evaluac') || nextJoined.includes('aprendizaje') || nextJoined.includes('apellido')) {
      scanRows = 2;
    }
  }

  const combinedHeaders = [];
  const col = {};
  const rowLen = Math.max(rows[headerRowIndex]?.length || 0, scanRows === 2 ? rows[headerRowIndex + 1]?.length || 0 : 0);

  for (let j = 0; j < rowLen; j++) {
    const h1 = String(rows[headerRowIndex]?.[j] || '').trim();
    const h2 = scanRows === 2 ? String(rows[headerRowIndex + 1]?.[j] || '').trim() : '';
    const full = (h1 + ' ' + h2).trim();
    combinedHeaders.push(full);

    const norm = stripAccents(full);
    if (!norm) continue;

    if (norm.includes('tipo') && col.tipo_doc === undefined) col.tipo_doc = j;
    else if ((norm.includes('documento') || norm.includes('numero') || norm.includes('identificacion') || norm.includes('cedula')) && col.documento === undefined) col.documento = j;
    else if (norm.includes('nombre') && !norm.includes('funcionario') && !norm.includes('instructor') && col.nombre === undefined) col.nombre = j;
    else if (norm.includes('apellido') && col.apellido === undefined) col.apellido = j;
    else if (norm.includes('estado') && !norm.includes('ficha') && !norm.includes('juicio') && col.estado === undefined) col.estado = j;
    else if (norm.includes('competencia') && col.competencia === undefined) col.competencia = j;
    else if ((norm.includes('resultado') || norm.includes('rap')) && col.resultado === undefined) col.resultado = j;
    else if ((norm.includes('juicio') || norm.includes('evaluaci')) && !norm.includes('fecha') && !norm.includes('funcionario') && col.juicio === undefined) col.juicio = j;
    else if (norm.includes('fecha') && col.fecha === undefined) col.fecha = j;
    else if ((norm.includes('funcionario') || norm.includes('instructor') || norm.includes('evaluador') || norm.includes('docente')) && col.funcionario === undefined) col.funcionario = j;
  }

  const dataStartIndex = headerRowIndex + scanRows;
  const dataRows = rows.slice(dataStartIndex).filter(r => r.some(c => cleanStr(c) !== ''));

  return {
    headerRowIndex,
    scanRows,
    headers: combinedHeaders,
    col,
    dataRows
  };
}

// Validate file structure against required SENA template fields
function validateStructure(meta, colResult) {
  const missing = [];
  if (!meta || !meta.ficha) {
    missing.push('Número de Ficha de Caracterización (en los datos superiores del archivo)');
  }
  if (!colResult) {
    missing.push('Fila de encabezados de la tabla (Tipo Doc, Documento, Nombre, Competencia, Juicio)');
    return {
      valid: false,
      missing,
      error: 'No se pudo identificar la tabla de datos del reporte. Verifica que el archivo corresponda al Reporte de Juicios de Evaluación del SENA.'
    };
  }

  const col = colResult.col;
  if (col.documento === undefined) missing.push('Columna de Documento / Identificación del aprendiz');
  if (col.nombre === undefined) missing.push('Columna de Nombres del aprendiz');
  if (col.competencia === undefined) missing.push('Columna de Competencia');
  if (col.resultado === undefined) missing.push('Columna de Resultado de Aprendizaje');
  if (col.juicio === undefined) missing.push('Columna de Juicio de Evaluación');

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      error: `El archivo no cumple con la estructura requerida del Reporte de Juicios de Evaluación. Falta: ${missing.join('; ')}.`
    };
  }

  if (!colResult.dataRows || colResult.dataRows.length === 0) {
    return {
      valid: false,
      missing: ['Filas con datos de aprendices'],
      error: 'El archivo tiene la estructura correcta pero no contiene filas con datos de aprendices ni evaluaciones.'
    };
  }

  return { valid: true };
}

// ── GET /preview ──────────────────────────────────────────────────────────
router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo para vista previa' });

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const meta = extractMeta(rows);
    const colResult = findColumns(rows);
    const validation = validateStructure(meta, colResult);

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        missing: validation.missing,
        meta
      });
    }

    // Check if Ficha already exists in database
    let fichaExists = false;
    let existingFicha = null;

    if (meta.ficha) {
      existingFicha = db.prepare(`
        SELECT f.id_ficha, f.numero, f.fecha_inicio, f.fecha_fin, f.jornada,
               p.nombre as programa_nombre,
               (SELECT COUNT(*) FROM Aprendiz WHERE id_ficha = f.id_ficha) as total_aprendices,
               (SELECT COUNT(*) FROM JuicioEvaluacion j JOIN Aprendiz a ON j.id_aprendiz = a.id_aprendiz WHERE a.id_ficha = f.id_ficha) as total_juicios
        FROM Ficha f
        LEFT JOIN Programa p ON f.id_programa = p.id_programa
        WHERE f.numero = ?
      `).get(String(meta.ficha).trim());

      if (existingFicha) {
        fichaExists = true;
      }
    }

    const preview = colResult.dataRows.slice(0, 5);

    res.json({
      meta,
      headers: colResult.headers,
      preview,
      totalRows: colResult.dataRows.length,
      fichaExists,
      existingFicha
    });

  } catch (err) {
    console.error('Error in /import/preview:', err);
    res.status(500).json({ error: 'Error procesando archivo: ' + err.message });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
  }
});

// ── POST / (Import / Upsert) ─────────────────────────────────────────────
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo para importar' });

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const meta = extractMeta(rows);
    const colResult = findColumns(rows);
    const validation = validateStructure(meta, colResult);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, missing: validation.missing });
    }

    const { col, dataRows } = colResult;

    const importTransaction = db.transaction(() => {
      // 1. Programa
      let id_programa = null;
      if (meta.programa) {
        const pExist = db.prepare('SELECT id_programa FROM Programa WHERE nombre = ?').get(meta.programa);
        if (pExist) {
          id_programa = pExist.id_programa;
          if (meta.codigo) {
            db.prepare('UPDATE Programa SET codigo = ? WHERE id_programa = ?').run(meta.codigo, id_programa);
          }
        } else {
          id_programa = db.prepare('INSERT INTO Programa (codigo, nombre) VALUES (?,?)')
            .run(meta.codigo || null, meta.programa).lastInsertRowid;
        }
      }

      // 2. Ficha: Upsert sin duplicar ni borrar registros existentes
      let id_ficha = null;
      let isUpdate = false;
      const fInicio = parseDate(meta.fechaInicio);
      const fFin    = parseDate(meta.fechaFin);
      const jor     = meta.jornada ? mapJornada(meta.jornada) : null;

      const fExist = db.prepare('SELECT id_ficha, fecha_inicio, fecha_fin, jornada, id_programa FROM Ficha WHERE numero = ?')
        .get(String(meta.ficha).trim());

      if (fExist) {
        id_ficha = fExist.id_ficha;
        isUpdate = true;
        // Actualizar datos de la ficha manteniendo los que ya existían si no vienen en el nuevo reporte
        const newInicio = fInicio || fExist.fecha_inicio;
        const newFin    = fFin    || fExist.fecha_fin;
        const newJor    = jor     || fExist.jornada;
        const newProg   = id_programa || fExist.id_programa;

        db.prepare('UPDATE Ficha SET fecha_inicio = ?, fecha_fin = ?, jornada = ?, id_programa = ? WHERE id_ficha = ?')
          .run(newInicio, newFin, newJor, newProg, id_ficha);
      } else {
        id_ficha = db.prepare('INSERT INTO Ficha (numero, jornada, fecha_inicio, fecha_fin, id_programa) VALUES (?,?,?,?,?)')
          .run(meta.ficha, jor, fInicio, fFin, id_programa).lastInsertRowid;
      }

      // 3. Prepared statements para Aprendices y Juicios
      const getAprendizStmt = db.prepare('SELECT id_aprendiz, nombre, apellido, tipo_documento, estado, id_ficha FROM Aprendiz WHERE documento = ?');
      const updateAprendizStmt = db.prepare('UPDATE Aprendiz SET nombre = ?, apellido = ?, tipo_documento = ?, estado = ?, id_ficha = ? WHERE id_aprendiz = ?');
      const insertAprendizStmt = db.prepare('INSERT INTO Aprendiz (documento, tipo_documento, nombre, apellido, estado, id_ficha) VALUES (?,?,?,?,?,?)');

      const getJuicioStmt = db.prepare('SELECT id_juicio, estado_juicio, funcionario_nombre, fecha_hora, competencia_nombre FROM JuicioEvaluacion WHERE id_aprendiz = ? AND resultado_nombre = ?');
      const updateJuicioStmt = db.prepare('UPDATE JuicioEvaluacion SET estado_juicio = ?, funcionario_nombre = ?, fecha_hora = ?, competencia_nombre = ? WHERE id_juicio = ?');
      const insertJuicioStmt = db.prepare('INSERT INTO JuicioEvaluacion (estado_juicio, funcionario_nombre, fecha_hora, competencia_nombre, resultado_nombre, id_aprendiz) VALUES (?,?,?,?,?,?)');

      let aprendicesNuevos = 0;
      let aprendicesActualizados = 0;
      let juiciosNuevos = 0;
      let juiciosActualizados = 0;
      let juiciosSinCambio = 0;
      let skipped = 0;
      const errors = [];
      const seenAprendicesInBatch = new Set();

      for (const row of dataRows) {
        try {
          const documento  = cleanStr(row[col.documento]);
          const nombre     = cleanStr(row[col.nombre]);
          const apellido   = cleanStr(col.apellido !== undefined ? row[col.apellido] : '');
          const tipo_doc   = mapTipoDoc(col.tipo_doc !== undefined ? row[col.tipo_doc] : '');
          const estadoRaw  = cleanStr(col.estado !== undefined ? row[col.estado] : '');

          if (!documento || !nombre) {
            skipped++;
            continue;
          }

          // ── Aprendiz Upsert ──────────────────────────
          let id_aprendiz;
          const aExist = getAprendizStmt.get(documento);

          if (aExist) {
            id_aprendiz = aExist.id_aprendiz;
            if (!seenAprendicesInBatch.has(documento)) {
              updateAprendizStmt.run(nombre, apellido, tipo_doc, mapEstado(estadoRaw), id_ficha, id_aprendiz);
              aprendicesActualizados++;
              seenAprendicesInBatch.add(documento);
            }
          } else {
            const insRes = insertAprendizStmt.run(documento, tipo_doc, nombre, apellido, mapEstado(estadoRaw), id_ficha);
            id_aprendiz = insRes.lastInsertRowid;
            aprendicesNuevos++;
            seenAprendicesInBatch.add(documento);
          }

          // ── JuicioEvaluacion Upsert ───────────────────
          const compNombre = cleanStr(col.competencia !== undefined ? row[col.competencia] : '');
          const resNombre  = cleanStr(col.resultado !== undefined ? row[col.resultado] : '');
          const juicioRaw  = cleanStr(col.juicio !== undefined ? row[col.juicio] : '');
          const fechaRaw   = parseDate(col.fecha !== undefined ? row[col.fecha] : null);
          let funcRaw      = cleanStr(col.funcionario !== undefined ? row[col.funcionario] : '');

          if (funcRaw === '-' || funcRaw === '  -   ' || funcRaw.toLowerCase() === 'null') {
            funcRaw = null;
          }

          if (resNombre) {
            const estadoJuicio = mapJuicio(juicioRaw);
            const existingJuicio = getJuicioStmt.get(id_aprendiz, resNombre);

            if (existingJuicio) {
              const hasChanged = (
                existingJuicio.estado_juicio !== estadoJuicio ||
                existingJuicio.fecha_hora !== fechaRaw ||
                existingJuicio.funcionario_nombre !== (funcRaw || null) ||
                (compNombre && existingJuicio.competencia_nombre !== compNombre)
              );

              if (hasChanged) {
                updateJuicioStmt.run(
                  estadoJuicio,
                  funcRaw || existingJuicio.funcionario_nombre,
                  fechaRaw || existingJuicio.fecha_hora,
                  compNombre || existingJuicio.competencia_nombre,
                  existingJuicio.id_juicio
                );
                juiciosActualizados++;
              } else {
                juiciosSinCambio++;
              }
            } else {
              insertJuicioStmt.run(
                estadoJuicio,
                funcRaw || null,
                fechaRaw || null,
                compNombre || null,
                resNombre,
                id_aprendiz
              );
              juiciosNuevos++;
            }
          }

        } catch (rowErr) {
          errors.push(`Doc ${row[col.documento] || 'N/A'}: ${rowErr.message}`);
          skipped++;
        }
      }

      return {
        isUpdate,
        ficha: meta.ficha,
        programa: meta.programa,
        aprendicesNuevos,
        aprendicesActualizados,
        aprendicesTotales: seenAprendicesInBatch.size,
        juiciosNuevos,
        juiciosActualizados,
        juiciosSinCambio,
        totalProcesados: dataRows.length,
        skipped,
        errors: errors.slice(0, 10)
      };
    });

    const result = importTransaction();
    res.json({ ok: true, ...result });

  } catch (err) {
    console.error('Error in /import:', err);
    res.status(500).json({ error: 'Error durante la importación: ' + err.message });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
  }
});

module.exports = router;
