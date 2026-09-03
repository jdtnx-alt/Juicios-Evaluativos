const db = require('../database');

// Simular qué pasa si un instructor califica a 23 aprendices y olvida a 1
// Busquemos un RAP que tenga 24 calificados y simulemos qué detectaría nuestro algoritmo
const ficha = 11;

console.log('--- Probando algoritmo de detección de omisión por Resultado de Aprendizaje ---');

const rapsConCalificados = db.prepare(`
  SELECT je.competencia_nombre, je.resultado_nombre,
         COUNT(DISTINCT a.id_aprendiz) as total_grupo,
         SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados,
         SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
  FROM Aprendiz a
  JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  WHERE a.estado = 'En Formación' AND a.id_ficha = ?
  GROUP BY je.competencia_nombre, je.resultado_nombre
  HAVING calificados > 0
`).all(ficha);

console.log('Total RAPs que tienen alguna calificación:', rapsConCalificados.length);

// Supongamos que en uno de esos RAPs, 1 aprendiz está por evaluar mientras 23 están calificados:
const rapEjemplo = rapsConCalificados[0];
console.log('RAP Ejemplo:', rapEjemplo.resultado_nombre.substring(0, 60));
console.log('Calificados:', rapEjemplo.calificados, 'de', rapEjemplo.total_grupo);
