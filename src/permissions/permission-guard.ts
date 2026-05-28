import { PermissionRule, AuditEntry, ConfirmationCallback } from "./types";
import { DEFAULT_RULES } from "./constants";

/**
 * 权限守卫
 *
 * 每次 runAgent 调用创建一个新实例。
 * 负责三件事：
 * 1. 根据规则判断工具调用的权限级别
 * 2. 对 "ask" 级别调用确认回调
 * 3. 记录所有权限决策到审计日志
 */
export class PermissionGuard {
  private rules: PermissionRule[];
  private auditLog: AuditEntry[] = [];
  private confirmCallback: ConfirmationCallback;

  constructor(options: {
    rules?: PermissionRule[];
    confirm: ConfirmationCallback;
  }) {
    this.rules = options.rules ?? DEFAULT_RULES;
    this.confirmCallback = options.confirm;
  }

  async check(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<{ approved: boolean; reason: string }> {
    // 寻找匹配的权限规则，如果没有匹配的规则，默认使用通配符规则或 "ask"
    let rule = this.rules.find((r) => r.tool === tool);
    if (!rule) {
      rule = this.rules.find((r) => r.tool === "*");
    }

    const level = rule ? rule.level : "ask";
    let approved = false;
    let reason = "";

    switch (level) {
      case "allow":
        approved = true;
        reason = "规则配置为自动允许";
        break;
      case "deny":
        approved = false;
        reason = "规则配置为直接拒绝";
        break;
      case "ask":
      default:
        reason = "需要用户授权";
        approved = await this.confirmCallback(tool, args, reason);
        break;
    }

    // 记录到审计日志
    this.auditLog.push({
      tool,
      args,
      level,
      approved,
      reason,
    });

    return { approved, reason };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
