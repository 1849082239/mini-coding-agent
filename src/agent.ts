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
      "You are a helpful code repository assistant.",
      "Use the provided tools to search and read files to answer the user's questions.",
      "Do not guess or make up file content. Always use tools to get information first.",
      "IMPORTANT: If you call a tool, you must format the XML tags exactly as: <function=tool_name>{\"arg_name\": \"value\"}</function>.",
      "For example: <function=search>{\"query\": \"main\"}</function>.",
      "NEVER format it like <function=search{\"query\": \"main\"}>. The '>' bracket must be immediately after the tool name, and before the JSON arguments.",
      "Therefore, you MUST NEVER use backslashes (\\) or double quotes (\") in any tool arguments (such as the query parameter of the search tool).",
      "If you need to search for text containing special characters or quotes, search for a simple substring instead (for example, search for main instead of main\\(\\) or __main__ instead of \\\"__main__\\\").",
      "Please always respond to the user in Chinese.",
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
        allMessages.push({
          role: "tool_result",
          toolCallId: toolCall.id,
          result: `错误：未知工具 ${toolCall.name}`,
        });
        continue;
      }

      const result = await tool.execute(toolCall.arguments, state);
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