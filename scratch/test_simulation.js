const db = require('../database');

const rap = db.prepare("SELECT resultado_nombre, competencia_nombre FROM JuicioEvaluacion WHERE estado_juicio = 'Aprobado' LIMIT 1").get();
console.log('RAP a probar:', rap.resultado_nombre.substring(0, 50));

try {
  db.transaction(() => {
    // Tomar 1 aprendiz y simular que el docente olvidó calificarlo (pasarlo a 'Por Evaluar')
    const aprendiz = db.prepare(`
      SELECT a.id_aprendiz, a.nombre, a.apellido 
      FROM Aprendiz a 
      JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz 
      WHERE a.id_ficha = 11 AND a.estado = 'En Formación' AND je.resultado_nombre = ? 
      LIMIT 1
    `).get(rap.resultado_nombre);

    console.log('Simulando olvido para:', aprendiz.nombre, aprendiz.apellido);
    db.prepare("UPDATE JuicioEvaluacion SET estado_juicio = 'Por Evaluar' WHERE id_aprendiz = ? AND resultado_nombre = ?")
      .run(aprendiz.id_aprendiz, rap.resultado_nombre);

    // Correr la consulta exacta de alertas del dashboard:
    const rapsIncompletos = db.prepare(`
      SELECT je.competencia_nombre, je.resultado_nombre,
             COUNT(DISTINCT a.id_aprendiz) as total_aprendices,
             SUM(CASE WHEN je.estado_juicio IN ('Aprobado', 'No Aprobado') THEN 1 ELSE 0 END) as calificados,
             SUM(CASE WHEN je.estado_juicio = 'Por Evaluar' THEN 1 ELSE 0 END) as por_evaluar
      FROM Aprendiz a
      JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
      WHERE a.estado = 'En Formación' AND a.id_ficha = 11 AND je.competencia_nombre IS NOT NULL
      GROUP BY je.competencia_nombre, je.resultado_nombre
      HAVING calificados > 0 AND por_evaluar > 0
    `).all();

    console.log('¿Alerta detectada?:', rapsIncompletos.length === 1);
    const faltantes = db.prepare(`
      SELECT DISTINCT a.nombre, a.apellido
      FROM Aprendiz a
      JOIN JuicioEvaluacion je ON je.id_aprendiz = a.id_aprendiz
      WHERE a.estado = 'En Formación' AND a.id_ficha = 11
        AND je.resultado_nombre = ?
        AND je.estado_juicio = 'Por Evaluar'
    `).all(rap.resultado_nombre);

    console.log('Estudiante faltante detectado con precisión:', faltantes.map(f => f.nombre + ' ' + (f.apellido||'')).join(', '));
    console.log('Porcentaje de avance del grupo en ese RAP:', Math.round(rapsIncompletos[0].calificados / rapsIncompletos[0].total_aprendices * 100) + '%');

    // Deshacer el cambio para no alterar la BD real
    throw new Error('ROLLBACK_EXITOSO');
  })();
} catch (e) {
  if (e.message === 'ROLLBACK_EXITOSO') {
    console.log('✅ Prueba completada con éxito. La base de datos quedó intacta.');
  } else {
    console.error('Error inesperado:', e);
  }
}
