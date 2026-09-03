const db = require('../database');
const fichaId = 11; // 3142784

const comp = '37714 - INTERACTUAR EN LENGUA INGLESA DE FORMA ORAL Y ESCRITA DENTRO DE CONTEXTOS SOCIALES Y LABORALES SEGÚN LOS CRITERIOS ESTABLECIDOS POR EL MARCO COMÚN EUROPEO DE REFERENCIA PARA LAS LENGUAS.';

const aprendices = db.prepare(`SELECT id_aprendiz, nombre, apellido FROM Aprendiz WHERE id_ficha = ? AND estado = 'En Formación'`).all(fichaId);
console.log('Total aprendices En Formación:', aprendices.length);

let conAlgunCalificado = 0;
let sinNingunCalificado = []; // estos serían los "faltantes reales"

for (const a of aprendices) {
  const juicios = db.prepare(`
    SELECT estado_juicio, COUNT(*) as c
    FROM JuicioEvaluacion
    WHERE id_aprendiz = ? AND competencia_nombre = ?
    GROUP BY estado_juicio
  `).all(a.id_aprendiz, comp);

  const tieneCalificado = juicios.some(j => j.estado_juicio === 'Aprobado' || j.estado_juicio === 'No Aprobado');
  
  if (tieneCalificado) {
    conAlgunCalificado++;
  } else {
    sinNingunCalificado.push(`${a.nombre} ${a.apellido || ''}`.trim());
  }
}

console.log('\nAprendices CON al menos 1 RAP calificado en esa competencia:', conAlgunCalificado);
console.log('Aprendices SIN NINGÚN RAP calificado (olvidados por completo):', sinNingunCalificado.length);
console.log('Porcentaje real calificados:', Math.round(conAlgunCalificado / aprendices.length * 100) + '%');
console.log('\nLista de faltantes reales:');
sinNingunCalificado.forEach(n => console.log(' -', n));
