// APIClient.swift — Got Dirt? iOS
// All network calls go through here. Uses JWT Bearer auth via /api/mobile/* routes.

import Foundation

enum APIError: LocalizedError {
    case unauthorized, notFound
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .unauthorized:       return "Please sign in to continue."
        case .notFound:           return "Not found."
        case .serverError(let m): return m
        case .networkError(let e):return e.localizedDescription
        case .decodingError(let e):return "Data error: \(e.localizedDescription)"
        case .unknown:            return "An unknown error occurred."
        }
    }
}

@MainActor
final class APIClient {
    static let shared = APIClient()
    private let session = URLSession.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private init() {}

    // MARK: Helpers

    private func url(_ path: String) -> URL {
        URL(string: Config.baseURL + path)!
    }

    private func request(_ path: String, method: String = "GET", body: [String: Any]? = nil, token: String? = nil) -> URLRequest {
        var req = URLRequest(url: url(path))
        req.httpMethod = method
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        return req
    }

    private func fetch<T: Decodable>(_ type: T.Type, req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }
        if http.statusCode == 401 { throw APIError.unauthorized }
        if http.statusCode == 404 { throw APIError.notFound }
        if http.statusCode >= 400 {
            struct Err: Codable { let error: String? }
            let msg = (try? decoder.decode(Err.self, from: data))?.error ?? "Server error \(http.statusCode)"
            throw APIError.serverError(msg)
        }
        do { return try decoder.decode(type, from: data) }
        catch { throw APIError.decodingError(error) }
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> AuthResponse {
        var req = request("/api/mobile/login", method: "POST", body: ["email": email, "password": password])
        return try await fetch(AuthResponse.self, req: req)
    }

    func register(email: String, password: String, name: String, role: String, company: String?) async throws -> AuthResponse {
        var body: [String: Any] = ["email": email, "password": password, "name": name, "role": role]
        if let company { body["company"] = company }
        let req = request("/api/mobile/register", method: "POST", body: body)
        return try await fetch(AuthResponse.self, req: req)
    }

    func getMe(token: String) async throws -> MobileUser {
        struct Resp: Codable { let user: MobileUser }
        let req = request("/api/mobile/me", token: token)
        return try await fetch(Resp.self, req: req).user
    }

    // MARK: - Pits

    func searchPits(lat: Double, lng: Double, radius: Double = 50, accepting: Bool? = nil, token: String) async throws -> [Pit] {
        var params = "lat=\(lat)&lng=\(lng)&radius=\(radius)"
        if let a = accepting { params += "&accepting=\(a)" }
        let req = request("/api/mobile/pits?\(params)", token: token)
        return try await fetch(PitsResponse.self, req: req).pits
    }

    func getMyPits(token: String) async throws -> [Pit] {
        let req = request("/api/mobile/pits/mine", token: token)
        return try await fetch(PitsResponse.self, req: req).pits
    }

    func getPit(id: String, token: String) async throws -> Pit {
        let req = request("/api/mobile/pits/\(id)", token: token)
        return try await fetch(PitResponse.self, req: req).pit
    }

    func toggleAccepting(pitId: String, accepting: Bool, token: String) async throws {
        let req = request("/api/mobile/pits/\(pitId)/status", method: "PATCH", body: ["accepting": accepting], token: token)
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.serverError("Failed to update pit status")
        }
    }

    // MARK: - Orders

    func getOrders(token: String) async throws -> [Order] {
        let req = request("/api/mobile/orders", token: token)
        return try await fetch(OrdersResponse.self, req: req).orders
    }

    func placeOrder(pitId: String, projectId: String, orderType: String, date: String, token: String) async throws -> Order {
        let body: [String: Any] = ["pitId": pitId, "projectId": projectId, "orderType": orderType, "date": date]
        let req = request("/api/mobile/orders", method: "POST", body: body, token: token)
        return try await fetch(OrderCreatedResponse.self, req: req).order
    }

    func closeOrder(id: String, token: String) async throws {
        let req = request("/api/mobile/orders/\(id)", method: "PATCH", body: ["status": "COMPLETED"], token: token)
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.serverError("Failed to close order")
        }
    }

    func chargeOrder(id: String, token: String) async throws {
        let req = request("/api/mobile/orders/\(id)/charge", method: "POST", body: [:], token: token)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            struct Err: Codable { let error: String? }
            let msg = (try? decoder.decode(Err.self, from: data))?.error ?? "Charge failed"
            throw APIError.serverError(msg)
        }
    }

    // MARK: - Projects

    func getProjects(token: String) async throws -> [Project] {
        let req = request("/api/mobile/projects", token: token)
        return try await fetch(ProjectsResponse.self, req: req).projects
    }

    func createProject(name: String, location: String?, description: String?, token: String) async throws -> Project {
        var body: [String: Any] = ["name": name]
        if let l = location     { body["location"]    = l }
        if let d = description  { body["description"] = d }
        let req = request("/api/mobile/projects", method: "POST", body: body, token: token)
        return try await fetch(ProjectCreatedResponse.self, req: req).project
    }

    // MARK: - Operator

    func getOperatorOrders(token: String) async throws -> [OperatorOrder] {
        let req = request("/api/mobile/operator/orders", token: token)
        return try await fetch(OperatorOrdersResponse.self, req: req).orders
    }

    // MARK: - Loads

    func logLoad(orderId: String, materialType: String, token: String) async throws {
        let req = request("/api/mobile/loads", method: "POST", body: ["orderId": orderId, "materialType": materialType], token: token)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 201 else {
            struct Err: Codable { let error: String? }
            let msg = (try? decoder.decode(Err.self, from: data))?.error ?? "Failed to log load"
            throw APIError.serverError(msg)
        }
    }

    func undoLoad(orderId: String, token: String) async throws {
        let req = request("/api/mobile/loads?orderId=\(orderId)", method: "DELETE", token: token)
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            struct Err: Codable { let error: String? }
            let msg = (try? decoder.decode(Err.self, from: data))?.error ?? "Cannot undo — 2-minute window may have expired"
            throw APIError.serverError(msg)
        }
    }
}

private extension URLRequest {
    init(url: URL) { self.init(url: url, cachePolicy: .useProtocolCachePolicy) }
}
