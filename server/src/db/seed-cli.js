/** `npm run seed` — wipe the database back to the design handoff's 30 records. */
import { createDatabase, resetToSeed } from './connection.js';

const db = await createDatabase();
await resetToSeed(db);
const { n } = await db.get('SELECT COUNT(*) AS n FROM comics');
console.log(`Seed restored: ${n} records (${db.dialect}).`);
process.exit(0);
