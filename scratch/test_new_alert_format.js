const db = require('../database');

const ficha = 11;

// Query para detectar RAPs donde algunos aprendices estan calificados y otros quedaron "Por Evaluar"
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

console.log('Resultados incompletos encontrados:', rapsIncompletos.length);

const alertas = [];
for (const rap of rapsIncompletos) {
  const faltantes = db.prepare(`
    SELECT DISTINCT a.nombre, a.apellido
    FROM Aprendiz a
    JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    WHERE a.estado = 'En Formación' AND a.id_ficha = ?
      AND je.resultado_nombre = ?
      AND je.estado_juicio = 'Por Evaluar'
  `).all(ficha, rap.resultado_nombre);

  alertas.push({
    competencia: rap.competencia_nombre,
    resultado: rap.resultado_nombre,
    pct: Math.round((rap.calificados / rap.total_aprendices) * 100),
    faltantes: faltantes.map(f => `${f.nombre} ${f.apellido || ''}`.trim())
  });
}

console.log('Alertas generadas:', alertas);
