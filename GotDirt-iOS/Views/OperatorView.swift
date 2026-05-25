// OperatorView.swift — Got Dirt? iOS
// Pit operator load-tap screen. Mirrors the web operator page exactly:
// tap once to prime a material, tap again to confirm and log the load.

import SwiftUI

@Observable
@MainActor
private final class OperatorVM {
    var orders: [OperatorOrder] = []
    var selectedOrder: OperatorOrder?
    var loading = false
    var error: String?
    var pendingMaterial: String?
    var flashMaterial:  String?
    var lastLogged: (material: String, time: Date)?
    var canUndo = false
    var logging = false
    private var token: String = ""

    func setup(token: String) { self.token = token }

    func fetchOrders() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            let list = try await APIClient.shared.getOperatorOrders(token: token)
            orders = list
            if list.count == 1 && selectedOrder == nil { selectedOrder = list[0] }
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }

    func tap(material: String) async {
        guard !logging else { return }
        if pendingMaterial == material {
            pendingMaterial = nil
            await logLoad(material: material)
        } else {
            pendingMaterial = material
            Task {
                try? await Task.sleep(for: .seconds(4))
                if pendingMaterial == material { pendingMaterial = nil }
            }
        }
    }

    private func logLoad(material: String) async {
        guard let order = selectedOrder, !logging else { return }
        logging = true
        // Optimistic update
        selectedOrder = optimisticAdd(order: order, material: material)
        flashMaterial = material
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            flashMaterial = nil
        }
        do {
            try await APIClient.shared.logLoad(orderId: order.id, materialType: material, token: token)
            lastLogged = (material: material, time: Date())
            canUndo = true
            Task {
                try? await Task.sleep(for: .seconds(120))
                canUndo = false
            }
            await fetchOrders()
        } catch let e as APIError {
            selectedOrder = order   // revert
            self.error = e.localizedDescription
        } catch {
            selectedOrder = order
        }
        logging = false
    }

    func undoLoad() async {
        guard let order = selectedOrder, canUndo, !logging else { return }
        logging = true
        let snapshot = selectedOrder
        selectedOrder = optimisticRemoveLast(order: order)
        do {
            try await APIClient.shared.undoLoad(orderId: order.id, token: token)
            canUndo = false; lastLogged = nil
            await fetchOrders()
        } catch let e as APIError {
            selectedOrder = snapshot
            error = e.localizedDescription
        } catch {
            selectedOrder = snapshot
        }
        logging = false
    }

    private func optimisticAdd(order: OperatorOrder, material: String) -> OperatorOrder {
        let fake = LoadEvent(id: "opt-\(Date().timeIntervalSince1970)", materialType: material, rateCentsAtTime: 0, createdAt: Date().ISO8601Format())
        return OperatorOrder(id: order.id, date: order.date, orderType: order.orderType, buyer: order.buyer, pit: order.pit, loadEvents: order.loadEvents + [fake])
    }

    private func optimisticRemoveLast(order: OperatorOrder) -> OperatorOrder {
        OperatorOrder(id: order.id, date: order.date, orderType: order.orderType, buyer: order.buyer, pit: order.pit, loadEvents: Array(order.loadEvents.dropLast()))
    }
}

struct OperatorView: View {
    @Environment(AuthManager.self) private var auth
    @State private var vm = OperatorVM()

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()

            if vm.loading && vm.orders.isEmpty {
                ProgressView().tint(.orange)
            } else if vm.selectedOrder == nil {
                OrderSelectorView(orders: vm.orders) { vm.selectedOrder = $0 }
            } else {
                LoadTapView(vm: vm)
            }
        }
        .navigationTitle("Log Loads")
        .toolbar {
            if vm.selectedOrder != nil && vm.orders.count > 1 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Switch") { vm.selectedOrder = nil }
                        .foregroundStyle(.orange)
                }
            }
        }
        .task {
            vm.setup(token: auth.token ?? "")
            await vm.fetchOrders()
        }
    }
}

// MARK: - Order Selector

private struct OrderSelectorView: View {
    let orders: [OperatorOrder]
    let onSelect: (OperatorOrder) -> Void

    var body: some View {
        Group {
            if orders.isEmpty {
                ContentUnavailableView {
                    Label("No Active Orders", systemImage: "clipboard")
                } description: {
                    Text("Orders appear here when a buyer places one for your pit today.")
                }
            } else {
                List(orders) { order in
                    Button { onSelect(order) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(order.pit.name).fontWeight(.semibold)
                                Spacer()
                                OrderTypeTag(type: order.orderType)
                            }
                            Text(order.buyer.company ?? order.buyer.name ?? "—")
                                .font(.caption).foregroundStyle(.secondary)
                            Text("\(order.totalLoads) loads today")
                                .font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.insetGrouped)
            }
        }
    }
}

