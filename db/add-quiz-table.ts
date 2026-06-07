import "dotenv/config";
import { createPool } from "mysql2/promise";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPool(connectionString);

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS \`quiz_results\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`user_id\` bigint unsigned NOT NULL,
      \`plan_id\` bigint unsigned NOT NULL,
      \`day_number\` int NOT NULL,
      \`knowledge_name\` varchar(255) NOT NULL,
      \`question\` text NOT NULL,
      \`user_answer\` varchar(10) NOT NULL,
      \`correct_answer\` varchar(10) NOT NULL,
      \`is_correct\` enum('true','false') NOT NULL,
      \`attempt_number\` int NOT NULL DEFAULT 1,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.query(createTableSQL);
    console.log("✅ quiz_results table created successfully");

    // Verify
    const [rows] = await pool.query("SHOW TABLES LIKE 'quiz_results'");
    console.log("Table verification:", (rows as any[]).length > 0 ? "exists" : "not found");
  } catch (error) {
    console.error("❌ Failed to create table:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
