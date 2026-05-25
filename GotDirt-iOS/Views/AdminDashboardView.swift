// AdminDashboardView.swift — Got Dirt? iOS
// Admin overview with links to the full web dashboard.

import SwiftUI

struct AdminDashboardView: View {
    @Environment(AuthManager.self) private var auth

    private let sections = [
        ("Transactions",   "creditcard",       "/dashboard/admin/transactions"),
        ("All Pits",       "mappin.and.ellipse","/dashboard/admin/pits"),
        ("Users",          "person.3",          "/dashboard/admin/users"),
        ("Settlements",    "banknote",          "/dashboard/admin/settlements"),
        ("KYC / Compliance","checkmark.shield", "/dashboard/admin/kyc"),
        ("AML Flags",      "flag",              "/dashboard/admin/aml"),
        ("Settings",       "gearshape",         "/dashboard/admin/settings"),
    ]

    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Got Dirt? Admin")
                            .font(.title2).fontWeight(.black)
                        Text("Logged in as \(auth.currentUser?.email ?? "admin")")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "shield.fill")
                        .font(.largeTitle).foregroundStyle(.orange)
                }
                .padding(.vertical, 4)
            }

            Section("Admin Sections") {
                ForEach(sections, id: \.0) { title, icon, path in
                    if let url = URL(string: Config.baseURL + path) {
                        Link(destination: url) {
                            Label(title, systemImage: icon)
                                .foregroundStyle(.primary)
                        }
                    }
                }
            }

            Section("Tools") {
                Link(destination: URL(string: Config.baseURL + "/dashboard/admin")!) {
                    Label("Full Admin Dashboard", systemImage: "arrow.up.right.square")
                        .foregroundStyle(.orange)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Admin")
    }
}
