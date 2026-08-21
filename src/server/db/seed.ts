import 'dotenv/config';
import { getDatabase, initDatabase } from './index.js';

const db = getDatabase();
await initDatabase(db);
console.log('Catálogo inicial actualizado.');
db.close();
