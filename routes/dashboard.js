const router = require('express').Router();
const db     = require('../database');

router.get('/', (req, res) => {
  const { ficha } = req.query;
  const filter = ficha ? 'WHERE id_ficha = ?' : '';
  const filterJe = ficha ? 'WHERE a.id_ficha = ?' : '';
  const params = ficha ? [ficha] : [];

  const totalAprendices = db.prepare(`SELECT COUNT(*) as c FROM Aprendiz ${filter}`).get(...params).c;
  
  const enFormacion = db.prepare(`SELECT COUNT(*) as c FROM Aprendiz WHERE estado = 'En Formación' ${ficha ? 'AND id_ficha = ?' : ''}`).get(...params).c;

  const estadosAprendiz = db.prepare(`
    SELECT estado, COUNT(*) as total FROM Aprendiz ${filter} GROUP BY estado
  `).all(...params);

  const juiciosStats = db.prepare(`
    SELECT je.estado_juicio, COUNT(*) as total 
    FROM JuicioEvaluacion je
    JOIN Aprendiz a ON je.id_aprendiz = a.id_aprendiz
    ${filterJe}
    GROUP BY je.estado_juicio
  `).all(...params);

  const totalFichas = db.prepare('SELECT COUNT(*) as c FROM Ficha').get().c;

  const aprobadosPorFicha = db.prepare(`
    SELECT f.id_ficha, f.numero, f.fecha_inicio, f.fecha_fin, COUNT(DISTINCT a.id_aprendiz) as aprendices,
           SUM(CASE WHEN je.estado_juicio='Aprobado'    THEN 1 ELSE 0 END) as aprobados,
           SUM(CASE WHEN je.estado_juicio='No Aprobado' THEN 1 ELSE 0 END) as no_aprobados,
           SUM(CASE WHEN je.estado_juicio='Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
    FROM Ficha f
    LEFT JOIN Aprendiz a ON a.id_ficha = f.id_ficha AND a.estado = 'En Formación'
    LEFT JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    ${ficha ? 'WHERE f.id_ficha = ?' : ''}
    GROUP BY f.id_ficha, f.numero, f.fecha_inicio, f.fecha_fin
    ORDER BY f.numero
    LIMIT 10
  `).all(...params);

  const alertas = [];
  if (ficha) {
    // Detectar Resultados de Aprendizaje donde el docente ya calificó a parte del grupo
    // pero omitió a uno o varios aprendices (quedaron 'Por Evaluar')
    const rapsIncompletos = db.prepare(`
      SELECT je.competencia_nombre, je.resultado_nombre,
             COUNT(DISTINCT a.id_aprendiz) as total_aprendices,
             SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados,
             SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
      FROM Aprendiz a
      JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
      WHERE a.estado = 'En Formación' AND a.id_ficha = ? AND je.competencia_nombre IS NOT NULL
      GROUP BY je.competencia_nombre, je.resultado_nombre
      HAVING calificados > 0 AND por_evaluar > 0
    `).all(ficha);

    for (const rap of rapsIncompletos) {
      const faltantes = db.prepare(`
        SELECT DISTINCT a.nombre, a.apellido
        FROM Aprendiz a
        JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
        WHERE a.estado = 'En Formación' AND a.id_ficha = ?
          AND je.resultado_nombre = ?
          AND je.estado_juicio = 'Por Evaluar'
      `).all(ficha, rap.resultado_nombre);

      if (faltantes.length > 0) {
        alertas.push({
          competencia: rap.competencia_nombre,
          resultado: rap.resultado_nombre,
          calificados: rap.calificados,
          total: rap.total_aprendices,
          pct: Math.round((rap.calificados / rap.total_aprendices) * 100),
          faltantes: faltantes.map(f => `${f.nombre} ${f.apellido || ''}`.trim())
        });
      }
    }
  }

  res.json({ totalAprendices, enFormacion, estadosAprendiz, juiciosStats, totalFichas, aprobadosPorFicha, alertas });
});

router.delete('/reset', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM JuicioEvaluacion').run();
      db.prepare('DELETE FROM Aprendiz').run();
      db.prepare('DELETE FROM Ficha').run();
      db.prepare('DELETE FROM Programa').run();
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in reset:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