// MARK: - Load Tap View

private struct LoadTapView: View {
    @Bindable var vm: OperatorVM

    var body: some View {
        guard let order = vm.selectedOrder else { return AnyView(EmptyView()) }
        return AnyView(
            ScrollView {
                VStack(spacing: 16) {
                    // Order info card
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(order.pit.name).fontWeight(.bold).font(.title3)
                            Spacer()
                            OrderTypeTag(type: order.orderType)
                        }
                        if let company = order.buyer.company ?? order.buyer.name {
                            Text(company).font(.subheadline).foregroundStyle(.secondary)
                        }
                        if let phone = order.buyer.phone {
                            Link(phone, destination: URL(string: "tel:\(phone)")!)
                                .font(.caption).foregroundStyle(.orange)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Today's count
                    VStack(spacing: 4) {
                        Text("Today's Loads")
                            .font(.caption).fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                            .tracking(1)
                        Text("\(order.totalLoads)")
                            .font(.system(size: 72, weight: .black, design: .rounded))
                        ForEach(Array(order.todayCounts), id: \.key) { mat, cnt in
                            Text("\(mat): \(cnt)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    // Pending banner
                    if let pending = vm.pendingMaterial {
                        VStack(spacing: 4) {
                            Text("Tap **\(pending)** again to confirm")
                                .multilineTextAlignment(.center)
                            Text("or tap a different material to change")
                                .font(.caption).opacity(0.8)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.orange)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // Error
                    if let err = vm.error {
                        Text(err).font(.caption).foregroundStyle(.red)
                    }

                    // Material buttons
                    Text("Tap once · Tap again to log")
                        .font(.caption).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(order.pit.materialTypes, id: \.self) { material in
                            MaterialButton(
                                material:  material,
                                count:     order.todayCounts[material] ?? 0,
                                isPending: vm.pendingMaterial == material,
                                isFlash:   vm.flashMaterial  == material
                            ) {
                                Task { await vm.tap(material: material) }
                            }
                        }
                    }

                    // Undo
                    if vm.canUndo, let last = vm.lastLogged {
                        Button { Task { await vm.undoLoad() } } label: {
                            Label("Undo — \(last.material) (\(last.time.formatted(date: .omitted, time: .shortened)))", systemImage: "arrow.uturn.backward")
                                .font(.subheadline).fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color(.secondarySystemBackground))
                                .foregroundStyle(.red)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.red.opacity(0.4)))
                        }
                        .disabled(vm.logging)
                    }
                }
                .padding()
            }
        )
    }
}

// MARK: - Material Button

private struct MaterialButton: View {
    let material:  String
    let count:     Int
    let isPending: Bool
    let isFlash:   Bool
    let action:    () -> Void

    private var bgColor: Color {
        switch material {
        case "Fill Dirt (Clean)": return Color(red: 0.9, green: 0.6, blue: 0.2)
        case "Top Soil":          return Color(red: 0.4, green: 0.26, blue: 0.13)
        case "Sand":              return Color(red: 0.95, green: 0.85, blue: 0.4)
        case "Mulch":             return Color(red: 0.3, green: 0.5, blue: 0.1)
        case "#57 Stone", "#34 Stone": return Color(red: 0.4, green: 0.4, blue: 0.5)
        case "GAB":               return Color(red: 0.45, green: 0.45, blue: 0.45)
        default:                  return Color(red: 0.35, green: 0.35, blue: 0.4)
        }
    }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(material)
                        .font(.subheadline).fontWeight(.bold)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Text(isFlash ? "✓ Logged!" : count > 0 ? "\(count) today" : " ")
                        .font(.caption).foregroundStyle(.white.opacity(0.85))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .padding(12)

                if isPending && !isFlash {
                    Text("✓?")
                        .font(.title3)
                        .padding(8)
                }
            }
            .frame(height: 90)
            .background(bgColor)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isPending ? Color.white : isFlash ? Color.green : Color.clear, lineWidth: 3)
            )
            .scaleEffect(isPending ? 1.04 : isFlash ? 0.96 : 1.0)
            .animation(.spring(duration: 0.15), value: isPending)
            .animation(.spring(duration: 0.1),  value: isFlash)
        }
        .buttonStyle(.plain)
    }
}

private struct OrderTypeTag: View {
    let type: String
    var body: some View {
        let isDump = type == "DUMP"
        Text(isDump ? "Drop-off" : "Pickup")
            .font(.caption2).fontWeight(.bold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((isDump ? Color.orange : Color.blue).opacity(0.2))
            .foregroundStyle(isDump ? .orange : .blue)
            .clipShape(Capsule())
    }
}
