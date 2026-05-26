import type { AgentState, Message, ModelResponse, Tool } from "./types";
import { Model } from "./model";

export async function runAgent(
  state: AgentState,
  model: Model,
  tools: Tool[]
): Promise<string> {
  try {
    const normalizedWorkingDir = state.workingDir.replace(/\\/g, "/");
    const systemMessage: Message = {
      role: "system",
      content: [
        "You are a helpful code repository assistant that follows a strict ReAct (Reason + Act) workflow.",
        "",
        "## Workflow you MUST follow every time:",
        "1. **Plan first**: At the very start, call the `create_todos` tool to break the task into numbered.",
        "2. **Execute step-by-step**: For each step:",
        "   a. Call `update_todo` with status `running` to mark it as in-progress.",
        "   b. You MUST call relevant tools (e.g., `glob`, `search`, `read_file`, `write_file`, `run_command`, etc.) to actually perform the operations required by this step. Directly updating a step to completed without calling any work-related tools is strictly prohibited.",
        "   c. Validate the result of the tools. DO NOT ignore errors.",
        "      - If any tool returns an error message (e.g. '错误：', 'Error:'), or a command exits with a non-zero code (e.g. exit code 1 or 2), you MUST call `update_todo` with status `failed` for this step.",
        "      - Do NOT mark a failed step as `completed`. If a step fails, you must think and take corrective actions (e.g. create a missing file using `write_file`, fix code syntax, install missing modules), and then run the step again.",
        "      - Once the step succeeds and achieves its objective without any errors, call `update_todo` with status `completed`.",
        "3. **Summarize**: After all steps are completed, provide a final answer to the user in Chinese.",
        "",
        "## Tool usage rules:",
        "- ALWAYS call `create_todos` before doing any other work.",
        "- ALWAYS track every step with `update_todo`.",
        "- NEVER call `update_todo` with status `completed` unless you have successfully invoked the necessary tools to perform the work for that step. The tool will reject your update if no work tool execution is detected.",
        "- Use `search` and `read_file` to gather information — never guess or fabricate file content.",
        "- If a file needed does not exist, use `write_file` or appropriate tools to create it. Never skip or ignore a missing file error.",
        "- When searching, use English identifiers/keywords (e.g. 'tools', 'agent', 'import') rather than Chinese words.",
        "",
        "## Response language:",
        "- Always respond to the user in Chinese.",
        "",
        `Current working directory: ${normalizedWorkingDir}`,
        `Operating System: ${process.platform === "win32" ? "Windows" : process.platform}`,
        "Project Package Manager: pnpm",
        "Note on Windows Compatibility:",
        "- DO NOT use Unix-specific commands like 'mkdir -p' or 'touch' inside run_command. For creating files or directories, use the write_file tool directly, which automatically handles folder creation recursively.",
        "- When running project scripts or installing modules, use the 'pnpm' command (e.g., 'pnpm test') instead of 'npm' or 'yarn'.",
      ].join("\n"),
    };

    const allMessages: Message[] = [systemMessage, ...state.messages];
    let response: ModelResponse;
    try {
      response = await model.chat(allMessages, tools);
    } catch (chatError) {
      console.error("[Agent] 初始化大模型调用失败:", chatError);
      return `大模型调用失败：${chatError instanceof Error ? chatError.message : String(chatError)}`;
    }

    // 简化版循环：最多执行 15 轮工具调用，留够自动纠错与修复的步骤空间
    for (let i = 0; i < 15; i++) {
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
        // 同步当前对话历史到状态中，使得工具能感知上下文并做出安全校验
        state.messages = [...allMessages];

        let result: string;
        try {
          result = await tool.execute(toolCall.arguments, state);
        } catch (toolError) {
          console.error(`[Agent] 工具 ${toolCall.name} 执行失败:`, toolError);
          result = `工具执行发生异常错误：${toolError instanceof Error ? toolError.message : String(toolError)}`;
        }
        console.log(`[Agent] 工具 ${toolCall.name} 返回结果:\n${result}`);
        allMessages.push({
          role: "tool_result",
          toolCallId: toolCall.id,
          result,
        });
      }

      // 再调用模型
      try {
        response = await model.chat(allMessages, tools);
      } catch (chatError) {
        console.error("[Agent] 循环调用大模型失败:", chatError);
        return `大模型调用失败：${chatError instanceof Error ? chatError.message : String(chatError)}`;
      }
    }

    return response.content || "未能完成任务。";
  } catch (globalError) {
    console.error("[Agent] 运行时发生未捕获的错误:", globalError);
    return `执行出错：${globalError instanceof Error ? globalError.message : String(globalError)}`;
  }
}