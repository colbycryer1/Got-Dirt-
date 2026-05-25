// OrderPlacementView.swift — Got Dirt? iOS
// Place a Borrow (pickup) or Dump (drop-off) order for a pit.

import SwiftUI

struct OrderPlacementView: View {
    let pit: Pit
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var projects: [Project] = []
    @State private var selectedProject: Project?
    @State private var selectedOrderType: OrderTypeOption
    @State private var selectedDate = Date()
    @State private var loading = false
    @State private var loadingProjects = true
    @State private var error: String?
    @State private var success = false

    init(pit: Pit) {
        self.pit = pit
        _selectedOrderType = State(initialValue: pit.supportedOrderTypes.first ?? .borrow)
    }

    private var dateString: String {
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: selectedDate)
    }

    private var rateForType: Int? {
        switch selectedOrderType {
        case .borrow: return pit.borrowRateCents
        case .dump:   return pit.dumpRateCents
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Pit summary
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(pit.name).fontWeight(.semibold)
                            Text(pit.pitTypeLabel).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let rate = rateForType {
                            Text(rate.centsToDisplay + "/load")
                                .fontWeight(.bold).foregroundStyle(.orange)
                        }
                    }
                }

                // Order type (only shown when pit supports both)
                if pit.supportedOrderTypes.count > 1 {
                    Section("Order Type") {
                        ForEach(pit.supportedOrderTypes, id: \.rawValue) { type in
                            Button {
                                selectedOrderType = type
                            } label: {
                                HStack {
                                    Image(systemName: type.icon)
                                        .foregroundStyle(selectedOrderType == type ? .orange : .secondary)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(type.label).foregroundStyle(.primary).fontWeight(.medium)
                                        if let rate = (type == .borrow ? pit.borrowRateCents : pit.dumpRateCents) {
                                            Text(rate.centsToDisplay + " per load")
                                                .font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    if selectedOrderType == type {
                                        Image(systemName: "checkmark").foregroundStyle(.orange)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Project
                Section("Project") {
                    if loadingProjects {
                        HStack { ProgressView(); Text("Loading projects…").foregroundStyle(.secondary) }
                    } else if projects.isEmpty {
                        Text("No projects — create one in the Projects tab first.")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        Picker("Select Project", selection: $selectedProject) {
                            Text("Select…").tag(Optional<Project>.none)
                            ForEach(projects) { p in Text(p.name).tag(Optional(p)) }
                        }
                    }
                }

                // Date
                Section("Date") {
                    DatePicker("Order Date", selection: $selectedDate, displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .tint(.orange)
                }

                // Error
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                }

                // Submit
                Section {
                    Button {
                        Task { await placeOrder() }
                    } label: {
                        HStack {
                            if loading { ProgressView().tint(.white) }
                            Text(loading ? "Placing Order…" : "Place Order")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(selectedProject == nil || loading ? Color.gray : Color.orange)
                    .foregroundStyle(.white)
                    .disabled(selectedProject == nil || loading)
                }
            }
            .navigationTitle("New Order")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Order Placed!", isPresented: $success) {
                Button("Done") { dismiss() }
            } message: {
                Text("Your order has been placed. The pit operator will see it today.")
            }
        }
        .task { await loadProjects() }
    }

    private func loadProjects() async {
        guard let token = auth.token else { return }
        loadingProjects = true
        defer { loadingProjects = false }
        do {
            projects = try await APIClient.shared.getProjects(token: token)
            if projects.count == 1 { selectedProject = projects[0] }
        } catch {}
    }

    private func placeOrder() async {
        guard let token = auth.token, let project = selectedProject else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            _ = try await APIClient.shared.placeOrder(
                pitId:     pit.id,
                projectId: project.id,
                orderType: selectedOrderType.rawValue,
                date:      dateString,
                token:     token
            )
            success = true
        } catch let e as APIError {
            error = e.localizedDescription
        } catch { self.error = error.localizedDescription }
    }
}
