import type { Tool, TodoStatus } from "../types";
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
                    description: "步骤 ID（创建时分配的编号）",
                },
                status: {
                    type: "string",
                    description: "新状态：running、completed 或 failed",
                },
            },
            required: ["id", "status"],
        },

        async execute(args: Record<string, unknown>): Promise<string> {
            const id = String(args.id);
            const status = String(args.status) as TodoStatus;

            if (!VALID_STATUSES.includes(status)) {
                return `错误：无效状态 "${status}"，可选值: ${VALID_STATUSES.join(", ")}`;
            }
            const item = todoManager.updateStatus(id, status);
            if (!item) {
                return `错误：未找到 ID 为 "${id}" 的步骤。`;
            }
            return `步骤 #${item.id} "${item.description}" → ${status}\n${todoManager.formatForPrompt()}`;
        },
    };
}