/** 权限级别 */
export type PermissionLevel = "allow" | "ask" | "deny";
/** 权限规则：指定某个工具的权限级别 */
export interface PermissionRule {
  /** 工具名称，支持 "*" 通配 */
  tool: string;
  /** 权限级别 */
  level: PermissionLevel;
}

/**
 * 用户确认回调
 *
 * 当权限级别为 "ask" 时，agent 调用此回调请求用户确认。
 * 返回 true 表示允许执行，false 表示拒绝。
 */
export type ConfirmationCallback = (
  tool: string,
  args: Record<string, unknown>,
  reason: string,
) => Promise<boolean>;

/** 审计日志条目 */
export interface AuditEntry {
  tool: string;
  args: Record<string, unknown>;
  level: PermissionLevel;
  approved: boolean;
  reason: string;
}