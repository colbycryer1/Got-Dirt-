// ContentView.swift — Got Dirt? iOS
// Root router: splash → login, or role-appropriate tab view.

import SwiftUI

struct ContentView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        Group {
            if auth.isLoading && !auth.isAuthenticated {
                SplashView()
            } else if !auth.isAuthenticated {
                LoginView()
            } else {
                RoleRootView()
            }
        }
        .task { await auth.checkSession() }
    }
}

private struct SplashView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Got Dirt?")
                .font(.system(size: 42, weight: .black))
                .foregroundStyle(.orange)
            ProgressView()
                .tint(.orange)
        }
    }
}

private struct RoleRootView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        switch auth.currentUser?.role {
        case "PIT_OWNER": PitOwnerTabView()
        case "ADMIN":     AdminTabView()
        default:          BuyerTabView()
        }
    }
}

// MARK: - Tab Views

struct BuyerTabView: View {
    var body: some View {
        TabView {
            NavigationStack { MapSearchView() }
                .tabItem { Label("Map",      systemImage: "map") }
            NavigationStack { OrderHistoryView() }
                .tabItem { Label("Orders",   systemImage: "list.clipboard") }
            NavigationStack { ProjectsView() }
                .tabItem { Label("Projects", systemImage: "folder") }
            NavigationStack { AccountView() }
                .tabItem { Label("Account",  systemImage: "person.circle") }
        }
        .tint(.orange)
    }
}

struct PitOwnerTabView: View {
    var body: some View {
        TabView {
            NavigationStack { PitOwnerDashboardView() }
                .tabItem { Label("Dashboard", systemImage: "chart.bar") }
            NavigationStack { MyPitsView() }
                .tabItem { Label("My Pits",   systemImage: "mappin.and.ellipse") }
            NavigationStack { OperatorView() }
                .tabItem { Label("Log Loads", systemImage: "truck.box") }
            NavigationStack { AccountView() }
                .tabItem { Label("Account",   systemImage: "person.circle") }
        }
        .tint(.orange)
    }
}

struct AdminTabView: View {
    var body: some View {
        TabView {
            NavigationStack { AdminDashboardView() }
                .tabItem { Label("Dashboard", systemImage: "chart.bar") }
            NavigationStack { MapSearchView() }
                .tabItem { Label("Map",       systemImage: "map") }
            NavigationStack { OperatorView() }
                .tabItem { Label("Log Loads", systemImage: "truck.box") }
            NavigationStack { AccountView() }
                .tabItem { Label("Account",   systemImage: "person.circle") }
        }
        .tint(.orange)
    }
}
