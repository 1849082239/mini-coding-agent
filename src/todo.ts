import type { TodoItem, TodoStatus } from "./types";
export class TodoManager {
    private items: TodoItem[] = [];
    private nextId = 1;
    /** 批量创建步骤，全部初始化为 pending */
    createItems(descriptions: string[]): TodoItem[] {
        const newItems = descriptions.map((desc) => ({
            id: String(this.nextId++),
            description: desc,
            status: "pending" as const,
        }));
        this.items.push(...newItems);
        return [...newItems];
    }
    /** 更新指定步骤的状态 */
    updateStatus(id: string, status: TodoStatus): TodoItem | undefined {
        const item = this.items.find((t) => t.id === id);
        if (!item) return undefined;
        item.status = status;
        return { ...item };
    }
    getAll(): readonly TodoItem[] {
        return [...this.items];
    }
    /** 判断是否所有步骤都已完成 */
    allCompleted(): boolean {
        return (
            this.items.length > 0 &&
            this.items.every((t) => t.status === "completed")
        );
    }
    /** 格式化为可读文本，作为工具返回值或系统提示的一部分 */
    formatForPrompt(): string {
        if (this.items.length === 0) return "当前没有执行计划。";
        const labels: Record<TodoStatus, string> = {
            pending: "[ ]",
            running: "[>]",
            completed: "[x]",
            failed: "[!]",
        };
        const lines = this.items.map(
            (t) => `  ${labels[t.status]} #${t.id} ${t.description}`,
        );
        return `执行计划:\n${lines.join("\n")}`;
    }
}