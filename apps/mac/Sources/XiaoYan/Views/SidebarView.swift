import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var router: AppRouter

    var body: some View {
        List(AppRoute.allCases, selection: $router.selectedRoute) { route in
            Label(route.title, systemImage: route.icon)
                .tag(route)
                .padding(.vertical, 6)
                .font(.system(size: 14, weight: .medium, design: .rounded))
        }
        .listStyle(.sidebar)
        .navigationTitle("小妍")
        .frame(minWidth: 200, idealWidth: 240, maxWidth: 300)
    }
}
