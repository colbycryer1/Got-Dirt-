// OrderHistoryView.swift — Got Dirt? iOS
// Shows all buyer orders with material breakdown, charge button, and close button.

import SwiftUI

struct OrderHistoryView: View {
    @Environment(AuthManager.self) private var auth
    @State private var orders: [Order] = []
    @State private var loading = true
    @State private var error: String?
    @State private var actionError: String?
    @State private var actionInProgress: String?   // orderId being acted on

    private var totalLoads:    Int { orders.reduce(0) { $0 + $1.totalLoads } }
    private var totalSpentCents: Int { orders.reduce(0) { $0 + $1.totalSpentCents } }

    var body: some View {
        Group {
            if loading {
                ProgressView().tint(.orange)
            } else if let error {
                ContentUnavailableView(error, systemImage: "exclamationmark.triangle")
            } else if orders.isEmpty {
                ContentUnavailableView {
                    Label("No Orders Yet", systemImage: "list.clipboard")
                } description: {
                    Text("Find a pit on the Map tab and place your first order.")
                }
            } else {
                List {
                    // Summary
                    Section {
                        HStack(spacing: 0) {
                            StatCell(label: "Orders", value: "\(orders.count)")
                            Divider()
                            StatCell(label: "Total Loads", value: "\(totalLoads)")
                            Divider()
                            StatCell(label: "Total Spent", value: totalSpentCents.centsToDisplay)
                        }
                    }

                    if let actionError {
                        Section { Text(actionError).foregroundStyle(.red).font(.caption) }
                    }

                    // Orders
                    Section("Orders") {
                        ForEach(orders) { order in
                            OrderRow(
                                order:             order,
                                actionInProgress:  actionInProgress,
                                onCharge:          { await charge(order) },
                                onClose:           { await close(order) }
                            )
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Order History")
        .refreshable { await loadOrders() }
        .task { await loadOrders() }
    }

    private func loadOrders() async {
        guard let token = auth.token else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            orders = try await APIClient.shared.getOrders(token: token)
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }

    private func charge(_ order: Order) async {
        guard let token = auth.token else { return }
        actionInProgress = order.id; actionError = nil
        defer { actionInProgress = nil }
        do {
            try await APIClient.shared.chargeOrder(id: order.id, token: token)
            await loadOrders()
        } catch let e as APIError { actionError = e.localizedDescription }
        catch { actionError = error.localizedDescription }
    }

    private func close(_ order: Order) async {
        guard let token = auth.token else { return }
        actionInProgress = order.id; actionError = nil
        defer { actionInProgress = nil }
        do {
            try await APIClient.shared.closeOrder(id: order.id, token: token)
            await loadOrders()
        } catch let e as APIError { actionError = e.localizedDescription }
        catch { actionError = error.localizedDescription }
    }
}

// MARK: - OrderRow

private struct OrderRow: View {
    let order: Order
    let actionInProgress: String?
    let onCharge: () async -> Void
    let onClose:  () async -> Void

    private var isActing: Bool { actionInProgress == order.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Top: pit name + badges
            HStack {
                Text(order.pit.name).fontWeight(.semibold)
                Spacer()
                Text(order.totalSpentCents.centsToDisplay)
                    .fontWeight(.bold)
            }

            HStack(spacing: 6) {
                StatusPill(text: order.status, color: statusColor(order.status))
                OrderTypePill(orderType: order.orderType)
                if order.hasUnchargedLoads { StatusPill(text: "Unpaid", color: .orange) }
            }

            // Project + date
            Text("\(order.project.name) · \(order.pit.state)")
                .font(.caption).foregroundStyle(.secondary)
            Text(order.displayDate)
                .font(.caption2).foregroundStyle(.tertiary)

            // Load count
            Text("\(order.totalLoads) load\(order.totalLoads == 1 ? "" : "s")")
                .font(.caption).foregroundStyle(.secondary)

            // Materials breakdown
            let mats = order.materialCounts
            if !mats.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(Array(mats), id: \.key) { mat, cnt in
                        Text("\(mat) × \(cnt)")
                            .font(.caption2).fontWeight(.medium)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color(.systemGray5))
                            .clipShape(Capsule())
                    }
                }
            }

            // Action buttons
            HStack(spacing: 8) {
                if order.hasUnchargedLoads {
                    Button {
                        Task { await onCharge() }
                    } label: {
                        Label(isActing ? "Charging…" : "Charge \(order.unchargedLoadCount) Loads", systemImage: "creditcard")
                            .font(.caption).fontWeight(.semibold)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.orange)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                    .disabled(isActing)
                }
                if order.status == "ACTIVE" {
                    Button {
                        Task { await onClose() }
                    } label: {
                        Label(isActing ? "Closing…" : "Close Order", systemImage: "checkmark.circle")
                            .font(.caption).fontWeight(.semibold)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color(.systemGray5))
                            .foregroundStyle(.primary)
                            .clipShape(Capsule())
                    }
                    .disabled(isActing)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "ACTIVE":    return .green
        case "COMPLETED": return .secondary
        case "CANCELLED": return .red
        default:          return .secondary
        }
    }
}

private struct StatusPill: View {
    let text: String; let color: Color
    var body: some View {
        Text(text)
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct OrderTypePill: View {
    let orderType: String
    var body: some View {
        let isDump = orderType == "DUMP"
        Text(isDump ? "Drop-off" : "Pickup")
            .font(.caption2).fontWeight(.semibold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((isDump ? Color.orange : Color.blue).opacity(0.15))
            .foregroundStyle(isDump ? .orange : .blue)
            .clipShape(Capsule())
    }
}

private struct StatCell: View {
    let label: String; let value: String
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title3).fontWeight(.black)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}
