import { existsSync, readFileSync, writeFileSync } from "node:fs";

import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";

export interface SqliteHandle {
  db: SqlJsDatabase;
  persist: () => void;
  close: () => void;
}

export async function initializeDatabase(dbPath: string): Promise<SqliteHandle> {
  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: (file) => {
      // Load wasm from installed module location.
      return require.resolve(`sql.js/dist/${file}`);
    }
  });

  const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      raw_price_text TEXT,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_price_history_product_captured
    ON price_history (product_id, captured_at);
  `);

  const persist = (): void => {
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
  };

  const close = (): void => {
    persist();
    db.close();
  };

  return { db, persist, close };
}
