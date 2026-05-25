// MyPitsView.swift — Got Dirt? iOS
// Shows pit owner's pits with Borrow and Dump rates labeled separately.

import SwiftUI

struct MyPitsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var pits: [Pit] = []
    @State private var loading = true
    @State private var error: String?
    @State private var togglingId: String?
    @State private var toggleError: String?

    var body: some View {
        Group {
            if loading {
                ProgressView().tint(.orange)
            } else if let error {
                ContentUnavailableView(error, systemImage: "exclamationmark.triangle")
            } else if pits.isEmpty {
                ContentUnavailableView {
                    Label("No Pits Listed", systemImage: "mappin.slash")
                } description: {
                    Text("Add pits via the web dashboard at \(Config.baseURL)")
                }
            } else {
                List(pits) { pit in
                    PitOwnerRow(
                        pit:         pit,
                        isToggling:  togglingId == pit.id,
                        toggleError: togglingId == pit.id ? toggleError : nil,
                        onToggle:    { await toggleAccepting(pit: pit) }
                    )
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("My Pits")
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        guard let token = auth.token else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            pits = try await APIClient.shared.getMyPits(token: token)
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }

    private func toggleAccepting(pit: Pit) async {
        guard let token = auth.token else { return }
        togglingId = pit.id; toggleError = nil
        defer { togglingId = nil }
        do {
            try await APIClient.shared.toggleAccepting(pitId: pit.id, accepting: !pit.accepting, token: token)
            await load()
        } catch let e as APIError { toggleError = e.localizedDescription }
        catch { toggleError = error.localizedDescription }
    }
}

private struct PitOwnerRow: View {
    let pit: Pit
    let isToggling: Bool
    let toggleError: String?
    let onToggle: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pit.name).fontWeight(.semibold)
                    Text("\(pit.pitTypeLabel) · \(pit.state)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if isToggling {
                    ProgressView().tint(.orange)
                } else {
                    Toggle("", isOn: Binding(get: { pit.accepting }, set: { _ in Task { await onToggle() } }))
                        .tint(.green)
                        .labelsHidden()
                }
            }

            // Rate badges — Borrow and Dump displayed separately
            HStack(spacing: 8) {
                if let r = pit.borrowRateCents {
                    RateBadge(label: "Borrow", amount: r, color: .blue)
                }
                if let r = pit.dumpRateCents {
                    RateBadge(label: "Dump", amount: r, color: .orange)
                }
                if pit.hasTopsoil, let r = pit.topsoilRateCents {
                    RateBadge(label: "Topsoil", amount: r, color: .brown)
                }
                if pit.borrowRateCents == nil && pit.dumpRateCents == nil {
                    Label("No rates set", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption).fontWeight(.semibold)
                        .foregroundStyle(.red)
                }
            }

            // Materials
            if !pit.materialTypes.isEmpty {
                Text(pit.materialTypes.joined(separator: " · "))
                    .font(.caption2).foregroundStyle(.tertiary)
                    .lineLimit(2)
            }

            if let err = toggleError {
                Text(err).font(.caption).foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct RateBadge: View {
    let label: String
    let amount: Int
    let color: Color
    var body: some View {
        Text("\(label)  \(amount.centsToDisplay)/load")
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(color.opacity(0.12))
            .foregroundStyle(color)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.3), lineWidth: 1))
    }
}
