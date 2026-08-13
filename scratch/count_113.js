const db = require('../database');

const total = db.prepare('SELECT COUNT(*) as c FROM JuicioEvaluacion WHERE id_aprendiz = 113').get().c;
console.log('Total evaluations for apprentice 113:', total);

const states = db.prepare('SELECT estado_juicio, COUNT(*) as c FROM JuicioEvaluacion WHERE id_aprendiz = 113 GROUP BY estado_juicio').all();
console.log('States for apprentice 113:', states);
