// src/permissions/index.ts

/**
 * 危险命令模式
 *
 * 这些命令一旦执行可能造成不可逆的损害：
 * - rm -rf: 递归强制删除
 * - git push --force: 强制推送覆盖远端
 * - git reset --hard: 丢弃所有本地修改
 * - sudo: 提权执行
 * - curl | sh: 从网络下载并执行脚本
 *
 * 匹配到这些模式时直接拒绝，不进入 "ask" 流程。
 * 注意：这个列表不是完整的，实际产品需要更严格的检测。
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*[rf]\w*|--recursive|--force)/,
  /\brmdir\b.*\s--recursive/,
  /\bgit\s+push\b.*(--force|-f)\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\b/,
  /\bsudo\b/,
  /\bcurl\b.*\|\s*(ba)?sh\b/,
  /\bwget\b.*\|\s*(ba)?sh\b/,
  /\bdd\s+\b/,
  /\bchmod\s+(-R\s+)?0?777\b/,
];

/** 检测命令是否匹配危险模式 */
export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}