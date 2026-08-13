const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/aprendices',   require('./routes/aprendices'));
app.use('/api/fichas',       require('./routes/fichas'));
app.use('/api/programas',    require('./routes/programas'));
app.use('/api/import',       require('./routes/import'));

const PORT = 3005;
app.listen(PORT, () => console.log(`SENA Evaluaciones corriendo en http://localhost:${PORT}`));
