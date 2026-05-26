
import type { Tool } from "../types";
import type { TodoManager } from "../todo";
export function createTodosTool(todoManager: TodoManager): Tool {
    return {
        name: "create_todos",
        description:
            "创建执行计划，把任务拆分为多个步骤。" +
            "步骤会按顺序编号，初始状态为 pending。",
        parameters: {
            type: "object",
            properties: {
                items: {
                    type: "array",
                    items: { type: "string" },
                    description: "按执行顺序排列的步骤描述列表",
                },
            },
            required: ["items"],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            const descriptions = args.items as string[];
            if (!Array.isArray(descriptions) || descriptions.length === 0) {
                return "错误：必须提供至少一个步骤描述。";
            }
            if (todoManager.getAll().length > 0) {
                const hasStarted = todoManager.getAll().some((t) => t.status !== "pending");
                if (hasStarted) {
                    return `提示：执行计划已存在且已开始执行，不需要重复创建。请直接使用 \`update_todo\` 工具更新并推进现有步骤的状态。\n\n当前${todoManager.formatForPrompt()}`;
                }
                todoManager.clear();
            }
            const items = todoManager.createItems(descriptions);
            return `已创建 ${items.length} 个步骤:\n${todoManager.formatForPrompt()}`;
        },
    };
}