import type { AgentState, Message, ModelResponse, Tool } from "./types";
import { Model } from "./model";

export async function runAgent(
  state: AgentState,
  model: Model,
  tools: Tool[]
): Promise<string> {
  const normalizedWorkingDir = state.workingDir.replace(/\\/g, "/");
  const systemMessage: Message = {
    role: "system",
    content: [
      "You are a helpful code repository assistant that follows a strict ReAct (Reason + Act) workflow.",
      "",
      "## Workflow you MUST follow every time:",
      "1. **Plan first**: At the very start, call the `create_todos` tool to break the task into numbered steps.",
      "2. **Execute step-by-step**: For each step:",
      "   a. Call `update_todo` with status `running` to mark it as in-progress.",
      "   b. Use `search` or `read_file` tools as needed to gather information.",
      "   c. Call `update_todo` with status `completed` (or `failed` on error) when done.",
      "3. **Summarize**: After all steps are completed, provide a final answer to the user in Chinese.",
      "",
      "## Tool usage rules:",
      "- ALWAYS call `create_todos` before doing any other work.",
      "- ALWAYS track every step with `update_todo`.",
      "- Use `search` and `read_file` to gather information — never guess or fabricate file content.",
      "- IMPORTANT: Format tool calls exactly as: <function=tool_name>{\"arg_name\": \"value\"}</function>.",
      "- For example: <function=search>{\"query\": \"main\"}</function>.",
      "- NEVER use backslashes or unescaped double quotes inside tool argument values.",
      "- When searching, use English identifiers/keywords (e.g. 'tools', 'agent', 'import') rather than Chinese words.",
      "",
      "## Response language:",
      "- Always respond to the user in Chinese.",
      "",
      `Current working directory: ${normalizedWorkingDir}`,
    ].join("\n"),
  };

  const allMessages: Message[] = [systemMessage, ...state.messages];
  let response: ModelResponse = await model.chat(allMessages, tools);

  // 简化版循环：最多执行 5 轮工具调用
  for (let i = 0; i < 5; i++) {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response.content;
    }

    // 追加 assistant 消息（含工具调用）
    allMessages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // 执行每个工具调用
    for (const toolCall of response.toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        console.warn(`[Agent] 未知工具: ${toolCall.name}`);
        allMessages.push({
          role: "tool_result",
          toolCallId: toolCall.id,
          result: `错误：未知工具 ${toolCall.name}`,
        });
        continue;
      }

      console.log(`[Agent] 调用工具: ${toolCall.name}, 参数:`, JSON.stringify(toolCall.arguments));
      const result = await tool.execute(toolCall.arguments, state);
      console.log(`[Agent] 工具 ${toolCall.name} 返回结果长度: ${result.length}`);
      allMessages.push({
        role: "tool_result",
        toolCallId: toolCall.id,
        result,
      });
    }

    // 再调用模型
    response = await model.chat(allMessages, tools);
  }

  return response.content || "未能完成任务。";
}