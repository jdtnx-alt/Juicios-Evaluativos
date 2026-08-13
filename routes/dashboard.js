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
    const competencias = db.prepare(`
      SELECT je.competencia_nombre, 
             COUNT(*) as total_evaluaciones,
             SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados
      FROM Aprendiz a
      JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
      WHERE a.estado = 'En Formación' AND a.id_ficha = ? AND je.competencia_nombre IS NOT NULL
      GROUP BY je.competencia_nombre
      HAVING (SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) >= 0.8
         AND SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) < COUNT(*)
    `).all(ficha);

    for (const c of competencias) {
      const faltantes = db.prepare(`
        SELECT DISTINCT a.nombre, a.apellido 
        FROM Aprendiz a
        JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
        WHERE a.estado = 'En Formación' AND a.id_ficha = ? 
          AND je.competencia_nombre = ? 
          AND je.estado_juicio = 'Por Evaluar'
      `).all(ficha, c.competencia_nombre);

      if (faltantes.length > 0) {
        alertas.push({
          competencia: c.competencia_nombre,
          pct: Math.round((c.calificados / c.total_evaluaciones) * 100),
          faltantes: faltantes.map(f => `${f.nombre} ${f.apellido||''}`.trim())
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
