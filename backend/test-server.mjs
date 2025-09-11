import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND = path.join(__dirname, '..', 'frontend');
const INDEX = path.join(FRONTEND, 'index.backend.html');

const app = express();
const PORT = 10000;

app.use('/frontend', express.static(FRONTEND));

app.get('/', (req, res) => {
  console.log('Serving index:', INDEX);
  res.sendFile(INDEX);
});

app.listen(PORT, () => {
  console.log(`Test server running on :${PORT}`);
});