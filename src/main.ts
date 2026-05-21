import "dotenv/config";
import { Model } from "./model";
import { runAgent } from "./agent";
import { tools } from "./tools/index";
import type { AgentState, Message } from "./types";

const apiKey = process.env.OPENAI_API_KEY!;
const model = new Model({
  apiKey,
  baseURL: process.env.OPENAI_BASE_URL,
  model: process.env.MODEL_NAME,
});

const userMessage: Message = {
  role: "user",
  content: "帮我找出这个项目中所有工具的参数定义，对比它们是否一致，然后给出一份工具清单和改进建议",
};

const state: AgentState = {
  messages: [userMessage],
  task: "项目架构",
  workingDir: process.cwd(),
};

const result = await runAgent(state, model, tools);
console.log(result);