// GotDirtApp.swift — Got Dirt? iOS
// Entry point. Set Config.baseURL before building.

import SwiftUI

@main
struct GotDirtApp: App {
    @State private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authManager)
        }
    }
}
