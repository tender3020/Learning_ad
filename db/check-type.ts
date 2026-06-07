import "dotenv/config";
import { createPool } from "mysql2/promise";

async function main() {
  const pool = createPool(process.env.DATABASE_URL!);
  try {
    // 检查表结构
    const [cols] = await pool.query("SHOW COLUMNS FROM learning_plans");
    console.log("=== learning_plans columns ===");
    (cols as any[]).forEach((c) => console.log(`  ${c.Field}: ${c.Type}`));

    // 检查最近3条记录
    const [plans] = await pool.query(
      "SELECT id, goal, learning_type, subject, status, current_day FROM learning_plans ORDER BY id DESC LIMIT 3"
    );
    console.log("\n=== recent plans ===");
    console.log(JSON.stringify(plans, null, 2));

    // 检查 learning_outline
    const [outline] = await pool.query(
      "SELECT plan_id, day_number, title, goal FROM learning_outline ORDER BY id DESC LIMIT 5"
    );
    console.log("\n=== recent outline ===");
    console.log(JSON.stringify(outline, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
