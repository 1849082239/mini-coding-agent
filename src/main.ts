import "dotenv/config";
import * as readline from "readline/promises"; // 引入 readline 用于终端交互
import { stdin as input, stdout as output } from "process";
import { Model } from "./model";
import { runAgent } from "./agent";
import { tools } from "./tools/index";
import { PermissionGuard } from "./permissions/permission-guard"; // 假设你把权限守卫写在这个路径
import type { AgentState, Message } from "./types";

const apiKey = process.env.OPENAI_API_KEY!;
const model = new Model({
  apiKey,
  baseURL: process.env.OPENAI_BASE_URL,
  model: process.env.MODEL_NAME,
});

// 初始化终端输入输出接口
const rl = readline.createInterface({ input, output });

// 实例化权限守卫
const permissionGuard = new PermissionGuard({
  confirm: async (tool, args, reason) => {
    // 根据工具类型显示不同的提示信息
    if (tool === "run_command") {
      console.log(`\n⚠️ 需要执行命令: ${args.command}`);
    } else if (tool === "write_file" || tool === "patch_file") {
      console.log(`\n📝 需要修改文件: ${args.path}`);
    } else {
      console.log(`\n🔧 需要执行工具: ${tool}`);
    }
    console.log(`  原因: ${reason}`);
    
    // 等待用户输入 y/n
    const answer = await rl.question("  允许执行吗? (y/n) ");
    const approved = answer.toLowerCase().startsWith("y");
    
    if (!approved) {
      console.log("  ❌ 已拒绝该操作\n");
    }
    return approved;
  },
});

// 获取命令行参数（如 pnpm dev 帮我在 src/utils.ts 里添加一个 hello 函数）
const cliInput = process.argv.slice(2).join(" ").trim();
let inputPrompt = cliInput;

if (!inputPrompt) {
  // 如果命令行没有参数，则在终端以交互方式提示用户输入
  inputPrompt = await rl.question("请输入您想让 Agent 执行的任务: ");
}

// 如果用户既没有传参也没有输入，则使用默认的示例任务
if (!inputPrompt.trim()) {
  inputPrompt = "在src/tools 文件夹下编写一个 计算器工具";
}

console.log(`\n🤖 收到任务: "${inputPrompt}"\n`);

const systemMessage: Message = {
  role: "system",
  content: `You are a local repository coding assistant.
You do NOT have access to the internet. You do NOT have access to 'brave_search', 'web_search', 'wolfram_alpha' or any external tools.
If you attempt to call 'brave_search' or any external tool, the execution will CRASH.
If you need to find functions, files, or variables in the codebase, you MUST use the local 'search' tool.

你是一个本地代码库 Assistant。
你没有任何网络访问权限，也没有 'brave_search' 或 'wolfram_alpha' 等外部/内置工具。
如果你尝试调用 'brave_search'，程序会立即报错崩溃。
要查找本地代码中的函数（例如 'hello' 函数）、文件或变量，你必须使用提供给你的本地 'search' 工具。`,
};

const userMessage: Message = {
  role: "user",
  content: inputPrompt,
};

const state: AgentState = {
  messages: [systemMessage, userMessage],
  task: "项目架构",
  workingDir: process.cwd(),
};

// 💡 重点：把 permissionGuard 作为选项传给 runAgent
const result = await runAgent(state, model, tools, { permissionGuard });

// Find the assistant messages and format the output nicely
const assistantMessages = result.messages.filter(m => m.role === "assistant");
const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

console.log("\n💬 Agent 回复:");
console.log("==================================================");
if (lastAssistantMessage && lastAssistantMessage.content) {
  console.log(lastAssistantMessage.content);
} else {
  console.log("（未返回文本回复）");
}
console.log("==================================================");
console.log(`📊 统计信息:`);
console.log(`  - 状态: ${result.status === 'success' ? '✅ 成功' : '⚠️ 未完全完成 (' + result.status + ')'}`);
console.log(`  - 工具调用次数: ${result.stats.toolCallCount}`);
console.log("==================================================\n");

// 记得关闭终端流
rl.close();