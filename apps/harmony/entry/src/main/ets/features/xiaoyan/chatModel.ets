/** 对话消息模型与纯函数。 */
export enum ChatRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** 追加消息返回新数组（保持 @State 不可变更新，触发刷新）。 */
export function appendMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return list.concat([message]);
}
