const db = require('../database');

const fichasSummary = db.prepare(`
  SELECT f.id_ficha, f.numero, 
         COUNT(DISTINCT a.id_aprendiz) as total_aprendices,
         COUNT(je.id_juicio) as total_juicios,
         SUM(CASE WHEN je.estado_juicio = 'Aprobado' THEN 1 ELSE 0 END) as aprobados,
         SUM(CASE WHEN je.estado_juicio = 'No Aprobado' THEN 1 ELSE 0 END) as no_aprobados,
         SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
  FROM Ficha f
  LEFT JOIN Aprendiz a ON a.id_ficha = f.id_ficha
  LEFT JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  GROUP BY f.id_ficha
`).all();

console.log('Fichas Summary:', fichasSummary);
