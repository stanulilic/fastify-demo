import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const dbFile = process.env.DB_FILE || "./blog.db";

async function setupDatabase() {
  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Database and posts table created successfully");
  await db.close();
}

setupDatabase().catch((err) => {
  console.error("Error setting up the database:", err);
});
