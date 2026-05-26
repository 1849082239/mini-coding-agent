import type { Tool, TodoStatus, AgentState } from "../types";
import type { TodoManager } from "../todo";

const VALID_STATUSES: TodoStatus[] = ["running", "completed", "failed"];

export function updateTodoTool(todoManager: TodoManager): Tool {
    return {
        name: "update_todo",
        description:
            "更新某个步骤的执行状态。" +
            "开始执行时标记为 running，完成后标记为 completed，失败时标记为 failed。",
        parameters: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "步骤 ID（创建时分配的编号，形如 '1'、'2'）",
                },
                status: {
                    type: "string",
                    description: "新状态：running、completed 或 failed",
                },
            },
            required: ["id", "status"],
        },

        async execute(args: Record<string, unknown>, state: AgentState): Promise<string> {
            const id = String(args.id);
            const status = String(args.status) as TodoStatus;

            if (!VALID_STATUSES.includes(status)) {
                return `错误：无效状态 "${status}"，可选值: ${VALID_STATUSES.join(", ")}`;
            }

            const currentItem = todoManager.getAll().find((t) => t.id === id);
            if (!currentItem) {
                return `提示：未找到 ID 为 "${id}" 的步骤。请注意，您只能更新当前执行计划中确实存在的步骤 ID（例如 step-1, step-2 等）。
如果您在批量处理多个文件，请勿将文件序号或文件名误当做步骤 ID。您应该在现有的步骤（例如 step-1）处于 running 状态下，一次性处理完所有文件，然后再将该步骤更新为 completed。请立刻停止尝试更新不存在的步骤 ID！

当前${todoManager.formatForPrompt()}`;
            }

            // 状态流转守护：只有处于 running 状态的步骤才能更新为 completed 或 failed
            if (status === "completed" || status === "failed") {
                if (currentItem.status !== "running") {
                    return `拒绝更新：无法将步骤 "${id}" 标记为 "${status}"。该步骤当前状态为 "${currentItem.status}"。根据严格的 ReAct 工作流规范，您必须先将步骤状态更新为 "running"，在实际执行该步骤的操作后，才能将其更新为 "${status}"。`;
                }
            }

            // 安全守护（Guardrail）：在标记为 completed 前，检查该步骤 running 期间的执行情况
            if (status === "completed") {
                let runningIndex = -1;
                const runningIndicator = `步骤 #${id} `;
                // 倒序寻找大模型何处把当前步骤设为 running 的 tool_result
                for (let j = state.messages.length - 1; j >= 0; j--) {
                    const msg = state.messages[j];
                    if (
                        msg.role === "tool_result" &&
                        msg.result.includes(runningIndicator) &&
                        msg.result.includes("→ running")
                    ) {
                        runningIndex = j;
                        break;
                    }
                }

                // 寻找大模型是在哪个 assistant 消息里把该步骤设为 running 的
                let runningAssistantIndex = -1;
                for (let j = state.messages.length - 1; j >= 0; j--) {
                    const msg = state.messages[j];
                    if (msg.role === "assistant" && msg.toolCalls) {
                        const hasRunningCall = msg.toolCalls.some(
                            (tc) =>
                                tc.name === "update_todo" &&
                                tc.arguments &&
                                typeof tc.arguments === "object" &&
                                String((tc.arguments as any).id) === id &&
                                String((tc.arguments as any).status) === "running"
                        );
                        if (hasRunningCall) {
                            runningAssistantIndex = j;
                            break;
                        }
                    }
                }

                // 检查是否在 running 期间调用过任何实际工作工具（非 update_todo 或 create_todos）
                if (runningAssistantIndex !== -1) {
                    let workToolCallsCount = 0;
                    for (let k = runningAssistantIndex; k < state.messages.length; k++) {
                        const msg = state.messages[k];
                        if (msg.role === "assistant" && msg.toolCalls) {
                            for (const tc of msg.toolCalls) {
                                if (tc.name !== "update_todo" && tc.name !== "create_todos") {
                                    workToolCallsCount++;
                                }
                            }
                        }
                    }
                    if (workToolCallsCount === 0) {
                        return `拒绝更新：未检测到在该步骤处于 running 状态期间调用过任何实际工作工具（如 glob, search, read_file, write_file, run_command 等）。在将步骤标记为 completed 之前，您必须调用相关工具来实际执行该步骤的任务，不允许直接跳过。请立刻调用适当工具执行步骤任务！`;
                    }
                }

                // 如果找到了起点，检查其后产生的所有 tool_result 看是否有失败错误
                if (runningIndex !== -1) {
                    const failedTools: string[] = [];
                    for (let k = runningIndex + 1; k < state.messages.length; k++) {
                        const msg = state.messages[k];
                        if (msg.role === "tool_result") {
                            const resultText = msg.result;
                            const hasExitCodeError = (() => {
                                const m = resultText.match(/exit code:\s*(-?\d+)/i);
                                return m && m[1] !== "0";
                            })();
                            const hasExplicitError = 
                                resultText.includes("错误：") || 
                                resultText.includes("Error:") ||
                                resultText.includes("is not recognized") ||
                                resultText.includes("can't open file") ||
                                resultText.includes("not found");
                            
                            if (hasExitCodeError || hasExplicitError) {
                                failedTools.push(resultText.split("\n")[0] || resultText);
                            }
                        }
                    }

                    if (failedTools.length > 0) {
                        return `拒绝更新：检测到在该步骤运行期间有工具执行失败（例如：${failedTools[0]}）。根据严格规范，您不能将有错误的步骤标记为 completed。请先将该步骤状态更新为 failed，然后查找原因、采取纠正措施，重新标记为 running 并执行该步骤，直到成功无错后方可标记为 completed。`;
                    }
                }
            }

            const item = todoManager.updateStatus(id, status);
            return `步骤 #${item!.id} "${item!.description}" → ${status}\n${todoManager.formatForPrompt()}`;
        },
    };
}