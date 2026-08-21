import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { getDatabase, initDatabase } from './db/index.js';
import { attachRealtime } from './realtime.js';

const port = Number(process.env.PORT ?? 3000);
const db = getDatabase();

await initDatabase(db);

let realtime: ReturnType<typeof attachRealtime> | undefined;
const app = createApp(db, { onTripCreated: (trip) => realtime?.publishTrip(trip) });
const server = createServer(app);
realtime = attachRealtime(server);

server.listen(port, '0.0.0.0', () => {
  console.log(`Letterbondi disponible en http://localhost:${port}`);
});
