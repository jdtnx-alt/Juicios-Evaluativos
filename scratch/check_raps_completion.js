const db = require('../database');

const ficha = 11;

// Revisar por cada resultado de aprendizaje cuántos aprendices están calificados vs por evaluar
const raps = db.prepare(`
  SELECT je.competencia_nombre, je.resultado_nombre,
         COUNT(DISTINCT a.id_aprendiz) as total_aprendices,
         SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados,
         SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
  FROM Aprendiz a
  JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  WHERE a.estado = 'En Formación' AND a.id_ficha = ?
  GROUP BY je.competencia_nombre, je.resultado_nombre
  HAVING calificados > 0 AND por_evaluar > 0
`).all(ficha);

console.log('Resultados de Aprendizaje que tienen calificaciones incompletas (algunos calificados y otros Por Evaluar):', raps.length);
if (raps.length > 0) {
  console.log(raps);
} else {
  console.log('En los 24 aprendices En Formación de esta ficha, todos los RAPs calificados tienen el 100% de los aprendices calificados, o 0% calificados.');
  
  // Miremos qué pasaba con los 31 aprendices (incluyendo Retiro Voluntario y Traslado)
  const rapsConTodos = db.prepare(`
    SELECT je.competencia_nombre, je.resultado_nombre,
           COUNT(DISTINCT a.id_aprendiz) as total_aprendices,
           SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados,
           SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
    FROM Aprendiz a
    JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    WHERE a.id_ficha = ?
    GROUP BY je.competencia_nombre, je.resultado_nombre
    HAVING calificados > 0 AND por_evaluar > 0
  `).all(ficha);
  console.log('Si contamos a TODOS los aprendices (incluyendo retirados/trasladados):', rapsConTodos.length);
}
