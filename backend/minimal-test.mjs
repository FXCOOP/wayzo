import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND = path.join(__dirname, '..', 'frontend');
const INDEX = path.join(FRONTEND, 'index.backend.html');

console.log('Starting minimal test server...');
console.log('Frontend path:', FRONTEND);
console.log('Index file:', INDEX);
console.log('Index exists:', fs.existsSync(INDEX));

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