const db = require('../database');

// 1. Total counts
console.log('Total Fichas:', db.prepare('SELECT COUNT(*) as c FROM Ficha').get().c);
console.log('Total Aprendices:', db.prepare('SELECT COUNT(*) as c FROM Aprendiz').get().c);
console.log('Total Juicios:', db.prepare('SELECT COUNT(*) as c FROM JuicioEvaluacion').get().c);

// 2. Apprentices without a Ficha
const orphans = db.prepare(`
  SELECT a.id_aprendiz, a.nombre, a.apellido, a.documento
  FROM Aprendiz a
  WHERE a.id_ficha IS NULL
`).all();
console.log('Orphan apprentices (id_ficha IS NULL):', orphans.length, orphans.slice(0, 5));

// 3. Juicios belonging to orphan apprentices
const orphanJuicios = db.prepare(`
  SELECT COUNT(*) as c
  FROM JuicioEvaluacion je
  JOIN Aprendiz a ON je.id_aprendiz = a.id_aprendiz
  WHERE a.id_ficha IS NULL
`).get().c;
console.log('Juicios of orphan apprentices:', orphanJuicios);

// 4. Duplicate juicios per apprentice/competence/resultado
// (e.g. if the same result is imported multiple times)
const duplicates = db.prepare(`
  SELECT id_aprendiz, competencia_nombre, resultado_nombre, COUNT(*) as c
  FROM JuicioEvaluacion
  GROUP BY id_aprendiz, competencia_nombre, resultado_nombre
  HAVING COUNT(*) > 1
`).all();
console.log('Duplicate evaluation records (same apprentice and result):', duplicates.length);

if (duplicates.length > 0) {
  console.log('Example duplicate:', duplicates[0]);
}
