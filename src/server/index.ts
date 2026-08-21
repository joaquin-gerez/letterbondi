import 'dotenv/config';
import { createApp } from './app.js';
import { getDatabase, initDatabase } from './db/index.js';

const port = Number(process.env.PORT ?? 3000);
const db = getDatabase();

await initDatabase(db);

createApp(db).listen(port, '0.0.0.0', () => {
  console.log(`Letterbondi disponible en http://localhost:${port}`);
});
