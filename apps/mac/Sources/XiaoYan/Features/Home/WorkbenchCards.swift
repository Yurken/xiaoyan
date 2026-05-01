import SwiftUI

struct WorkbenchMetricCard: View {
    let metric: WorkbenchMetric

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(metric.label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(metric.value)
                .font(.system(.title2, design: .rounded).weight(.bold).monospacedDigit())
            Text(metric.note)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}

struct WorkbenchSummaryCard: View {
    let item: WorkbenchSummaryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title)
                .font(.subheadline.bold())
            Text(item.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}

struct WorkbenchAgendaCard: View {
    let item: WorkbenchAgendaItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.label)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(item.tone.backgroundColor)
                        .foregroundColor(item.tone.badgeColor)
                        .cornerRadius(4)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        }
        .buttonStyle(.plain)
    }
}

struct WorkbenchHandoffCard: View {
    let item: WorkbenchHandoffItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.label)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(item.tone.backgroundColor)
                        .foregroundColor(item.tone.badgeColor)
                        .cornerRadius(4)
                    Spacer()
                }
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        }
        .buttonStyle(.plain)
    }
}

struct WorkbenchInterestCard: View {
    let item: WorkbenchInterestItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.title)
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    Spacer()
                    Text(item.stage)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(item.stageTone.backgroundColor)
                        .foregroundColor(item.stageTone.badgeColor)
                        .cornerRadius(4)
                }

                Text(item.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack(spacing: 6) {
                    ForEach(item.stats, id: \.self) { stat in
                        Text(stat)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(4)
                    }
                    Spacer()
                }

                HStack {
                    Spacer()
                    Text(item.nextStep)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        }
        .buttonStyle(.plain)
    }
}

struct WorkbenchRiskCard: View {
    let item: WorkbenchRiskItem
    let router: AppRouter

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.label)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(item.tone.backgroundColor)
                    .foregroundColor(item.tone.badgeColor)
                    .cornerRadius(4)
                Spacer()
            }
            Text(item.title)
                .font(.subheadline.bold())
                .lineLimit(1)
            Text(item.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(Theme.Spacing.md)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}

struct WorkbenchAssetCard: View {
    let item: WorkbenchAssetItem
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = item.action.route }) {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.label)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        }
        .buttonStyle(.plain)
    }
}
