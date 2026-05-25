// ProjectsView.swift — Got Dirt? iOS

import SwiftUI

struct ProjectsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var projects: [Project] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showNew = false

    var body: some View {
        Group {
            if loading {
                ProgressView().tint(.orange)
            } else if let error {
                ContentUnavailableView(error, systemImage: "exclamationmark.triangle")
            } else if projects.isEmpty {
                ContentUnavailableView {
                    Label("No Projects", systemImage: "folder")
                } description: {
                    Text("Create a project to start organizing your orders.")
                } actions: {
                    Button("New Project") { showNew = true }
                        .buttonStyle(.borderedProminent).tint(.orange)
                }
            } else {
                List(projects) { project in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.name).fontWeight(.semibold)
                        Text("\(project.orderCount) order\(project.orderCount == 1 ? "" : "s")")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Projects")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNew = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showNew, onDismiss: { Task { await load() } }) {
            NewProjectView()
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        guard let token = auth.token else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            projects = try await APIClient.shared.getProjects(token: token)
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - New Project Sheet

struct NewProjectView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var name     = ""
    @State private var location = ""
    @State private var desc     = ""
    @State private var saving   = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Project Details") {
                    TextField("Project Name *", text: $name)
                    TextField("Location (optional)", text: $location)
                    TextField("Description (optional)", text: $desc)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                }
                Section {
                    Button {
                        Task { await create() }
                    } label: {
                        HStack {
                            if saving { ProgressView().tint(.white) }
                            Text(saving ? "Creating…" : "Create Project").fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .listRowBackground(name.isEmpty || saving ? Color.gray : Color.orange)
                    .foregroundStyle(.white)
                    .disabled(name.isEmpty || saving)
                }
            }
            .navigationTitle("New Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func create() async {
        guard let token = auth.token else { return }
        saving = true; error = nil
        defer { saving = false }
        do {
            _ = try await APIClient.shared.createProject(
                name:        name,
                location:    location.isEmpty ? nil : location,
                description: desc.isEmpty ? nil : desc,
                token:       token
            )
            dismiss()
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }
}
