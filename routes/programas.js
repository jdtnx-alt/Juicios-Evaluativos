const router = require('express').Router();
const db     = require('../database');

router.get('/', (_req, res) => res.json(db.prepare('SELECT * FROM Programa ORDER BY nombre').all()));

router.post('/', (req, res) => {
  const { codigo, nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const info = db.prepare('INSERT INTO Programa (codigo, nombre) VALUES (?,?)').run(codigo || null, nombre);
  res.json({ id: info.lastInsertRowid });
});

module.exports = router;
