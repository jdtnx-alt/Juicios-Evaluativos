const db = require('../database');

// 1. Check Ficha
const ficha = db.prepare(`SELECT * FROM Ficha WHERE numero = '3142784'`).get();
if (!ficha) {
  console.log('Ficha 3142784 not found');
  process.exit(0);
}
console.log('Ficha found:', ficha);

// 2. Count Juicios by status for this Ficha
const juiciosCount = db.prepare(`
  SELECT je.estado_juicio, COUNT(*) as count
  FROM JuicioEvaluacion je
  JOIN Aprendiz a ON je.id_aprendiz = a.id_aprendiz
  WHERE a.id_ficha = ?
  GROUP BY je.estado_juicio
`).all(ficha.id_ficha);
console.log('Juicios count for this Ficha:', juiciosCount);

// 3. Find details of any 'Por Evaluar' juicios for En Formacion apprentices
const porEvaluarDetails = db.prepare(`
  SELECT a.nombre, a.apellido, a.estado, je.competencia_nombre, je.resultado_nombre
  FROM JuicioEvaluacion je
  JOIN Aprendiz a ON je.id_aprendiz = a.id_aprendiz
  WHERE a.id_ficha = ? AND je.estado_juicio = 'Por Evaluar'
`).all(ficha.id_ficha);
console.log('Por Evaluar details:', porEvaluarDetails);

// 4. Let's also print ALL apprentices for this ficha and their states
const apprentices = db.prepare(`
  SELECT nombre, apellido, estado, COUNT(*) as total_juicios
  FROM Aprendiz a
  LEFT JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
  WHERE a.id_ficha = ?
  GROUP BY a.id_aprendiz
`).all(ficha.id_ficha);
console.log('Apprentices in this Ficha:', apprentices);
