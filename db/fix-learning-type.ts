import "dotenv/config";
import { createPool } from "mysql2/promise";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = createPool(connectionString);

  try {
    // 检查当前 learning_type 字段类型
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM learning_plans WHERE Field = 'learning_type'"
    );
    console.log("Current learning_type column:", JSON.stringify(columns, null, 2));

    // 如果是 enum 类型，改成 varchar
    const col = (columns as any[])[0];
    if (col && col.Type && col.Type.startsWith("enum")) {
      console.log("Column is ENUM, converting to VARCHAR(30)...");
      await pool.query(
        "ALTER TABLE learning_plans MODIFY COLUMN learning_type VARCHAR(30) NOT NULL DEFAULT 'abstract_logic'"
      );
      console.log("✅ Converted to VARCHAR(30)");
    } else if (col && col.Type && col.Type.includes("varchar")) {
      console.log("Column is already VARCHAR, no change needed");
    } else {
      console.log("Column type:", col?.Type, "- attempting to add/modify...");
      // Try to add the column if it doesn't exist
      try {
        await pool.query(
          "ALTER TABLE learning_plans ADD COLUMN learning_type VARCHAR(30) NOT NULL DEFAULT 'abstract_logic'"
        );
        console.log("✅ Added column");
      } catch (e: any) {
        if (e.code === "ER_DUP_FIELDNAME") {
          // Column exists, modify it
          await pool.query(
            "ALTER TABLE learning_plans MODIFY COLUMN learning_type VARCHAR(30) NOT NULL DEFAULT 'abstract_logic'"
          );
          console.log("✅ Modified existing column to VARCHAR(30)");
        } else {
          throw e;
        }
      }
    }

    // Verify
    const [verify] = await pool.query(
      "SHOW COLUMNS FROM learning_plans WHERE Field = 'learning_type'"
    );
    console.log("Updated column:", JSON.stringify(verify, null, 2));

  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
