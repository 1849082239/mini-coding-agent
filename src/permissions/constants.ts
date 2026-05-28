import { PermissionRule } from "./types";

/**
 * 默认权限规则
 *
 * 只读工具直接放行，写入/执行工具需要确认。
 * 这不是最安全的配置，但在教学和日常使用中找到了合理的平衡点。
 * 用户可以通过构造函数覆盖这些默认规则。
 */
export const DEFAULT_RULES: PermissionRule[] = [
  { tool: "search", level: "allow" },
  { tool: "glob", level: "allow" },
  { tool: "read_file", level: "allow" },
  { tool: "git_status", level: "allow" },
  { tool: "git_diff", level: "allow" },
  { tool: "create_todos", level: "allow" },
  { tool: "update_todo", level: "allow" },
  { tool: "write_file", level: "ask" },
  { tool: "patch_file", level: "ask" },
  { tool: "run_command", level: "ask" },
];