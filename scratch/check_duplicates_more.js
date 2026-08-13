const db = require('../database');

const apprentice113 = db.prepare('SELECT * FROM Aprendiz WHERE id_aprendiz = 113').get();
console.log('Apprentice 113:', apprentice113);

if (apprentice113) {
  const f = db.prepare('SELECT * FROM Ficha WHERE id_ficha = ?').get(apprentice113.id_ficha);
  console.log('Ficha for 113:', f);
}

// Let's print all Fichas currently in the database
const allFichas = db.prepare('SELECT * FROM Ficha').all();
console.log('All Fichas in DB:', allFichas);

// Let's see if there are other apprentices with the same name or document
const duplicateApprentices = db.prepare(`
  SELECT documento, COUNT(*) as c 
  FROM Aprendiz 
  GROUP BY documento 
  HAVING COUNT(*) > 1
`).all();
console.log('Duplicate apprentices by documento:', duplicateApprentices);
