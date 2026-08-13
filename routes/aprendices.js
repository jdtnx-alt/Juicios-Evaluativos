const router = require('express').Router();
const db     = require('../database');

// GET /api/aprendices?q=&ficha=&juicio=&page=1&limit=20
router.get('/', (req, res) => {
  const { q = '', ficha = '', juicio = '', estado = '', page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const search = `%${q}%`;

  let where = 'WHERE (a.nombre LIKE ? OR a.apellido LIKE ? OR a.documento LIKE ?)';
  const params = [search, search, search];

  if (ficha) { where += ' AND a.id_ficha = ?'; params.push(ficha); }
  if (estado) { where += ' AND a.estado = ?'; params.push(estado); }
  if (juicio) { where += ' AND EXISTS (SELECT 1 FROM JuicioEvaluacion je2 WHERE je2.id_aprendiz=a.id_aprendiz AND je2.estado_juicio=?)'; params.push(juicio); }

  const total = db.prepare(`
    SELECT COUNT(DISTINCT a.id_aprendiz) as c
    FROM Aprendiz a ${where}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT a.id_aprendiz, a.documento, a.tipo_documento, a.nombre, a.apellido, a.estado,
           f.numero as ficha_numero, f.id_ficha,
           p.nombre as programa_nombre,
           COUNT(CASE WHEN je.estado_juicio='Aprobado'    THEN 1 END) as aprobadas,
           COUNT(CASE WHEN je.estado_juicio='No Aprobado' THEN 1 END) as no_aprobadas,
           COUNT(CASE WHEN je.estado_juicio='Por Evaluar' THEN 1 END) as por_evaluar,
           COUNT(je.id_juicio) as total_juicios
    FROM Aprendiz a
    LEFT JOIN Ficha f        ON a.id_ficha = f.id_ficha
    LEFT JOIN Programa p     ON f.id_programa = p.id_programa
    LEFT JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
    ${where}
    GROUP BY a.id_aprendiz
    ORDER BY a.apellido, a.nombre
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));

  res.json({ data: rows, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET /api/aprendices/:id/detalle
router.get('/:id/detalle', (req, res) => {
  const aprendiz = db.prepare(`
    SELECT a.*, f.numero as ficha_numero, p.nombre as programa_nombre
    FROM Aprendiz a
    LEFT JOIN Ficha f    ON a.id_ficha = f.id_ficha
    LEFT JOIN Programa p ON f.id_programa = p.id_programa
    WHERE a.id_aprendiz = ?
  `).get(req.params.id);

  if (!aprendiz) return res.status(404).json({ error: 'No encontrado' });

  const competencias = db.prepare(`
    SELECT competencia_nombre as competencia, resultado_nombre as resultado,
           estado_juicio, fecha_hora, funcionario_nombre as func_nombre
    FROM JuicioEvaluacion
    WHERE id_aprendiz = ?
    ORDER BY competencia_nombre
  `).all(req.params.id);

  res.json({ aprendiz, competencias });
});

module.exports = router;
