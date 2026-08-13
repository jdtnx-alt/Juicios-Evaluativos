const db = require('../database');

const fid = 8; // Ficha 3142784

// Let's run the proposed query
const competencies = db.prepare(`
  SELECT je.competencia_nombre, 
         COUNT(*) as total_evaluaciones,
         SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados
  FROM Aprendiz a
  JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  WHERE a.estado = 'En Formación' AND a.id_ficha = ? AND je.competencia_nombre IS NOT NULL
  GROUP BY je.competencia_nombre
  HAVING (SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) >= 0.8
     AND SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) < COUNT(*)
`).all(fid);

console.log('Competencies with corrected query:', competencies);

for (const c of competencies) {
  const faltantes = db.prepare(`
    SELECT DISTINCT a.nombre, a.apellido 
    FROM Aprendiz a
    JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    WHERE a.estado = 'En Formación' AND a.id_ficha = ? 
      AND je.competencia_nombre = ? 
      AND je.estado_juicio = 'Por Evaluar'
  `).all(fid, c.competencia_nombre);

  console.log(`Alert for competence: "${c.competencia_nombre}"`);
  console.log('Percentage:', Math.round((c.calificados / c.total_evaluaciones) * 100));
  console.log('Faltantes:', faltantes.map(f => `${f.nombre} ${f.apellido||''}`.trim()));
}
