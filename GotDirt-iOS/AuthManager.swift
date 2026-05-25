// AuthManager.swift — Got Dirt? iOS
// Observable auth state. Token persisted in UserDefaults.

import Foundation
import Observation

private let tokenKey = "gotdirt.jwt"

@Observable
@MainActor
final class AuthManager {
    var currentUser: MobileUser?
    var token: String?
    var isLoading = false
    var isAuthenticated: Bool { token != nil && currentUser != nil }

    init() {
        token = UserDefaults.standard.string(forKey: tokenKey)
    }

    func checkSession() async {
        guard let t = token else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            currentUser = try await APIClient.shared.getMe(token: t)
        } catch {
            token = nil
            currentUser = nil
            UserDefaults.standard.removeObject(forKey: tokenKey)
        }
    }

    func signIn(email: String, password: String) async throws {
        isLoading = true
        defer { isLoading = false }
        let resp = try await APIClient.shared.login(email: email, password: password)
        token = resp.token
        currentUser = resp.user
        UserDefaults.standard.set(resp.token, forKey: tokenKey)
    }

    func register(email: String, password: String, name: String, role: String, company: String?) async throws {
        isLoading = true
        defer { isLoading = false }
        let resp = try await APIClient.shared.register(email: email, password: password, name: name, role: role, company: company)
        token = resp.token
        currentUser = resp.user
        UserDefaults.standard.set(resp.token, forKey: tokenKey)
    }

    func signOut() {
        token = nil
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
}
