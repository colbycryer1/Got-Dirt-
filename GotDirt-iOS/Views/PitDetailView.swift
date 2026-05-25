// PitDetailView.swift — Got Dirt? iOS

import SwiftUI

struct PitDetailView: View {
    let pitId: String
    @Environment(AuthManager.self) private var auth
    @State private var pit: Pit?
    @State private var loading = true
    @State private var error: String?
    @State private var showOrder = false

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView().tint(.orange)
                } else if let error {
                    ContentUnavailableView(error, systemImage: "exclamationmark.triangle")
                } else if let pit {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            // Header
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(pit.pitTypeLabel)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .padding(.horizontal, 10).padding(.vertical, 4)
                                        .background(Color.orange.opacity(0.15))
                                        .foregroundStyle(.orange)
                                        .clipShape(Capsule())
                                    Spacer()
                                    StatusBadge(accepting: pit.accepting)
                                }
                                Text(pit.name)
                                    .font(.title2).fontWeight(.bold)
                                if let addr = pit.address {
                                    Text("\(addr), \(pit.state)")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                } else {
                                    Text(pit.state).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }

                            // Rates
                            if pit.borrowRateCents != nil || pit.dumpRateCents != nil {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Rates").font(.headline)
                                    HStack(spacing: 12) {
                                        if let r = pit.borrowRateCents {
                                            RateCard(label: "Pickup / Borrow", amount: r, color: .blue)
                                        }
                                        if let r = pit.dumpRateCents {
                                            RateCard(label: "Drop-off / Dump", amount: r, color: .orange)
                                        }
                                        if pit.hasTopsoil, let r = pit.topsoilRateCents {
                                            RateCard(label: "Topsoil", amount: r, color: .brown)
                                        }
                                    }
                                }
                            }

                            // Materials
                            if !pit.materialTypes.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Materials Available").font(.headline)
                                    FlowLayout(spacing: 8) {
                                        ForEach(pit.materialTypes, id: \.self) { mat in
                                            Text(mat)
                                                .font(.caption).fontWeight(.medium)
                                                .padding(.horizontal, 10).padding(.vertical, 5)
                                                .background(Color(.systemGray5))
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }

                            // Services
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Services").font(.headline)
                                if pit.operatorProvided  { ServiceRow(text: "Operator provided") }
                                if pit.equipmentProvided { ServiceRow(text: "Equipment on site") }
                                if let note = pit.equipmentNotes { ServiceRow(text: note) }
                                if !pit.operatorProvided && !pit.equipmentProvided {
                                    Text("Bring your own operator & equipment").font(.subheadline).foregroundStyle(.secondary)
                                }
                            }

                            // Contact
                            if pit.contactName != nil || pit.contactPhone != nil {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Contact").font(.headline)
                                    if let n = pit.contactName  { Text(n).font(.subheadline) }
                                    if let p = pit.contactPhone {
                                        Link(p, destination: URL(string: "tel:\(p)")!)
                                            .font(.subheadline).foregroundStyle(.orange)
                                    }
                                }
                            }

                            // Notes
                            if let notes = pit.notes {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Notes").font(.headline)
                                    Text(notes).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }

                            // Place order
                            let role = auth.currentUser?.role ?? ""
                            let isBuyer = ["BUYER", "CARRIER", "CONTRACTOR"].contains(role)
                            if isBuyer && pit.accepting {
                                Button {
                                    showOrder = true
                                } label: {
                                    Text("Place Order →")
                                        .fontWeight(.semibold)
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(Color.orange)
                                        .foregroundStyle(.white)
                                        .clipShape(RoundedRectangle(cornerRadius: 14))
                                }
                                .padding(.top, 8)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle(pit?.name ?? "Pit Details")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showOrder) {
                if let pit { OrderPlacementView(pit: pit) }
            }
        }
        .task { await loadPit() }
    }

    private func loadPit() async {
        guard let token = auth.token else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            pit = try await APIClient.shared.getPit(id: pitId, token: token)
        } catch let e as APIError {
            error = e.localizedDescription
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Subviews

private struct StatusBadge: View {
    let accepting: Bool
    var body: some View {
        Text(accepting ? "Accepting" : "Not Accepting")
            .font(.caption).fontWeight(.semibold)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(accepting ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
            .foregroundStyle(accepting ? .green : .red)
            .clipShape(Capsule())
    }
}

private struct RateCard: View {
    let label: String
    let amount: Int
    let color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(amount.centsToDisplay + "/load")
                .font(.subheadline).fontWeight(.bold).foregroundStyle(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct ServiceRow: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
            Text(text).font(.subheadline)
        }
    }
}

// MARK: - FlowLayout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var x: CGFloat = 0; var y: CGFloat = 0; var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX; var y = bounds.minY; var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
    }
}
