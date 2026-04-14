import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("ac_piles.db");

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'operational',
    last_maintenance DATETIME,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS functional_tree (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    parent_id INTEGER,
    name TEXT NOT NULL,
    is_consumable BOOLEAN DEFAULT 0,
    is_critical BOOLEAN DEFAULT 0,
    life_expectancy_hours INTEGER,
    current_hours INTEGER DEFAULT 0,
    part_number TEXT,
    supplier TEXT,
    FOREIGN KEY(machine_id) REFERENCES machines(id),
    FOREIGN KEY(parent_id) REFERENCES functional_tree(id)
  );

  CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    part_id INTEGER,
    task_name TEXT NOT NULL,
    frequency_days INTEGER,
    frequency_hours INTEGER,
    personnel_id INTEGER,
    required_items TEXT,
    start_date DATETIME,
    last_done DATETIME,
    next_due DATETIME,
    description TEXT,
    FOREIGN KEY(machine_id) REFERENCES machines(id),
    FOREIGN KEY(part_id) REFERENCES functional_tree(id)
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    part_id INTEGER,
    schedule_id INTEGER,
    description TEXT NOT NULL,
    type TEXT CHECK(type IN ('preventive', 'corrective', 'consumable_change', 'unplanned_failure')),
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    closed_at DATETIME,
    duration_minutes INTEGER,
    technician TEXT,
    personnel_id INTEGER,
    diagnostic_notes TEXT,
    cost REAL DEFAULT 0,
    FOREIGN KEY(machine_id) REFERENCES machines(id),
    FOREIGN KEY(part_id) REFERENCES functional_tree(id),
    FOREIGN KEY(personnel_id) REFERENCES personnel(id),
    FOREIGN KEY(schedule_id) REFERENCES maintenance_schedules(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_name TEXT NOT NULL,
    stock_level INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    unit_price REAL,
    entry_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER,
    status TEXT DEFAULT 'pending',
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME,
    scheduled_date DATETIME,
    description TEXT,
    FOREIGN KEY(supplier_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER,
    inventory_id INTEGER,
    part_name TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL,
    description TEXT,
    FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY(inventory_id) REFERENCES inventory(id)
  );

  CREATE TABLE IF NOT EXISTS manufacturer_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('maintenance', 'spare_part', 'lubricant', 'consumable')),
    item_name TEXT NOT NULL,
    specification TEXT,
    frequency_hours INTEGER,
    frequency_days INTEGER,
    part_number TEXT,
    description TEXT,
    document_url TEXT,
    FOREIGN KEY(machine_id) REFERENCES machines(id)
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_id INTEGER,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS technical_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    colloquial_name TEXT,
    description TEXT
  );
`);

// Add description and part_name to purchase_orders and purchase_order_items if they don't exist
try { db.prepare("ALTER TABLE purchase_orders ADD COLUMN description TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE purchase_orders ADD COLUMN scheduled_date DATETIME").run(); } catch (e) {}
try { db.prepare("ALTER TABLE purchase_order_items ADD COLUMN description TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE purchase_order_items ADD COLUMN part_name TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE technical_names ADD COLUMN colloquial_name TEXT").run(); } catch (e) {}

// Migrations for existing databases
function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  if (!columns.some(col => col.name === columnName)) {
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Migration successful: Added ${columnName} to ${tableName}`);
    } catch (e: any) {
      console.warn(`Migration failed: Adding ${columnName} to ${tableName} - ${e.message}`);
    }
  }
}

