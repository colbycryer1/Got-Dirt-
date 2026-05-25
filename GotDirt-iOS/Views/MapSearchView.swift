// MapSearchView.swift — Got Dirt? iOS
// Interactive map with pit markers. Green = accepting, red = not accepting.

import SwiftUI
import MapKit
import CoreLocation

@Observable
@MainActor
private final class MapVM: NSObject, CLLocationManagerDelegate {
    var pits: [Pit] = []
    var loading = false
    var error: String?
    var userLocation: CLLocationCoordinate2D?
    var cameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 33.749, longitude: -84.388),
            latitudinalMeters: 80_000, longitudinalMeters: 80_000
        )
    )
    var showAcceptingOnly = false
    var radius: Double = 50

    private let locationManager = CLLocationManager()
    private var token: String?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func setup(token: String) { self.token = token }

    func requestLocation() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.first else { return }
        Task { @MainActor in
            self.userLocation = loc.coordinate
            self.cameraPosition = .region(MKCoordinateRegion(
                center: loc.coordinate,
                latitudinalMeters: Double(self.radius) * 1609.344 * 2,
                longitudinalMeters: Double(self.radius) * 1609.344 * 2
            ))
            await self.fetchPits(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    func fetchPits(lat: Double = 33.749, lng: Double = -84.388) async {
        guard let token else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            pits = try await APIClient.shared.searchPits(
                lat: lat, lng: lng, radius: radius,
                accepting: showAcceptingOnly ? true : nil,
                token: token
            )
        } catch let e as APIError { error = e.localizedDescription }
        catch { self.error = error.localizedDescription }
    }
}

struct MapSearchView: View {
    @Environment(AuthManager.self) private var auth
    @State private var vm = MapVM()
    @State private var selectedPit: Pit?
    @State private var showFilters = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Map(position: $vm.cameraPosition) {
                ForEach(vm.pits) { pit in
                    Annotation(pit.name, coordinate: pit.coordinate) {
                        PitPin(accepting: pit.accepting)
                            .onTapGesture { selectedPit = pit }
                    }
                }
                if let loc = vm.userLocation {
                    Annotation("You", coordinate: loc) {
                        Circle()
                            .fill(.blue)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                    }
                }
            }
            .mapStyle(.hybrid)
            .ignoresSafeArea(edges: .top)

            // Bottom controls
            VStack(spacing: 0) {
                if vm.loading {
                    HStack {
                        ProgressView().tint(.orange)
                        Text("Loading pits…").font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(8)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .padding(.bottom, 8)
                }

                HStack {
                    Button {
                        vm.requestLocation()
                    } label: {
                        Image(systemName: "location.fill")
                            .padding(14)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }

                    Spacer()

                    Button {
                        showFilters = true
                    } label: {
                        Label("Filter", systemImage: "slider.horizontal.3")
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
        }
        .navigationTitle("Find Pits")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedPit) { pit in
            PitDetailView(pitId: pit.id)
        }
        .sheet(isPresented: $showFilters) {
            FilterSheet(radius: $vm.radius, showAcceptingOnly: $vm.showAcceptingOnly) {
                Task {
                    if let loc = vm.userLocation {
                        await vm.fetchPits(lat: loc.latitude, lng: loc.longitude)
                    } else {
                        await vm.fetchPits()
                    }
                }
            }
        }
        .task {
            vm.setup(token: auth.token ?? "")
            await vm.fetchPits()
        }
    }
}

// MARK: - Subviews

private struct PitPin: View {
    let accepting: Bool
    var body: some View {
        ZStack {
            Circle()
                .fill(accepting ? Color.green : Color.red)
                .frame(width: 22, height: 22)
            Circle()
                .stroke(.white, lineWidth: 2)
                .frame(width: 22, height: 22)
        }
        .shadow(radius: 3)
    }
}

private struct FilterSheet: View {
    @Binding var radius: Double
    @Binding var showAcceptingOnly: Bool
    let onApply: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Search Radius") {
                    VStack(alignment: .leading) {
                        Text("\(Int(radius)) miles").fontWeight(.semibold)
                        Slider(value: $radius, in: 5...200, step: 5)
                            .tint(.orange)
                    }
                }
                Section("Availability") {
                    Toggle("Accepting Only", isOn: $showAcceptingOnly)
                        .tint(.orange)
                }
            }
            .navigationTitle("Filter Pits")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") { onApply(); dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(.orange)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
