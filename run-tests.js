import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDir = "./test";
try {
  // Find all *.test.ts and *.test.js files in the test directory (excluding template/placeholder files like %s.test.ts)
  const files = readdirSync(testDir, { recursive: true })
    .filter((f) => (f.endsWith(".test.ts") || f.endsWith(".test.js")) && !f.includes("%s"))
    .map((f) => join(testDir, f));

  if (files.length === 0) {
    console.log("No test files found.");
    process.exit(0);
  }

  console.log("Running test files:", files);

  const result = spawnSync("node", ["--import", "tsx", "--test", ...files], {
    stdio: "inherit",
    shell: true,
  });

  process.exit(result.status ?? 0);
} catch (err) {
  console.error("Failed to run tests:", err);
  process.exit(1);
}
