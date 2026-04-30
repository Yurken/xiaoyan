import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var router: AppRouter

    var body: some View {
        List(AppRoute.allCases, selection: $router.selectedRoute) { route in
            Label(route.title, systemImage: route.icon)
                .tag(route)
        }
        .listStyle(.sidebar)
        .navigationTitle("小妍")
        .frame(minWidth: 200)
    }
}
