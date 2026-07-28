/** `npm run seed` — wipe the database back to the design handoff's 30 records. */
import { openDatabase, resetToSeed } from './connection.js';

const db = openDatabase();
resetToSeed(db);
const { n } = db.prepare('SELECT COUNT(*) AS n FROM comics').get();
console.log(`Seed restored: ${n} records.`);
