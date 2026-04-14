const Database = require('better-sqlite3');
const db = new Database('ac_piles.db');
console.log(db.prepare("SELECT * FROM work_orders").all());
