// 临时脚本：用 smaug 本地配置中的 X 凭据执行只读搜索。
// 凭据只注入子进程环境变量，绝不打印、不写文件。
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const query = process.argv[2];
const count = process.argv[3] ?? "20";
if (!query) {
  console.error("用法: node x-search.mjs <query> [count]");
  process.exit(1);
}

const configPath = path.join("tools", "smaug", "smaug.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const authToken = config?.twitter?.authToken;
const ct0 = config?.twitter?.ct0;
if (!authToken || !ct0 || authToken.includes("YOUR_")) {
  console.error("smaug 配置中没有可用的 X 凭据");
  process.exit(1);
}

const bird = path.join("node_modules", ".bin", "bird");
const child = spawn(
  bird,
  ["search", query, "--count", count, "--json", "--plain"],
  { env: { ...process.env, AUTH_TOKEN: authToken, CT0: ct0 } },
);

let out = "";
let err = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (err += d));
child.on("exit", (code) => {
  if (code !== 0) {
    // stderr 可能含请求细节，只输出不含凭据的错误摘要
    console.error(`bird 退出码 ${code}`);
    console.error(err.replaceAll(authToken, "***").replaceAll(ct0, "***").slice(0, 2000));
    process.exit(code ?? 1);
  }
  process.stdout.write(out);
});
