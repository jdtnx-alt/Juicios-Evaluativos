const db = require('../database');

// 1. Get all tables
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log('Tables and their SQL:');
tables.forEach(t => {
  console.log(`Table: ${t.name}`);
  console.log(t.sql);
  console.log('---');
});
