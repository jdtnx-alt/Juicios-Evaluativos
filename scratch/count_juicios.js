const db = require('../database');

const ficha = db.prepare(`SELECT * FROM Ficha WHERE numero = '3142784'`).get();
if (!ficha) {
  console.log('Ficha 3142784 not found');
  process.exit(0);
}

const summary = db.prepare(`
  SELECT a.nombre, a.apellido, a.estado,
         SUM(CASE WHEN je.estado_juicio = 'Aprobado' THEN 1 ELSE 0 END) as aprobados,
         SUM(CASE WHEN je.estado_juicio = 'No Aprobado' THEN 1 ELSE 0 END) as no_aprobados,
         SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar,
         COUNT(je.id_juicio) as total
  FROM Aprendiz a
  LEFT JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  WHERE a.id_ficha = ?
  GROUP BY a.id_aprendiz
`).all(ficha.id_ficha);

console.log(JSON.stringify(summary, null, 2));
