import "dotenv/config";
import { createPool } from "mysql2/promise";

/**
 * 建表脚本：Prompt 配置化相关 6 张表 + learning_plans.skill_level 字段
 * 运行：npx tsx db/add-prompt-tables.ts
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPool(connectionString);

  const statements: Array<[string, string]> = [
    [
      "learning_types",
      `CREATE TABLE IF NOT EXISTS \`learning_types\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`type_key\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`description\` text,
        \`icon\` varchar(50),
        \`color\` varchar(20),
        \`detect_keywords\` json,
        \`phase_strategy\` json,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`is_active\` enum('true','false') NOT NULL DEFAULT 'true',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_learning_types_key\` (\`type_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
    [
      "prompt_components",
      `CREATE TABLE IF NOT EXISTS \`prompt_components\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`component_key\` varchar(100) NOT NULL,
        \`category\` enum('role','rule','constraint','format','example','context') NOT NULL,
        \`scope\` enum('common','type','purpose') NOT NULL,
        \`type_key\` varchar(50),
        \`purpose\` enum('detect','assessment','outline','content','qa'),
        \`title\` varchar(100) NOT NULL,
        \`content\` text NOT NULL,
        \`variables\` json,
        \`is_active\` enum('true','false') NOT NULL DEFAULT 'true',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_prompt_components_key\` (\`component_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
    [
      "prompt_templates",
      `CREATE TABLE IF NOT EXISTS \`prompt_templates\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`template_key\` varchar(100) NOT NULL,
        \`type_key\` varchar(50),
        \`purpose\` enum('detect','assessment','outline','content','qa') NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`description\` varchar(255),
        \`temperature\` float NOT NULL DEFAULT 0.3,
        \`max_tokens\` int NOT NULL DEFAULT 2000,
        \`response_format\` enum('json_object','text','stream') NOT NULL DEFAULT 'text',
        \`is_active\` enum('true','false') NOT NULL DEFAULT 'true',
        \`current_version\` int NOT NULL DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_prompt_templates_key\` (\`template_key\`),
        UNIQUE KEY \`uq_prompt_templates_type_purpose\` (\`type_key\`, \`purpose\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
    [
      "prompt_template_items",
      `CREATE TABLE IF NOT EXISTS \`prompt_template_items\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`template_id\` bigint unsigned NOT NULL,
        \`component_id\` bigint unsigned NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`slot\` enum('system','user') NOT NULL DEFAULT 'system',
        \`override_content\` text,
        \`is_active\` enum('true','false') NOT NULL DEFAULT 'true',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_template_items_order\` (\`template_id\`, \`slot\`, \`sort_order\`),
        KEY \`idx_template_items_template\` (\`template_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
    [
      "prompt_versions",
      `CREATE TABLE IF NOT EXISTS \`prompt_versions\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`template_id\` bigint unsigned NOT NULL,
        \`version\` int NOT NULL,
        \`assembled_system\` text,
        \`assembled_user\` text,
        \`temperature\` float,
        \`max_tokens\` int,
        \`change_note\` varchar(255),
        \`created_by\` bigint unsigned,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_prompt_versions_tv\` (\`template_id\`, \`version\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
    [
      "ai_generation_logs",
      `CREATE TABLE IF NOT EXISTS \`ai_generation_logs\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` bigint unsigned,
        \`plan_id\` bigint unsigned,
        \`task_type\` enum('detect','assessment','outline','content','qa') NOT NULL,
        \`type_key\` varchar(50),
        \`template_id\` bigint unsigned,
        \`template_version\` int,
        \`input_vars\` json,
        \`output_raw\` text,
        \`output_parsed\` json,
        \`parse_success\` enum('true','false'),
        \`retry_count\` int NOT NULL DEFAULT 0,
        \`status\` enum('success','failed') NOT NULL,
        \`error_message\` text,
        \`prompt_tokens\` int,
        \`completion_tokens\` int,
        \`duration_ms\` int,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_logs_user\` (\`user_id\`),
        KEY \`idx_ai_logs_task\` (\`task_type\`, \`type_key\`),
        KEY \`idx_ai_logs_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ],
  ];

  try {
    for (const [name, sql] of statements) {
      await pool.query(sql);
      console.log(`✅ ${name} table created`);
    }

    // learning_plans 增加 skill_level 字段（评估结果落到计划）
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_plans' AND COLUMN_NAME = 'skill_level'`,
    );
    if ((cols as unknown[]).length === 0) {
      await pool.query(
        `ALTER TABLE \`learning_plans\`
         ADD COLUMN \`skill_level\` varchar(10) NOT NULL DEFAULT 'l1' AFTER \`learning_type\``,
      );
      console.log("✅ learning_plans.skill_level column added");
    } else {
      console.log("⏭  learning_plans.skill_level already exists");
    }

    const [rows] = await pool.query(
      `SHOW TABLES LIKE 'prompt%'`,
    );
    console.log(
      "prompt tables:",
      (rows as Array<Record<string, unknown>>).map((r) => Object.values(r)[0]).join(", "),
    );
  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
