const db = require('../database');

// Ficha 3142784 = id_ficha 11
const fichaId = 11;

console.log('=== Estado general de aprendices en ficha 11 ===');
const estados = db.prepare('SELECT estado, COUNT(*) as c FROM Aprendiz WHERE id_ficha = ? GROUP BY estado').all(fichaId);
console.log(estados);

console.log('\n=== Competencias con la 37714 en ficha 11 ===');
const comp37 = db.prepare(`
  SELECT DISTINCT je.competencia_nombre 
  FROM JuicioEvaluacion je 
  JOIN Aprendiz a ON a.id_aprendiz = je.id_aprendiz 
  WHERE a.id_ficha = ? AND je.competencia_nombre LIKE '%37714%'
`).all(fichaId);
console.log(comp37);

if (comp37.length === 0) {
  console.log('\n!!! La competencia 37714 no existe para ficha 11 en la BD actual !!!');
  console.log('Revisando qué ficha tiene esa competencia...');
  const enCualFicha = db.prepare(`
    SELECT a.id_ficha, f.numero, COUNT(*) as c
    FROM JuicioEvaluacion je 
    JOIN Aprendiz a ON a.id_aprendiz = je.id_aprendiz 
    JOIN Ficha f ON f.id_ficha = a.id_ficha
    WHERE je.competencia_nombre LIKE '%37714%'
    GROUP BY a.id_ficha
  `).all();
  console.log('Ficha(s) con esa competencia:', enCualFicha);
}

console.log('\n=== Revisando la query completa de alertas para ficha 11 ===');
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
`).all(fichaId);
console.log('Competencias que disparan alerta (>= 80% pero no 100%):', competencias.length);

// Ahora revisemos la query de faltantes para esa competencia
if (competencias.length > 0) {
  const c = competencias[0];
  const pct = Math.round(c.calificados / c.total_evaluaciones * 100);
  console.log('\nCompetencia que dispara alerta:', c.competencia_nombre.substring(0, 60));
  console.log('Porcentaje:', pct + '% calificados');
  console.log('Total filas juicio:', c.total_evaluaciones, '| Calificados:', c.calificados);

  const faltantes = db.prepare(`
    SELECT DISTINCT a.nombre, a.apellido, a.id_aprendiz
    FROM Aprendiz a
    JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    WHERE a.estado = 'En Formación' AND a.id_ficha = ? 
      AND je.competencia_nombre = ? 
      AND je.estado_juicio = 'Por Evaluar'
  `).all(fichaId, c.competencia_nombre);

  console.log('\nFaltantes según query actual:', faltantes.length);

  // El error: un aprendiz puede aparecer en faltantes aunque tenga ALGUNOS RAPs calificados
  // Verificar: ¿alguno de los faltantes tiene RAPs calificados?
  if (faltantes.length > 0) {
    const ejemplo = faltantes[0];
    const juiciosEjemplo = db.prepare(`
      SELECT je.estado_juicio, COUNT(*) as c
      FROM JuicioEvaluacion je
      WHERE je.id_aprendiz = ? AND je.competencia_nombre = ?
      GROUP BY je.estado_juicio
    `).all(ejemplo.id_aprendiz, c.competencia_nombre);
    console.log('\nAprendiz ejemplo:', ejemplo.nombre, ejemplo.apellido);
    console.log('Sus juicios en esta competencia:', juiciosEjemplo);
    console.log('-> Tiene algunos Por Evaluar Y algunos Aprobados/No Aprobados? O solo Por Evaluar?');
    const tieneCalificado = juiciosEjemplo.some(j => j.estado_juicio === 'Aprobado' || j.estado_juicio === 'No Aprobado');
    console.log('Tiene al menos un RAP calificado en esta competencia:', tieneCalificado);
    if (tieneCalificado) {
      console.log('*** BUG CONFIRMADO: aparece como faltante pero ya tiene RAPs calificados ***');
    }
  }
}

// Ahora entender REALMENTE qué significa "calificado" para un aprendiz en una competencia
console.log('\n=== Análisis correcto: aprendices COMPLETAMENTE calificados vs parcialmente ===');
const aprendicesEnFormacion = db.prepare('SELECT id_aprendiz, nombre, apellido FROM Aprendiz WHERE id_ficha = ? AND estado = ?').all(fichaId, 'En Formación');
console.log('Total aprendices En Formación en ficha 11:', aprendicesEnFormacion.length);

if (competencias.length > 0) {
  const c = competencias[0];
  let totalAprendices = 0, totalCalifCompleto = 0, totalAlgunSinCalif = 0;
  for (const a of aprendicesEnFormacion) {
    const juicios = db.prepare('SELECT estado_juicio, COUNT(*) as c FROM JuicioEvaluacion WHERE id_aprendiz = ? AND competencia_nombre = ? GROUP BY estado_juicio').all(a.id_aprendiz, c.competencia_nombre);
    if (juicios.length === 0) continue;
    totalAprendices++;
    const porEvaluar = juicios.find(j => j.estado_juicio === 'Por Evaluar')?.c || 0;
    if (porEvaluar === 0) totalCalifCompleto++;
    else totalAlgunSinCalif++;
  }
  console.log('Aprendices con TODOS sus RAPs calificados:', totalCalifCompleto, '/', totalAprendices);
  console.log('Aprendices con AL MENOS UN RAP Por Evaluar:', totalAlgunSinCalif, '/', totalAprendices);
  console.log('% real de aprendices completamente calificados:', Math.round(totalCalifCompleto / totalAprendices * 100) + '%');
}