addColumnIfNotExists("work_orders", "type", "TEXT CHECK(type IN ('preventive', 'corrective', 'consumable_change', 'unplanned_failure'))");
addColumnIfNotExists("work_orders", "diagnostic_notes", "TEXT");
addColumnIfNotExists("work_orders", "status", "TEXT DEFAULT 'open'");
addColumnIfNotExists("work_orders", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
addColumnIfNotExists("work_orders", "started_at", "DATETIME");
addColumnIfNotExists("work_orders", "closed_at", "DATETIME");
addColumnIfNotExists("work_orders", "duration_minutes", "INTEGER");
addColumnIfNotExists("work_orders", "technician", "TEXT");
addColumnIfNotExists("work_orders", "cost", "REAL DEFAULT 0");
addColumnIfNotExists("work_orders", "personnel_id", "INTEGER REFERENCES personnel(id)");
addColumnIfNotExists("work_orders", "root_cause", "TEXT");
addColumnIfNotExists("work_orders", "activities", "TEXT DEFAULT '[]'");
addColumnIfNotExists("maintenance_schedules", "activities", "TEXT DEFAULT '[]'");

addColumnIfNotExists("functional_tree", "part_number", "TEXT");
addColumnIfNotExists("functional_tree", "supplier", "TEXT");
addColumnIfNotExists("functional_tree", "parent_id", "INTEGER");
addColumnIfNotExists("functional_tree", "is_consumable", "BOOLEAN DEFAULT 0");
addColumnIfNotExists("functional_tree", "is_critical", "BOOLEAN DEFAULT 0");
addColumnIfNotExists("functional_tree", "life_expectancy_hours", "INTEGER");
addColumnIfNotExists("functional_tree", "current_hours", "INTEGER DEFAULT 0");
addColumnIfNotExists("work_orders", "part_id", "INTEGER");
addColumnIfNotExists("work_orders", "diagnostic_notes", "TEXT");
addColumnIfNotExists("maintenance_schedules", "part_id", "INTEGER");
addColumnIfNotExists("maintenance_schedules", "frequency_hours", "INTEGER");
addColumnIfNotExists("maintenance_schedules", "personnel_id", "INTEGER");
addColumnIfNotExists("maintenance_schedules", "required_items", "TEXT");
addColumnIfNotExists("inventory", "entry_date", "DATETIME DEFAULT CURRENT_TIMESTAMP");
addColumnIfNotExists("inventory", "unit_price", "REAL");
addColumnIfNotExists("maintenance_schedules", "start_date", "DATETIME");
addColumnIfNotExists("machines", "avg_daily_hours", "REAL DEFAULT 8.0");
addColumnIfNotExists("machines", "functional_tree_image_url", "TEXT");
addColumnIfNotExists("manufacturer_recommendations", "document_url", "TEXT");

// Migration for work_orders CHECK constraint
const workOrdersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='work_orders'").get() as { sql: string };
if (workOrdersSchema && workOrdersSchema.sql && !workOrdersSchema.sql.includes('unplanned_failure')) {
  try {
    console.log("Updating work_orders table to include 'unplanned_failure' type...");
    // Ensure columns exist before copying
    addColumnIfNotExists("work_orders", "part_id", "INTEGER");
    addColumnIfNotExists("work_orders", "diagnostic_notes", "TEXT");
    
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE work_orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        part_id INTEGER,
        personnel_id INTEGER,
        description TEXT NOT NULL,
        type TEXT CHECK(type IN ('preventive', 'corrective', 'consumable_change', 'unplanned_failure')),
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        closed_at DATETIME,
        duration_minutes INTEGER,
        technician TEXT,
        diagnostic_notes TEXT,
        FOREIGN KEY(machine_id) REFERENCES machines(id),
        FOREIGN KEY(part_id) REFERENCES functional_tree(id),
        FOREIGN KEY(personnel_id) REFERENCES personnel(id)
      );
      INSERT INTO work_orders_new (id, machine_id, part_id, personnel_id, description, type, status, created_at, started_at, closed_at, duration_minutes, technician, diagnostic_notes)
      SELECT id, machine_id, part_id, personnel_id, description, type, status, created_at, started_at, closed_at, duration_minutes, technician, diagnostic_notes FROM work_orders;
      DROP TABLE work_orders;
      ALTER TABLE work_orders_new RENAME TO work_orders;
      COMMIT;
    `);
    console.log("work_orders table updated successfully.");
  } catch (e: any) {
    try { db.exec("ROLLBACK;"); } catch(re) {}
    console.warn(`Migration failed: Updating work_orders table - ${e.message}`);
  }
}

// Seed initial machines if empty
const machineCount = db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number };
if (machineCount.count === 0) {
  const insertMachine = db.prepare("INSERT INTO machines (name, type, description) VALUES (?, ?, ?)");
  insertMachine.run("Banco de Soldadura", "Soldadura", "Estación de soldadura para pilotes");
  insertMachine.run("Sierra Cinta", "Corte", "Sierra industrial para perfiles metálicos");
  insertMachine.run("CNC Plasma", "Corte", "Máquina de corte por plasma automatizada");
  
  // Seed some functional tree components for Sierra Cinta (ID 2)
  const sierraId = 2;
  const insertCompSierra = db.prepare("INSERT INTO functional_tree (machine_id, name, is_consumable, life_expectancy_hours) VALUES (?, ?, ?, ?)");
  insertCompSierra.run(sierraId, "Motor Principal", 0, 5000);
  insertCompSierra.run(sierraId, "Sierra de Cinta (Hoja)", 1, 100);
  insertCompSierra.run(sierraId, "Sistema de Refrigeración", 0, 2000);
  insertCompSierra.run(sierraId, "Guías de Rodillos", 0, 1500);

  // Seed some functional tree components for CNC Plasma as example
  const cncId = 3; // Changed from 4 since Prensa was removed
  const insertComp = db.prepare("INSERT INTO functional_tree (machine_id, name, is_consumable, life_expectancy_hours) VALUES (?, ?, ?, ?)");
  insertComp.run(cncId, "Antorcha Plasma", 0, null);
  insertComp.run(cncId, "Boquilla (Nozzle)", 1, 50);
  insertComp.run(cncId, "Electrodo", 1, 40);
  insertComp.run(cncId, "Guía de Deslizamiento", 0, 2000);
}

// Ensure Prensa Hidráulica is removed if it exists from previous seeds
db.prepare("DELETE FROM machines WHERE name = 'Prensa Hidráulica'").run();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  const PORT = 3000;

  // API Routes
  app.get("/api/machines", (req, res) => {
    // Exclude functional_tree_image_url to prevent massive payloads
    const machines = db.prepare("SELECT id, name, type, status, last_maintenance, description, avg_daily_hours, CASE WHEN functional_tree_image_url IS NOT NULL THEN 1 ELSE 0 END as has_document FROM machines").all();
    res.json(machines);
  });

  app.get("/api/machines/:id/document", (req, res) => {
    const machine = db.prepare("SELECT functional_tree_image_url FROM machines WHERE id = ?").get(req.params.id) as any;
    if (!machine) return res.status(404).json({ error: "Machine not found" });
    res.json({ functional_tree_image_url: machine.functional_tree_image_url });
  });

  app.post("/api/machines", (req, res) => {
    const { name, type, description, functional_tree_image_url } = req.body;
    const info = db.prepare("INSERT INTO machines (name, type, description, functional_tree_image_url) VALUES (?, ?, ?, ?)")
      .run(name, type, description || null, functional_tree_image_url || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/machines/:id", (req, res) => {
    try {
      const { name, type, description, functional_tree_image_url } = req.body;
      
      // Get existing machine to handle partial updates
      const existing = db.prepare("SELECT * FROM machines WHERE id = ?").get(req.params.id) as any;
      if (!existing) {
        return res.status(404).json({ error: "Machine not found" });
      }

      db.prepare("UPDATE machines SET name = ?, type = ?, description = ?, functional_tree_image_url = ? WHERE id = ?")
        .run(
          name !== undefined ? name : existing.name, 
          type !== undefined ? type : existing.type, 
          description !== undefined ? description : existing.description, 
          functional_tree_image_url !== undefined ? functional_tree_image_url : existing.functional_tree_image_url, 
          req.params.id
        );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating machine:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/machines/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM maintenance_schedules WHERE machine_id = ?").run(id);
    db.prepare("DELETE FROM work_orders WHERE machine_id = ?").run(id);
    db.prepare("DELETE FROM functional_tree WHERE machine_id = ?").run(id);
    db.prepare("DELETE FROM machines WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/machines/:id/tree", (req, res) => {
    console.log(`Fetching tree for machine ID: ${req.params.id}`);
    try {
      const tree = db.prepare("SELECT * FROM functional_tree WHERE machine_id = ?").all(req.params.id);
      res.json(tree);
    } catch (error) {
      console.error(`Error fetching tree for machine ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch tree" });
    }
  });

  app.post("/api/machines/:id/tree", (req, res) => {
    const { name, is_consumable, is_critical, life_expectancy_hours, part_number, supplier, parent_id } = req.body;
    const info = db.prepare(`
      INSERT INTO functional_tree (machine_id, name, is_consumable, is_critical, life_expectancy_hours, part_number, supplier, parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, name, is_consumable ? 1 : 0, is_critical ? 1 : 0, life_expectancy_hours, part_number, supplier, parent_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/tree/:id", (req, res) => {
    db.prepare("DELETE FROM functional_tree WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/machines/:id/tree/sync", (req, res) => {
    const machineId = req.params.id;
    const nodes = req.body; // Array of nodes

    const deleteStmt = db.prepare("DELETE FROM functional_tree WHERE machine_id = ?");
    const insertStmt = db.prepare(`
      INSERT INTO functional_tree (id, machine_id, name, is_consumable, is_critical, life_expectancy_hours, part_number, supplier, parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sync = db.transaction((nodes) => {
      deleteStmt.run(machineId);
      for (const node of nodes) {
        insertStmt.run(
          node.id || null, 
          machineId, 
          node.name, 
          node.is_consumable ? 1 : 0, 
          node.is_critical ? 1 : 0,
          node.life_expectancy_hours || null, 
          node.part_number || null, 
          node.supplier || null, 
          node.parent_id || null
        );
      }
    });

    try {
      sync(nodes);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/schedules", (req, res) => {
    const schedules = db.prepare(`
      SELECT ms.*, m.name as machine_name, ft.name as part_name, p.name as personnel_name, c.name as company_name
      FROM maintenance_schedules ms
      JOIN machines m ON ms.machine_id = m.id
      LEFT JOIN functional_tree ft ON ms.part_id = ft.id
      LEFT JOIN personnel p ON ms.personnel_id = p.id
      LEFT JOIN companies c ON p.company_id = c.id
    `).all().map((s: any) => ({
      ...s,
      activities: JSON.parse(s.activities || '[]')
    }));
    res.json(schedules);
  });

  app.post("/api/schedules", (req, res) => {
    const { machine_id, part_id, task_name, frequency_days, frequency_hours, personnel_id, required_items, next_due, start_date, description, activities } = req.body;
    let final_next_due = next_due;
    
    if (!final_next_due) {
      // Logic: 8 hours/day of operation.
      const hoursPerDay = 8;
      const baseDate = start_date ? new Date(start_date + 'T00:00:00') : new Date();
      
      if (frequency_hours) {
        const hours = parseInt(frequency_hours);
        const days = hours <= 8 ? 0 : Math.floor(hours / hoursPerDay);
        const d = new Date(baseDate);
        d.setDate(d.getDate() + days);
        // Use local date string to avoid timezone shifts (YYYY-MM-DD)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        final_next_due = `${year}-${month}-${day}`;
      } else if (frequency_days) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + parseInt(frequency_days));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        final_next_due = `${year}-${month}-${day}`;
      } else {
        const d = new Date(baseDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        final_next_due = `${year}-${month}-${day}`;
      }
    }
    
    const activitiesJson = activities ? JSON.stringify(activities) : '[]';

    const info = db.prepare(`
      INSERT INTO maintenance_schedules (machine_id, part_id, task_name, frequency_days, frequency_hours, personnel_id, required_items, start_date, next_due, description, activities)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      machine_id || null, 
      part_id || null, 
      task_name, 
      frequency_days || null, 
      frequency_hours || null, 
      personnel_id || null, 
      required_items || null, 
      start_date || null,
      final_next_due, 
      description,
      activitiesJson
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/companies", (req, res) => {
    const companies = db.prepare("SELECT * FROM companies").all();
    res.json(companies);
  });

  app.post("/api/companies", (req, res) => {
    const { name } = req.body;
    const info = db.prepare("INSERT INTO companies (name) VALUES (?)").run(name);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/personnel", (req, res) => {
    const personnel = db.prepare(`
      SELECT p.*, c.name as company_name 
      FROM personnel p 
      LEFT JOIN companies c ON p.company_id = c.id
    `).all();
    res.json(personnel);
  });

  app.delete("/api/personnel/:id", (req, res) => {
    db.prepare("DELETE FROM personnel WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/companies/:id", (req, res) => {
    const { id } = req.params;
    // Check if company has personnel
    const personnelCount = db.prepare("SELECT COUNT(*) as count FROM personnel WHERE company_id = ?").get(id) as { count: number };
    if (personnelCount.count > 0) {
      return res.status(400).json({ error: "No se puede eliminar una empresa con personal asociado." });
    }
    db.prepare("DELETE FROM companies WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/personnel", (req, res) => {
    const { name, company_id } = req.body;
    const info = db.prepare("INSERT INTO personnel (name, company_id) VALUES (?, ?)").run(name, company_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/work-orders", (req, res) => {
    const orders = db.prepare(`
      SELECT wo.*, m.name as machine_name, ft.name as part_name
      FROM work_orders wo 
      LEFT JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN functional_tree ft ON wo.part_id = ft.id
      ORDER BY wo.created_at DESC
    `).all().map((wo: any) => ({
      ...wo,
      activities: JSON.parse(wo.activities || '[]')
    }));
    res.json(orders);
  });

  app.post("/api/work-orders", (req, res) => {
    const { machine_id, part_id, schedule_id, personnel_id, description, type, diagnostic_notes, activities } = req.body;
    const mId = machine_id ? Number(machine_id) : null;
    const pId = part_id ? Number(part_id) : null;
    const sId = schedule_id ? Number(schedule_id) : null;
    const persId = personnel_id ? Number(personnel_id) : null;
    const activitiesJson = activities ? JSON.stringify(activities) : '[]';
    
    const info = db.prepare("INSERT INTO work_orders (machine_id, part_id, schedule_id, personnel_id, description, type, diagnostic_notes, activities) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(mId, pId, sId, persId, description, type, diagnostic_notes || null, activitiesJson);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/work-orders/:id", (req, res) => {
    const { root_cause, diagnostic_notes, description, type, activities, personnel_id } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    
    if (root_cause !== undefined) {
      updates.push("root_cause = ?");
      values.push(root_cause);
    }
    if (diagnostic_notes !== undefined) {
      updates.push("diagnostic_notes = ?");
      values.push(diagnostic_notes);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (type !== undefined) {
      updates.push("type = ?");
      values.push(type);
    }
    if (activities !== undefined) {
      updates.push("activities = ?");
      values.push(JSON.stringify(activities));
    }
    if (personnel_id !== undefined) {
      updates.push("personnel_id = ?");
      values.push(personnel_id ? Number(personnel_id) : null);
    }
    
    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE work_orders SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
    
    res.json({ success: true });
  });

  app.patch("/api/work-orders/:id/start", (req, res) => {
    const { personnel_id, diagnostic_notes, activities } = req.body;
    const order = db.prepare("SELECT machine_id FROM work_orders WHERE id = ?").get(req.params.id) as { machine_id: number } | undefined;
    if (!order) return res.status(404).json({ error: "Work order not found" });
    
    const activitiesJson = activities ? JSON.stringify(activities) : undefined;

    db.transaction(() => {
      if (activitiesJson !== undefined) {
        db.prepare("UPDATE work_orders SET started_at = CURRENT_TIMESTAMP, status = 'in_progress', personnel_id = ?, diagnostic_notes = ?, activities = ? WHERE id = ?")
          .run(personnel_id || null, diagnostic_notes || null, activitiesJson, req.params.id);
      } else {
        db.prepare("UPDATE work_orders SET started_at = CURRENT_TIMESTAMP, status = 'in_progress', personnel_id = ?, diagnostic_notes = ? WHERE id = ?")
          .run(personnel_id || null, diagnostic_notes || null, req.params.id);
      }
      if (order.machine_id) {
        db.prepare("UPDATE machines SET status = 'maintenance' WHERE id = ?").run(order.machine_id);
      }
    })();
    
    res.json({ success: true });
  });

  app.patch("/api/work-orders/:id/close", (req, res) => {
    const order = db.prepare("SELECT started_at, machine_id, type FROM work_orders WHERE id = ?").get(req.params.id) as { started_at: string, machine_id: number, type: string } | undefined;
    if (!order) return res.status(404).json({ error: "Work order not found" });
    if (!order.started_at) return res.status(400).json({ error: "Order not started" });
    
    // Estimate cost: duration * base rate (e.g. $50/hr)
    const baseRate = 50; 
    
    db.transaction(() => {
      db.prepare(`
        UPDATE work_orders 
        SET closed_at = CURRENT_TIMESTAMP, 
            status = 'closed',
            duration_minutes = (strftime('%s', 'now') - strftime('%s', started_at)) / 60,
            cost = ((strftime('%s', 'now') - strftime('%s', started_at)) / 3600.0) * ?
        WHERE id = ?
      `).run(baseRate, req.params.id);
      
      if (order.machine_id) {
        db.prepare("UPDATE machines SET status = 'operational', last_maintenance = CURRENT_TIMESTAMP WHERE id = ?").run(order.machine_id);
      }
    })();
    
    res.json({ success: true });
  });

  app.delete("/api/work-orders/:id", (req, res) => {
    db.prepare("DELETE FROM work_orders WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/schedules/:id", (req, res) => {
    const id = req.params.id;
    db.prepare("UPDATE work_orders SET schedule_id = NULL WHERE schedule_id = ?").run(id);
    db.prepare("DELETE FROM maintenance_schedules WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.patch("/api/schedules/:id", (req, res) => {
    const { machine_id, part_id, task_name, frequency_days, frequency_hours, personnel_id, required_items, start_date, last_done, next_due, description, activities } = req.body;
    
    const activitiesJson = activities ? JSON.stringify(activities) : '[]';

    db.prepare(`
      UPDATE maintenance_schedules 
      SET machine_id = ?, part_id = ?, task_name = ?, frequency_days = ?, frequency_hours = ?, 
          personnel_id = ?, required_items = ?, start_date = ?, last_done = ?, next_due = ?, description = ?, activities = ?
      WHERE id = ?
    `).run(
      machine_id || null, 
      part_id || null, 
      task_name, 
      frequency_days || null, 
      frequency_hours || null, 
      personnel_id || null, 
      required_items || null, 
      start_date || null,
      last_done || null,
      next_due || null,
      description || null,
      activitiesJson,
      req.params.id
    );
    res.json({ success: true });
  });

  app.get("/api/inventory", (req, res) => {
    const items = db.prepare("SELECT * FROM inventory").all();
    res.json(items);
  });

  app.post("/api/inventory", (req, res) => {
    const { part_name, stock_level, min_stock, unit_price, entry_date } = req.body;
    const info = db.prepare("INSERT INTO inventory (part_name, stock_level, min_stock, unit_price, entry_date) VALUES (?, ?, ?, ?, ?)")
      .run(part_name, stock_level, min_stock, unit_price, entry_date || new Date().toISOString());
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/inventory/:id", (req, res) => {
    const { stock_level, min_stock, unit_price, entry_date } = req.body;
    db.prepare("UPDATE inventory SET stock_level = ?, min_stock = ?, unit_price = ?, entry_date = ? WHERE id = ?")
      .run(stock_level, min_stock, unit_price, entry_date, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/inventory/:id", (req, res) => {
    db.prepare("DELETE FROM inventory WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Purchase Orders
  app.get("/api/purchase-orders", (req, res) => {
    const orders = db.prepare(`
      SELECT po.*, c.name as supplier_name 
      FROM purchase_orders po
      LEFT JOIN companies c ON po.supplier_id = c.id
      ORDER BY po.created_at DESC
    `).all();
    
    const ordersWithItems = orders.map((order: any) => {
      const items = db.prepare(`
        SELECT poi.*, COALESCE(poi.part_name, i.part_name) as part_name 
        FROM purchase_order_items poi
        LEFT JOIN inventory i ON poi.inventory_id = i.id
        WHERE poi.purchase_order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    
    res.json(ordersWithItems);
  });

  app.post("/api/purchase-orders", (req, res) => {
    const { supplier_id, items, scheduled_date } = req.body; // items: [{ inventory_id, quantity, unit_price }]
    
    const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unit_price || 0)), 0);
    
    const transaction = db.transaction(() => {
      const result = db.prepare("INSERT INTO purchase_orders (supplier_id, total_amount, scheduled_date, description) VALUES (?, ?, ?, ?)")
        .run(supplier_id, total_amount, scheduled_date || null, req.body.description || null);
      const poId = result.lastInsertRowid;
      
      const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, inventory_id, part_name, quantity, unit_price, description) VALUES (?, ?, ?, ?, ?, ?)");
      for (const item of items) {
        insertItem.run(poId, item.inventory_id || null, item.part_name || null, item.quantity, item.unit_price, item.description || null);
      }
      return poId;
    });
    
    const poId = transaction();
    res.json({ id: poId });
  });

  app.put("/api/purchase-orders/:id", (req, res) => {
    const { supplier_id, items, scheduled_date } = req.body;
    const { id } = req.params;

    const transaction = db.transaction(() => {
      const order = db.prepare("SELECT status FROM purchase_orders WHERE id = ?").get(id) as { status: string };
      if (order.status === 'received') {
        throw new Error("Cannot edit a received purchase order");
      }

      const total_amount = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unit_price || 0)), 0);
      
      db.prepare("UPDATE purchase_orders SET supplier_id = ?, total_amount = ?, scheduled_date = ?, description = ? WHERE id = ?")
        .run(supplier_id, total_amount, scheduled_date || null, req.body.description || null, id);
      
      db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(id);
      
      const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, inventory_id, part_name, quantity, unit_price, description) VALUES (?, ?, ?, ?, ?, ?)");
      for (const item of items) {
        insertItem.run(id, item.inventory_id || null, item.part_name || null, item.quantity, item.unit_price, item.description || null);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/purchase-orders/:id", (req, res) => {
    const { id } = req.params;
    const order = db.prepare("SELECT status FROM purchase_orders WHERE id = ?").get(id) as { status: string };
    if (order.status === 'received') {
      return res.status(400).json({ error: "Cannot delete a received purchase order" });
    }

    db.transaction(() => {
      db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(id);
      db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
    })();
    res.json({ success: true });
  });

  app.patch("/api/purchase-orders/:id/receive", (req, res) => {
    const transaction = db.transaction(() => {
      const order = db.prepare("SELECT status FROM purchase_orders WHERE id = ?").get(req.params.id) as { status: string } | undefined;
      if (!order || order.status === 'received') return;
      
      db.prepare("UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.params.id);
      
      const items = db.prepare("SELECT inventory_id, part_name, quantity FROM purchase_order_items WHERE purchase_order_id = ?").all(req.params.id) as any[];
      
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        if (item.inventory_id) {
          db.prepare("UPDATE inventory SET stock_level = COALESCE(stock_level, 0) + ? WHERE id = ?")
            .run(qty, item.inventory_id);
        } else if (item.part_name) {
          const existing = db.prepare("SELECT id FROM inventory WHERE part_name = ?").get(item.part_name) as { id: number } | undefined;
          if (existing) {
            db.prepare("UPDATE inventory SET stock_level = COALESCE(stock_level, 0) + ? WHERE id = ?")
              .run(qty, existing.id);
          } else {
            db.prepare("INSERT INTO inventory (part_name, stock_level) VALUES (?, ?)")
              .run(item.part_name, qty);
          }
        }
      }
    });
    
    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error receiving PO:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/kpis", (req, res) => {
    const totalOrders = db.prepare("SELECT COUNT(*) as count FROM work_orders").get() as { count: number };
    const avgDuration = db.prepare("SELECT AVG(duration_minutes) as avg FROM work_orders WHERE status = 'closed'").get() as { avg: number };
    const machineStatus = db.prepare("SELECT status, COUNT(*) as count FROM machines GROUP BY status").all();
    const totalMachines = db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number };
    
    // Finance Metrics
    const totalCost = db.prepare("SELECT SUM(cost) as total FROM work_orders").get() as { total: number };
    const costByType = db.prepare("SELECT type, SUM(cost) as total FROM work_orders GROUP BY type").all();
    
    // HR Metrics
    const personnelWorkload = db.prepare(`
      SELECT p.name, COUNT(wo.id) as tasks, SUM(wo.duration_minutes) as total_minutes
      FROM personnel p
      LEFT JOIN work_orders wo ON p.id = wo.personnel_id
      GROUP BY p.id
    `).all();

    // Compliance: (Completed Preventive Orders / Total Preventive Orders) * 100
    const preventiveStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
      FROM work_orders 
      WHERE type = 'preventive'
    `).get() as { total: number, closed: number };
    
    const compliance = preventiveStats.total > 0 
      ? (preventiveStats.closed / preventiveStats.total) * 100 
      : 100;

    // Pending tasks in next 7 days
    const pendingTasks = db.prepare(`
      SELECT COUNT(*) as count 
      FROM maintenance_schedules 
      WHERE next_due <= date('now', '+7 days')
    `).get() as { count: number };
    
    res.json({
      totalOrders: totalOrders.count,
      mttr: avgDuration.avg || 0,
      machineStatus,
      totalMachines: totalMachines.count,
      compliance,
      pendingTasks: pendingTasks.count,
      finance: {
        totalCost: totalCost.total || 0,
        costByType
      },
      hr: {
        personnelWorkload
      }
    });
  });

  app.get("/api/technical-names", (req, res) => {
    const names = db.prepare("SELECT * FROM technical_names ORDER BY name ASC").all();
    res.json(names);
  });

  app.post("/api/technical-names", (req, res) => {
    const { name, colloquial_name, description } = req.body;
    try {
      const info = db.prepare("INSERT INTO technical_names (name, colloquial_name, description) VALUES (?, ?, ?)")
        .run(name, colloquial_name || null, description || null);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: "Este nombre técnico ya existe en la biblioteca." });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.delete("/api/technical-names/:id", (req, res) => {
    db.prepare("DELETE FROM technical_names WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/manufacturer-recommendations", (req, res) => {
    const recommendations = db.prepare(`
      SELECT r.*, m.name as machine_name 
      FROM manufacturer_recommendations r
      JOIN machines m ON r.machine_id = m.id
      ORDER BY m.name ASC, r.type ASC
    `).all();
    res.json(recommendations);
  });

  app.post("/api/manufacturer-recommendations", (req, res) => {
    const { machine_id, type, item_name, specification, frequency_hours, frequency_days, part_number, description, document_url } = req.body;
    const info = db.prepare(`
      INSERT INTO manufacturer_recommendations 
      (machine_id, type, item_name, specification, frequency_hours, frequency_days, part_number, description, document_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(machine_id, type, item_name, specification || null, frequency_hours || null, frequency_days || null, part_number || null, description || null, document_url || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/manufacturer-recommendations/:id", (req, res) => {
    const { document_url } = req.body;
    db.prepare("UPDATE manufacturer_recommendations SET document_url = ? WHERE id = ?").run(document_url || null, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/manufacturer-recommendations/:id", (req, res) => {
    db.prepare("DELETE FROM manufacturer_recommendations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Global error handler for API routes
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
