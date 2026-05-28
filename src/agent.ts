import { AgentState, AgentResult, Model, Tool, RunAgentOptions } from './types';

export async function runAgent(
  state: AgentState,
  model: Model,
  tools: Tool[],
  options?: RunAgentOptions,
): Promise<AgentResult> {
  // 初始化最大迭代次数，默认 15 次
  const maxIterations = options?.maxIterations ?? 15;
  let iteration = 0;
  
  // 克隆或初始化消息历史，避免污染外部状态
  const allMessages = [...(state.messages || [])];
  const stats = { toolCallCount: 0 };

  while (iteration < maxIterations) {
    iteration++;

    // 1. 调用大模型获取决策
    const response = await model.generate(allMessages, tools);

    // 如果模型没有触发工具调用，说明任务靠文本回复已完成，直接退出循环
    if (!response.toolCalls || response.toolCalls.length === 0) {
      allMessages.push({
        role: 'assistant',
        content: response.content,
      });
      return {
        status: 'success',
        messages: allMessages,
        stats,
      };
    }

    // 将 Assistant 的回复（包括文本/思考内容和工具调用）存入历史，以便模型记住之前的决策和工具调用
    allMessages.push({
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls,
    });

    // 2. 依次执行每个工具调用
    for (const toolCall of response.toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      
      if (!tool) {
        allMessages.push({
          role: 'tool_result',
          toolCallId: toolCall.id,
          result: `错误：未知工具 ${toolCall.name}`,
        });
        continue;
      }

      /**
       * 权限检查（第 4 章新增）
       * * 如果提供了 permissionGuard，在执行工具前检查权限：
       * - allow: 直接执行
       * - ask: 调用确认回调，由用户决定
       * - deny: 直接拒绝，不执行
       * * 如果没有提供 permissionGuard，所有调用自动放行（向后兼容第 1-3 章）。
       */
      if (options?.permissionGuard) {
        const { approved, reason } = await options.permissionGuard.check(
          toolCall.name,
          toolCall.arguments,
        );

        // 如果权限守卫拒绝了这次操作
        if (!approved) {
          allMessages.push({
            role: 'tool_result',
            toolCallId: toolCall.id,
            // 拒绝不是静默丢弃，而是把原因作为工具结果返回，让模型能感知并调整策略
            result: `操作被拒绝: ${reason}`,
          });
          continue; // 跳过当前工具的执行，继续处理下一个
        }
      }

      // 3. 权限通过，真正执行工具
      try {
        const result = await tool.execute(toolCall.arguments, state);
        stats.toolCallCount++;
        
        allMessages.push({
          role: 'tool_result',
          toolCallId: toolCall.id,
          result,
        });
      } catch (error: any) {
        // 捕获工具执行期的物理错误（如写文件失败、命令报错）
        allMessages.push({
          role: 'tool_result',
          toolCallId: toolCall.id,
          result: `工具执行异常: ${error.message || error}`,
        });
      }
    }
  }

  // 达到最大迭代次数依然没有结束，触发硬上限退出
  return {
    status: 'exhausted',
    messages: allMessages,
    stats,
    reason: `达到了最大迭代次数上限 (${maxIterations} 次)`,
  };
}