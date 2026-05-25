// AccountView.swift — Got Dirt? iOS

import SwiftUI

struct AccountView: View {
    @Environment(AuthManager.self) private var auth
    @State private var showSignOutConfirm = false

    private var roleLabel: String {
        switch auth.currentUser?.role {
        case "PIT_OWNER":  return "Pit Owner"
        case "BUYER":      return "Buyer"
        case "CARRIER":    return "3PL / Carrier"
        case "DRIVER":     return "Truck Driver"
        case "CONTRACTOR": return "Contractor"
        case "ADMIN":      return "Administrator"
        default:           return auth.currentUser?.role ?? "—"
        }
    }

    var body: some View {
        List {
            // Profile
            Section {
                HStack(spacing: 16) {
                    Circle()
                        .fill(Color.orange.opacity(0.15))
                        .overlay(Text(initials).font(.title2).fontWeight(.bold).foregroundStyle(.orange))
                        .frame(width: 60, height: 60)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(auth.currentUser?.name ?? "—").fontWeight(.semibold)
                        Text(auth.currentUser?.email ?? "—").font(.caption).foregroundStyle(.secondary)
                        Text(roleLabel)
                            .font(.caption).fontWeight(.semibold)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Color.orange.opacity(0.12))
                            .foregroundStyle(.orange)
                            .clipShape(Capsule())
                    }
                }
                .padding(.vertical, 6)
                if let company = auth.currentUser?.company {
                    LabeledContent("Company", value: company)
                }
            }

            // Web links
            Section("Web Dashboard") {
                WebLink(title: "Full Dashboard", path: "/dashboard", icon: "house")
                WebLink(title: "Billing & Payment", path: "/dashboard/buyer/billing", icon: "creditcard")
                WebLink(title: "Order History",    path: "/dashboard/buyer/orders",  icon: "list.clipboard")
                WebLink(title: "Invoices",         path: "/dashboard/buyer/invoices", icon: "doc.text")
            }

            // App info
            Section("App") {
                LabeledContent("Server", value: Config.baseURL)
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
            }

            // Sign out
            Section {
                Button(role: .destructive) {
                    showSignOutConfirm = true
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Account")
        .confirmationDialog("Sign out of Got Dirt?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) { auth.signOut() }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var initials: String {
        guard let name = auth.currentUser?.name else { return "?" }
        let parts = name.split(separator: " ")
        return parts.prefix(2).compactMap { $0.first }.map(String.init).joined()
    }
}

private struct WebLink: View {
    let title: String; let path: String; let icon: String
    var body: some View {
        if let url = URL(string: Config.baseURL + path) {
            Link(destination: url) {
                Label(title, systemImage: icon).foregroundStyle(.primary)
            }
        }
    }
}
