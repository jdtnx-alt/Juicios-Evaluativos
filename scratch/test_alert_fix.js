const db = require('../database');

const ficha = 11; // Ficha 3142784

const competenciasActivas = db.prepare(`
  SELECT DISTINCT je.competencia_nombre
  FROM JuicioEvaluacion je
  JOIN Aprendiz a ON je.id_aprendiz = a.id_aprendiz
  WHERE a.estado = 'En Formación' AND a.id_ficha = ?
    AND je.competencia_nombre IS NOT NULL
    AND je.estado_juicio IN ('Aprobado', 'No Aprobado')
`).all(ficha);

console.log('Competencias con al menos un RAP calificado:', competenciasActivas.length);

const totalAprendices = db.prepare(`
  SELECT COUNT(*) as c FROM Aprendiz WHERE id_ficha = ? AND estado = 'En Formación'
`).get(ficha).c;
console.log('Total aprendices En Formación:', totalAprendices);

const alertas = [];
for (const { competencia_nombre } of competenciasActivas) {
  const faltantes = db.prepare(`
    SELECT DISTINCT a.nombre, a.apellido
    FROM Aprendiz a
    JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    WHERE a.estado = 'En Formación' AND a.id_ficha = ?
      AND je.competencia_nombre = ?
      AND je.estado_juicio = 'Por Evaluar'
      AND EXISTS (
        SELECT 1
        FROM JuicioEvaluacion je2
        JOIN Aprendiz a2 ON je2.id_aprendiz = a2.id_aprendiz
        WHERE a2.estado = 'En Formación' AND a2.id_ficha = ?
          AND je2.competencia_nombre = je.competencia_nombre
          AND je2.resultado_nombre = je.resultado_nombre
          AND je2.estado_juicio IN ('Aprobado', 'No Aprobado')
          AND a2.id_aprendiz != a.id_aprendiz
      )
  `).all(ficha, competencia_nombre, ficha);

  if (faltantes.length > 0) {
    const conOlvidados = new Set(faltantes.map(f => f.nombre + '|' + (f.apellido || '')));
    const sinOlvidados = totalAprendices - conOlvidados.size;
    const pct = Math.round((sinOlvidados / totalAprendices) * 100);

    alertas.push({
      competencia: competencia_nombre,
      pct,
      totalFaltantes: faltantes.length,
      faltantes: faltantes.map(f => (f.nombre + ' ' + (f.apellido || '')).trim())
    });
  }
}

console.log('Alertas resultantes:', JSON.stringify(alertas, null, 2));
