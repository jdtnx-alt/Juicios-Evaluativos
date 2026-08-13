const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../sena.db'));
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Aprendiz'").get();
console.log(schema.sql);
db.close();
