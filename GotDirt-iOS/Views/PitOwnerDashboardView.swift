// PitOwnerDashboardView.swift — Got Dirt? iOS

import SwiftUI

struct PitOwnerDashboardView: View {
    @Environment(AuthManager.self) private var auth
    @State private var pits: [Pit] = []
    @State private var loading = true

    private var activePits:     Int { pits.filter { $0.accepting }.count }
    private var inactivePits:   Int { pits.count - activePits }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Greeting
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Welcome back")
                            .font(.subheadline).foregroundStyle(.secondary)
                        Text(auth.currentUser?.name ?? auth.currentUser?.company ?? "Pit Owner")
                            .font(.title2).fontWeight(.bold)
                    }
                    Spacer()
                    Image(systemName: "mappin.and.ellipse")
                        .font(.largeTitle).foregroundStyle(.orange)
                }
                .padding(.horizontal)

                // Stats
                if !loading {
                    HStack(spacing: 12) {
                        DashStat(label: "Total Pits",    value: "\(pits.count)",   icon: "map.fill",    color: .orange)
                        DashStat(label: "Accepting",     value: "\(activePits)",   icon: "checkmark.circle.fill", color: .green)
                        DashStat(label: "Not Accepting", value: "\(inactivePits)", icon: "xmark.circle.fill",     color: .red)
                    }
                    .padding(.horizontal)
                }

                // My pits quick view
                VStack(alignment: .leading, spacing: 12) {
                    Text("My Pits")
                        .font(.headline).padding(.horizontal)

                    if loading {
                        HStack { ProgressView().tint(.orange); Spacer() }.padding(.horizontal)
                    } else if pits.isEmpty {
                        Text("No pits listed. Add pits via the web dashboard.")
                            .font(.subheadline).foregroundStyle(.secondary)
                            .padding(.horizontal)
                    } else {
                        ForEach(pits.prefix(3)) { pit in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(pit.name).fontWeight(.medium)
                                    Text(pit.pitTypeLabel)
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Circle()
                                    .fill(pit.accepting ? Color.green : Color.red)
                                    .frame(width: 10, height: 10)
                                Text(pit.accepting ? "Open" : "Closed")
                                    .font(.caption).fontWeight(.semibold)
                                    .foregroundStyle(pit.accepting ? .green : .red)
                            }
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .padding(.horizontal)
                        }
                        if pits.count > 3 {
                            Text("+ \(pits.count - 3) more — see My Pits tab")
                                .font(.caption).foregroundStyle(.secondary)
                                .padding(.horizontal)
                        }
                    }
                }

                // Quick links
                VStack(alignment: .leading, spacing: 12) {
                    Text("Quick Links").font(.headline).padding(.horizontal)
                    QuickLink(icon: "link", title: "Web Dashboard", subtitle: "Full controls at \(Config.baseURL)",
                              url: URL(string: "\(Config.baseURL)/dashboard/pit-owner")!)
                    QuickLink(icon: "chart.bar.xaxis", title: "Analytics", subtitle: "Revenue & load trends",
                              url: URL(string: "\(Config.baseURL)/dashboard/pit-owner/analytics")!)
                    QuickLink(icon: "banknote", title: "Payout History", subtitle: "Settlement records",
                              url: URL(string: "\(Config.baseURL)/dashboard/pit-owner/payout-history")!)
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Dashboard")
        .task { await loadPits() }
    }

    private func loadPits() async {
        guard let token = auth.token else { return }
        loading = true
        defer { loading = false }
        pits = (try? await APIClient.shared.getMyPits(token: token)) ?? []
    }
}

private struct DashStat: View {
    let label: String; let value: String; let icon: String; let color: Color
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.title2).foregroundStyle(color)
            Text(value).font(.title2).fontWeight(.black)
            Text(label).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct QuickLink: View {
    let icon: String; let title: String; let subtitle: String; let url: URL
    var body: some View {
        Link(destination: url) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title3).foregroundStyle(.orange)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).fontWeight(.medium).foregroundStyle(.primary)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.tertiary)
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }
}
