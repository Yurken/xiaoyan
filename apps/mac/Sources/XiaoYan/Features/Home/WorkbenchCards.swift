import SwiftUI

// MARK: - Tone Badge (pill-shape, extracted from repeated code)

struct ToneBadge: View {
    let label: String
    let tone: WorkbenchTone

    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(tone.backgroundColor)
            .foregroundColor(tone.badgeColor)
            .clipShape(Capsule())
    }
}

// MARK: - Hoverable Card Modifier

private struct HoverLift: ViewModifier {
    @State private var isHovered = false

    func body(content: Content) -> some View {
        content
            .offset(y: isHovered ? -1 : 0)
            .animation(.easeInOut(duration: 0.18), value: isHovered)
            .onHover { isHovered = $0 }
    }
}

extension View {
    func hoverLift() -> some View {
        modifier(HoverLift())
    }
}

// MARK: - Metric Card

struct WorkbenchMetricCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let metric: WorkbenchMetric

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(metric.label)
                .font(Theme.Typography.caption)
                .foregroundStyle(colorTokens.textMuted)
            Text(metric.value)
                .font(Theme.Typography.metricValue)
                .foregroundStyle(colorTokens.text)
            Text(metric.note)
                .font(Theme.Typography.caption2)
                .foregroundStyle(colorTokens.textMuted)
                .lineLimit(1)
        }
        .padding()
        .background(colorTokens.cardInsetBg)
        .cornerRadius(Theme.Radii.subCard)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
        )
        .cardShadow(isDark: colorTokens.cardShadowDark != Color(hex: "CBD0D7"))
    }
}

// MARK: - Summary Card

struct WorkbenchSummaryCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let item: WorkbenchSummaryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .font(Theme.Typography.subheadline)
                .foregroundStyle(colorTokens.text)
            Text(item.description)
                .font(Theme.Typography.caption)
                .foregroundStyle(colorTokens.textSoft)
                .lineLimit(3)
        }
        .padding()
        .background(colorTokens.cardInsetBg)
        .cornerRadius(Theme.Radii.subCard)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - List Action Card (unified Agenda + Handoff)

struct ListActionCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let label: String
    let title: String
    let description: String
    let tone: WorkbenchTone
    let actionLabel: String
    let actionRoute: AppRoute
    let router: AppRouter
    var showArrow: Bool = false

    var body: some View {
        Button(action: { router.selectedRoute = actionRoute }) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    ToneBadge(label: label, tone: tone)
                    Spacer()
                    if showArrow {
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .foregroundStyle(colorTokens.textMuted)
                    }
                }
                Text(title)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(colorTokens.text)
                    .lineLimit(1)
                Text(description)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(colorTokens.textSoft)
                    .lineLimit(2)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(colorTokens.cardInsetBg)
            .cornerRadius(Theme.Radii.subCard)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                    .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .hoverLift()
    }
}

// MARK: - Interest Card

struct WorkbenchInterestCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let item: WorkbenchInterestItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.title)
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(colorTokens.text)
                        .lineLimit(1)
                    Spacer()
                    ToneBadge(label: item.stage, tone: item.stageTone)
                }

                Text(item.summary)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(colorTokens.textSoft)
                    .lineLimit(2)

                HStack(spacing: 6) {
                    ForEach(item.stats, id: \.self) { stat in
                        Text(stat)
                            .font(Theme.Typography.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colorTokens.elevated.opacity(0.5))
                            .foregroundStyle(colorTokens.textMuted)
                            .cornerRadius(Theme.Radii.tiny)
                    }
                    Spacer()
                }

                HStack {
                    Spacer()
                    Text(item.nextStep)
                        .font(Theme.Typography.caption2)
                        .foregroundStyle(colorTokens.textMuted)
                        .lineLimit(1)
                }
            }
            .padding(Theme.Spacing.md)
            .background(colorTokens.cardInsetBg)
            .cornerRadius(Theme.Radii.subCard)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                    .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .hoverLift()
    }
}

// MARK: - Risk Card

struct WorkbenchRiskCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let item: WorkbenchRiskItem
    let router: AppRouter

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                ToneBadge(label: item.label, tone: item.tone)
                Spacer()
            }
            Text(item.title)
                .font(Theme.Typography.subheadline)
                .foregroundStyle(colorTokens.text)
                .lineLimit(1)
            Text(item.description)
                .font(Theme.Typography.caption)
                .foregroundStyle(colorTokens.textSoft)
                .lineLimit(2)
        }
        .padding(Theme.Spacing.md)
        .background(colorTokens.cardInsetBg)
        .cornerRadius(Theme.Radii.subCard)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Asset Card

struct WorkbenchAssetCard: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let item: WorkbenchAssetItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.label)
                    .font(Theme.Typography.caption2)
                    .foregroundStyle(colorTokens.textMuted)
                    .textCase(.uppercase)
                Text(item.title)
                    .font(Theme.Typography.subheadline)
                    .foregroundStyle(colorTokens.text)
                    .lineLimit(1)
                Text(item.description)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(colorTokens.textSoft)
                    .lineLimit(2)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(colorTokens.cardInsetBg)
            .cornerRadius(Theme.Radii.subCard)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.subCard, style: .continuous)
                    .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .hoverLift()
    }
}
