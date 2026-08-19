/**
 * 为 learning_outline 表添加阶段与难度字段。
 * 运行: npx tsx db/add-outline-columns.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 未配置");
    process.exit(1);
  }
  const conn = await mysql.createConnection(url);

  const alters = [
    "ALTER TABLE learning_outline ADD COLUMN phase_name VARCHAR(255) NULL",
    "ALTER TABLE learning_outline ADD COLUMN phase_order INT NULL",
    "ALTER TABLE learning_outline ADD COLUMN difficulty ENUM('basic','intermediate','advanced') NULL",
    "ALTER TABLE learning_outline ADD COLUMN prerequisites TEXT NULL",
    "ALTER TABLE learning_outline ADD COLUMN learning_objective TEXT NULL",
  ];

  for (const sql of alters) {
    try {
      await conn.execute(sql);
      console.log("OK:", sql.slice(0, 60));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Duplicate column")) {
        console.log("SKIP (exists):", sql.slice(0, 60));
      } else {
        console.error("FAIL:", msg);
      }
    }
  }

  await conn.end();
  console.log("Done.");
}

main();
