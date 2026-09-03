const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../database');

const app = express();
app.use(express.json());
app.use('/api/import', require('../routes/import'));

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  const samplePath = path.join(__dirname, '../uploads/4225daa681eb7a6d1f66f472625c37ae');
  const tempTestFile = path.join(__dirname, 'test_copy.xlsx');
  fs.copyFileSync(samplePath, tempTestFile);

  try {
    // ── TEST 1: Preview endpoint ──
    console.log('\n--- Testing /api/import/preview ---');
    const blob1 = new Blob([fs.readFileSync(tempTestFile)]);
    const formPreview = new FormData();
    formPreview.append('file', blob1, 'test.xlsx');

    const resPreview = await fetch(`http://localhost:${port}/api/import/preview`, {
      method: 'POST',
      body: formPreview
    });
    const previewData = await resPreview.json();

    console.log('Preview response status:', resPreview.status);
    console.log('Preview meta:', previewData.meta);
    console.log('Preview fichaExists:', previewData.fichaExists);
    console.log('Preview existingFicha:', previewData.existingFicha);
    console.log('Preview totalRows:', previewData.totalRows);
    console.log('Preview headers count:', previewData.headers?.length);

    // ── TEST 2: Import / Upsert endpoint ──
    console.log('\n--- Testing /api/import (Upsert) ---');
    const countFichasBefore = db.prepare('SELECT COUNT(*) as c FROM Ficha').get().c;
    console.log('Fichas count in DB before import:', countFichasBefore);

    const blob2 = new Blob([fs.readFileSync(samplePath)]);
    const formImport = new FormData();
    formImport.append('file', blob2, 'test.xlsx');

    const resImport = await fetch(`http://localhost:${port}/api/import`, {
      method: 'POST',
      body: formImport
    });
    const importData = await resImport.json();

    console.log('Import response status:', resImport.status);
    console.log('Import response body:', importData);

    const countFichasAfter = db.prepare('SELECT COUNT(*) as c FROM Ficha').get().c;
    console.log('Fichas count in DB after import:', countFichasAfter);

    if (countFichasAfter === countFichasBefore) {
      console.log('SUCCESS: No duplicate ficha created! The ficha was correctly updated.');
    } else {
      console.error('FAILURE: Ficha count changed unexpectedly!');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    try { fs.unlinkSync(tempTestFile); } catch (_) {}
    server.close();
  }
});
