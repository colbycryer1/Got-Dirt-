// LoginView.swift — Got Dirt? iOS

import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var email    = ""
    @State private var password = ""
    @State private var error    = ""
    @State private var loading  = false
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo
                    VStack(spacing: 8) {
                        Text("Got Dirt?")
                            .font(.system(size: 42, weight: .black))
                            .foregroundStyle(.orange)
                        Text("Find dirt pits near your job site")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 48)

                    // Form
                    VStack(spacing: 16) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .padding()
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))

                        if !error.isEmpty {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task { await signIn() }
                        } label: {
                            HStack {
                                if loading { ProgressView().tint(.white) }
                                Text(loading ? "Signing in…" : "Sign In")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(loading || email.isEmpty || password.isEmpty ? Color.gray : Color.orange)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(loading || email.isEmpty || password.isEmpty)
                    }
                    .padding(.horizontal)

                    Button("Create an account →") { showRegister = true }
                        .foregroundStyle(.orange)
                        .font(.subheadline)
                }
            }
            .sheet(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }

    private func signIn() async {
        error = ""; loading = true
        defer { loading = false }
        do {
            try await auth.signIn(email: email.lowercased(), password: password)
        } catch let e as APIError {
            error = e.localizedDescription ?? "Sign in failed"
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Register

struct RegisterView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var email    = ""
    @State private var password = ""
    @State private var name     = ""
    @State private var company  = ""
    @State private var role     = "BUYER"
    @State private var error    = ""
    @State private var loading  = false

    private let roles = [
        ("BUYER",     "Direct Buyer / Contractor"),
        ("PIT_OWNER", "Pit Owner"),
        ("DRIVER",    "Truck Driver"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Account Info") {
                    TextField("Full Name", text: $name)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    SecureField("Password (8+ chars)", text: $password)
                    TextField("Company (optional)", text: $company)
                }
                Section("I am a…") {
                    Picker("Role", selection: $role) {
                        ForEach(roles, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                if !error.isEmpty {
                    Section { Text(error).foregroundStyle(.red).font(.caption) }
                }
                Section {
                    Button {
                        Task { await register() }
                    } label: {
                        HStack {
                            if loading { ProgressView() }
                            Text(loading ? "Creating…" : "Create Account")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(loading || email.isEmpty || password.count < 8 || name.isEmpty)
                }
            }
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func register() async {
        error = ""; loading = true
        defer { loading = false }
        do {
            try await auth.register(
                email:   email.lowercased(),
                password: password,
                name:    name,
                role:    role,
                company: company.isEmpty ? nil : company
            )
            dismiss()
        } catch let e as APIError {
            error = e.localizedDescription ?? "Registration failed"
        } catch {
            self.error = error.localizedDescription
        }
    }
}
