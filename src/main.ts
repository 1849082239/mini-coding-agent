import "dotenv/config";
import { Model } from "./model";
import { runAgent } from "./agent";
import { tools } from "./tools/index";
import type { AgentState, Message } from "./types";
import Groq from "groq-sdk";

const apiKey = process.env.OPENAI_API_KEY!;
const model = new Model({
  apiKey,
  baseURL: process.env.OPENAI_BASE_URL,
  model: process.env.MODEL_NAME,
});

const userMessage: Message = {
  role: "user",
  // content: "给 src目录下面的每一个文件都在 test 文件夹下新建一个对应的 xxx.test.ts 文件 例如 src/main.ts 对应 test/main.test.ts。并且执行测试用例",
  content: "在src/tools 文件夹下编写一个 计算器工具",
};

const state: AgentState = {
  messages: [userMessage],
  task: "项目架构",
  workingDir: process.cwd(),
};

const result = await runAgent(state, model, tools);
console.log(result);

// const groq = new Groq({ apiKey: process.env.OPENAI_API_KEY });

// const getModels = async () => {
//   return await groq.models.list();
// };

// getModels().then((models) => {
//   console.log(models);
// });
