import { Palette, Metrics } from '../../shared/theme';
import { NmCard } from '../../components/NmCard';
import { NmButton } from '../../components/NmButton';
import { NmInput } from '../../components/NmInput';
import { Badge, BadgeVariant } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { SourceLookupItem, SourceLookupSection } from '../../model/types';
import { LookupOutcome, runSourceLookup, pickSection, joinMeta } from './sourceLookupLogic';

/**
 * 刊会查询面板 — 对齐桌面端 SourceLookupPanel.tsx。
 * 已端到端打通 Rust 原生后端（CCF + 期刊分区）。
 */
@Component
export struct SourceLookupPanel {
  @State query: string = '';
  @State sections: SourceLookupSection[] = [];
  @State loading: boolean = false;
  @State error: string = '';
  @State searched: boolean = false;

  async submit(): Promise<void> {
    if (this.query.trim().length === 0 || this.loading) {
      return;
    }
    this.loading = true;
    this.searched = true;
    this.error = '';
    const outcome: LookupOutcome = await runSourceLookup(this.query, 10);
    this.sections = outcome.sections;
    this.error = outcome.error;
    this.loading = false;
  }

  @Builder
  itemCard(item: SourceLookupItem) {
    NmCard({ padding: Metrics.gapMd }) {
      Column({ space: Metrics.gapSm }) {
        Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center }) {
          Text(item.name)
            .fontSize(14)
            .fontWeight(FontWeight.Semibold)
            .fontColor(Palette.textPrimary)
            .margin({ right: Metrics.gapSm })
          ForEach(item.indexes, (idx: string) => {
            Badge({ text: idx, variant: BadgeVariant.Info })
          })
          if (item.jcr_quartile !== null) {
            Badge({ text: 'JCR ' + item.jcr_quartile, variant: BadgeVariant.Info })
          }
          if (item.cas_quartile !== null) {
            Badge({ text: '中科院 ' + item.cas_quartile, variant: BadgeVariant.Neutral })
          }
          if (item.rating !== null) {
            Badge({ text: 'CCF ' + item.rating, variant: BadgeVariant.Success })
          }
          if (item.cas_top === true) {
            Badge({ text: 'Top', variant: BadgeVariant.Danger })
          }
          if (item.open_access === true) {
            Badge({ text: 'OA', variant: BadgeVariant.Success })
          }
        }
        .width('100%')

        if (joinMeta([item.publisher, item.issn !== null ? 'ISSN ' + item.issn : null,
          item.eissn !== null ? 'eISSN ' + item.eissn : null]).length > 0) {
          Text(joinMeta([item.publisher, item.issn !== null ? 'ISSN ' + item.issn : null,
            item.eissn !== null ? 'eISSN ' + item.eissn : null]))
            .fontSize(12)
            .fontColor(Palette.textSecondary)
            .lineHeight(18)
        }
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  @Builder
  sectionBlock(section: SourceLookupSection | null, accent: BadgeVariant, caption: string) {
    if (section !== null && section.items.length > 0) {
      Column({ space: Metrics.gapSm }) {
        Row({ space: Metrics.gapSm }) {
          Badge({ text: section.title, variant: accent })
          Text(caption)
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor(Palette.textPrimary)
        }
        .alignItems(VerticalAlign.Center)
        ForEach(section.items, (item: SourceLookupItem, index: number) => {
          this.itemCard(item)
        })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }

  build() {
    Column({ space: Metrics.gapMd }) {
      NmCard({ padding: Metrics.gapMd }) {
        Column({ space: Metrics.gapMd }) {
          Row({ space: Metrics.gapSm }) {
            SymbolGlyph($r('sys.symbol.magnifyingglass'))
              .fontSize(20)
              .fontColor([Palette.accent])
            Column({ space: 2 }) {
              Text('刊会查询')
                .fontSize(14)
                .fontWeight(FontWeight.Semibold)
                .fontColor(Palette.textPrimary)
              Text('输入期刊或会议名称，查 CCF 等级、SCI 分区与影响因子。')
                .fontSize(12)
                .fontColor(Palette.textMuted)
            }
            .alignItems(HorizontalAlign.Start)
          }
          .alignItems(VerticalAlign.Center)

          Row({ space: Metrics.gapSm }) {
            Column() {
              NmInput({
                text: this.query,
                placeholder: '请输入会议、期刊名称或 ISSN',
                onTextChange: (value: string) => { this.query = value; },
                onSubmit: () => { this.submit(); },
              })
            }
            .layoutWeight(1)
            NmButton({
              label: '查询',
              loading: this.loading,
              disabled: this.query.trim().length === 0,
              onTap: () => { this.submit(); },
            })
          }
          .width('100%')

          if (this.error.length > 0) {
            Row({ space: Metrics.gapXs }) {
              SymbolGlyph($r('sys.symbol.exclamationmark_circle'))
                .fontSize(16)
                .fontColor([Palette.danger])
              Text(this.error)
                .fontSize(13)
                .fontColor(Palette.danger)
                .layoutWeight(1)
            }
            .width('100%')
            .padding(Metrics.gapSm)
            .backgroundColor('rgba(255,59,48,0.1)')
            .borderRadius(Metrics.radiusSm)
          }
        }
        .alignItems(HorizontalAlign.Start)
      }

      this.sectionBlock(pickSection(this.sections, 'journal_partition'), BadgeVariant.Info, 'WoS / JCR / 中科院')
      this.sectionBlock(pickSection(this.sections, 'ccf'), BadgeVariant.Success, 'CCF 评级')

      if (this.searched && !this.loading && this.error.length === 0 && this.sections.length === 0) {
        EmptyState({
          symbol: $r('sys.symbol.doc_text_magnifyingglass'),
          title: '未找到匹配的刊物',
          description: '换个关键词或检查拼写后再试。',
        })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
