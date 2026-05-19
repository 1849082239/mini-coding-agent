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
  content: "这个项目的入口文件在哪？",
};

const state: AgentState = {
  messages: [userMessage],
  task: "这个项目的入口文件在哪？",
  workingDir: process.cwd(),
};

const result = await runAgent(state, model, tools);
console.log(result);