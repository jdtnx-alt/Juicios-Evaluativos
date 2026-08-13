const router = require('express').Router();
const db     = require('../database');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, p.nombre as programa_nombre,
           COUNT(DISTINCT a.id_aprendiz) as total_aprendices
    FROM Ficha f
    LEFT JOIN Programa p  ON f.id_programa = p.id_programa
    LEFT JOIN Aprendiz a  ON a.id_ficha    = f.id_ficha
    GROUP BY f.id_ficha
    ORDER BY f.numero
  `).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { numero, jornada, id_programa } = req.body;
  if (!numero) return res.status(400).json({ error: 'El número de ficha es requerido' });
  try {
    const info = db.prepare(
      'INSERT INTO Ficha (numero, jornada, id_programa) VALUES (?,?,?)'
    ).run(numero, jornada || null, id_programa || null);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { numero, jornada, id_programa } = req.body;
  db.prepare('UPDATE Ficha SET numero=?, jornada=?, id_programa=? WHERE id_ficha=?')
    .run(numero, jornada, id_programa, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  try {
    db.transaction(() => {
      // Delete existing evaluations first to satisfy FK constraints without CASCADE on DB schema
      db.prepare('DELETE FROM JuicioEvaluacion WHERE id_aprendiz IN (SELECT id_aprendiz FROM Aprendiz WHERE id_ficha = ?)').run(req.params.id);
      // Delete all apprentices of this ficha
      db.prepare('DELETE FROM Aprendiz WHERE id_ficha = ?').run(req.params.id);
      db.prepare('DELETE FROM Ficha WHERE id_ficha=?').run(req.params.id);
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting ficha:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
