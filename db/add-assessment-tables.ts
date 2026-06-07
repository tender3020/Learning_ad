import "dotenv/config";
import { createPool } from "mysql2/promise";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPool(connectionString);

  // 评估记录表
  const createAssessmentsSQL = `
    CREATE TABLE IF NOT EXISTS \`assessments\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`user_id\` bigint unsigned NOT NULL,
      \`plan_id\` bigint unsigned NOT NULL,
      \`goal\` text NOT NULL,
      \`skill_level\` enum('l1','l2','l3','l4','l5') DEFAULT 'l3',
      \`score\` int DEFAULT 0,
      \`total_questions\` int DEFAULT 0,
      \`correct_count\` int DEFAULT 0,
      \`summary\` text,
      \`status\` enum('pending','completed') DEFAULT 'pending',
      \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // 评估答题记录表
  const createAnswersSQL = `
    CREATE TABLE IF NOT EXISTS \`assessment_answers\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`assessment_id\` bigint unsigned NOT NULL,
      \`question_index\` int NOT NULL,
      \`question\` text NOT NULL,
      \`options_a\` text NOT NULL,
      \`options_b\` text NOT NULL,
      \`options_c\` text NOT NULL,
      \`options_d\` text NOT NULL,
      \`correct_answer\` varchar(10) NOT NULL,
      \`user_answer\` varchar(10) DEFAULT NULL,
      \`explanation\` text,
      \`difficulty\` enum('basic','intermediate','advanced','expert') DEFAULT 'basic',
      \`is_correct\` enum('true','false') DEFAULT NULL,
      \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await pool.query(createAssessmentsSQL);
    console.log("✅ assessments table created");

    await pool.query(createAnswersSQL);
    console.log("✅ assessment_answers table created");

    // Verify
    const [rows] = await pool.query("SHOW TABLES LIKE 'assessments%'");
    console.log("Tables:", (rows as any[]).map((r: any) => Object.values(r)[0]).join(", "));
  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
