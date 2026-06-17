import { Palette, Metrics } from '../../shared/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NmCard } from '../../components/NmCard';
import { NmButton } from '../../components/NmButton';
import { NmInput } from '../../components/NmInput';
import { XiaoyanBridge, formatErrorMessage } from '../../bridge/XiaoyanBridge';
import { ChatMessage, ChatRole, appendMessage } from './chatModel';

/**
 * 小妍协同（对话）页 — 完整 UI 交互骨架。
 * 演示桥接调用模式：发送消息 → 调 XiaoyanBridge.invoke('chat_stream') →
 * 当前后端未桥接，捕获错误并以系统消息优雅提示，UI 不崩。
 * 后端流式接通后，把 invoke 换成原生 SSE 事件订阅即可。
 */
@Component
export struct XiaoyanPage {
  @State messages: ChatMessage[] = [
    { role: ChatRole.System, text: '小妍多 Agent 协同。后端流式对话接通后即可在此处提问。' },
  ];
  @State draft: string = '';
  @State sending: boolean = false;

  async send(): Promise<void> {
    const text: string = this.draft.trim();
    if (text.length === 0 || this.sending) {
      return;
    }
    this.messages = appendMessage(this.messages, { role: ChatRole.User, text });
    this.draft = '';
    this.sending = true;
    try {
      const reply: string = await XiaoyanBridge.invoke<string>('chat_stream', { message: text });
      this.messages = appendMessage(this.messages, { role: ChatRole.Assistant, text: reply });
    } catch (err) {
      this.messages = appendMessage(this.messages, {
        role: ChatRole.System,
        text: formatErrorMessage(err as Object),
      });
    } finally {
      this.sending = false;
    }
  }

  bubbleColor(role: ChatRole): string {
    if (role === ChatRole.User) {
      return Palette.accentLight;
    }
    if (role === ChatRole.System) {
      return 'rgba(255,149,0,0.10)';
    }
    return Palette.bgCard;
  }

  @Builder
  bubble(msg: ChatMessage) {
    Row() {
      Text(msg.text)
        .fontSize(13)
        .fontColor(msg.role === ChatRole.System ? Palette.warning : Palette.textPrimary)
        .lineHeight(20)
        .padding(Metrics.gapSm)
        .backgroundColor(this.bubbleColor(msg.role))
        .borderRadius(Metrics.radiusSm)
        .constraintSize({ maxWidth: '80%' })
    }
    .width('100%')
    .justifyContent(msg.role === ChatRole.User ? FlexAlign.End : FlexAlign.Start)
  }

  build() {
    Column({ space: Metrics.gapMd }) {
      ScreenHeader({ title: '小妍协同', subtitle: '多 Agent 编排对话工作台' })

      List({ space: Metrics.gapSm }) {
        ForEach(this.messages, (msg: ChatMessage, index: number) => {
          ListItem() {
            this.bubble(msg)
          }
        })
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Auto)

      NmCard({ padding: Metrics.gapSm }) {
        Row({ space: Metrics.gapSm }) {
          Column() {
            NmInput({
              text: this.draft,
              placeholder: '向小妍提问…',
              onTextChange: (value: string) => { this.draft = value; },
              onSubmit: () => { this.send(); },
            })
          }
          .layoutWeight(1)
          NmButton({
            label: '发送',
            loading: this.sending,
            disabled: this.draft.trim().length === 0,
            onTap: () => { this.send(); },
          })
        }
        .width('100%')
      }
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(Metrics.pagePadding)
  }
}
