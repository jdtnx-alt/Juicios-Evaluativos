const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'sena.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS Programa (
    id_programa   INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo        VARCHAR(255),
    nombre        VARCHAR(255) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Ficha (
    id_ficha     INTEGER PRIMARY KEY AUTOINCREMENT,
    numero       VARCHAR(30) NOT NULL UNIQUE,
    jornada      VARCHAR(20) CHECK(jornada IN ('Mañana','Mixta','Noche')),
    fecha_inicio DATE,
    fecha_fin    DATE,
    id_programa  INTEGER,
    FOREIGN KEY (id_programa) REFERENCES Programa(id_programa)
  );

  CREATE TABLE IF NOT EXISTS Aprendiz (
    id_aprendiz    INTEGER PRIMARY KEY AUTOINCREMENT,
    documento      VARCHAR(30) NOT NULL UNIQUE,
    tipo_documento VARCHAR(5)  CHECK(tipo_documento IN ('CC','TI')),
    nombre         VARCHAR(50) NOT NULL,
    apellido       VARCHAR(45),
    estado         VARCHAR(30) CHECK(estado IN ('Retiro Voluntario','En Formación','Traslado')),
    id_ficha       INTEGER,
    FOREIGN KEY (id_ficha) REFERENCES Ficha(id_ficha) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS JuicioEvaluacion (
    id_juicio          INTEGER PRIMARY KEY AUTOINCREMENT,
    estado_juicio      VARCHAR(20) CHECK(estado_juicio IN ('Aprobado','No Aprobado','Por Evaluar')),
    funcionario_nombre VARCHAR(150),
    fecha_hora         DATETIME,
    competencia_nombre VARCHAR(255),
    resultado_nombre   VARCHAR(255),
    id_aprendiz        INTEGER,
    FOREIGN KEY (id_aprendiz) REFERENCES Aprendiz(id_aprendiz) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ficha_numero ON Ficha(numero);
  CREATE INDEX IF NOT EXISTS idx_aprendiz_doc ON Aprendiz(documento);
  CREATE INDEX IF NOT EXISTS idx_aprendiz_ficha ON Aprendiz(id_ficha);
  CREATE INDEX IF NOT EXISTS idx_juicio_aprendiz_res ON JuicioEvaluacion(id_aprendiz, resultado_nombre);
`);

module.exports = db;
