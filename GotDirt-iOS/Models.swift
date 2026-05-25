// Models.swift — Got Dirt? iOS
// Codable structs that mirror the /api/mobile/* JSON responses.

import Foundation
import CoreLocation

// MARK: - Auth

struct AuthResponse: Codable {
    let token: String
    let user: MobileUser
}

struct MobileUser: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let role: String
    let company: String?
}

// MARK: - Pit

struct PitsResponse: Codable {
    let pits: [Pit]
}

struct PitResponse: Codable {
    let pit: Pit
}

struct Pit: Codable, Identifiable {
    let id: String
    let name: String
    let latitude: Double
    let longitude: Double
    let state: String
    let address: String?
    let pitType: String
    let accepting: Bool
    let dumpRateCents: Int?
    let borrowRateCents: Int?
    let topsoilRateCents: Int?
    let hasTopsoil: Bool
    let materialTypes: [String]
    let notes: String?
    let hoursOpen: String?
    let hoursClose: String?
    let contactName: String?
    let contactPhone: String?
    let operatorProvided: Bool
    let equipmentProvided: Bool
    let equipmentNotes: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var pitTypeLabel: String {
        switch pitType {
        case "WASTE":              return "Waste Pit"
        case "BORROW":             return "Borrow Pit"
        case "WASTE_BORROW":       return "Waste & Borrow Pit"
        case "PRIVATE_BORROW_PIT": return "Private Borrow Pit"
        case "QUARRY":             return "Quarry"
        default:                   return pitType
        }
    }

    var supportedOrderTypes: [OrderTypeOption] {
        switch pitType {
        case "WASTE":        return [.dump]
        case "WASTE_BORROW": return [.borrow, .dump]
        default:             return [.borrow]
        }
    }
}

enum OrderTypeOption: String, CaseIterable {
    case borrow = "BORROW"
    case dump   = "DUMP"

    var label: String {
        switch self {
        case .borrow: return "Pickup (Borrow)"
        case .dump:   return "Drop-off (Dump)"
        }
    }
    var shortLabel: String {
        switch self {
        case .borrow: return "Pickup"
        case .dump:   return "Drop-off"
        }
    }
    var icon: String {
        switch self {
        case .borrow: return "arrow.up.circle"
        case .dump:   return "arrow.down.circle"
        }
    }
}

// MARK: - Order

struct OrdersResponse: Codable {
    let orders: [Order]
}

struct OrderCreatedResponse: Codable {
    let order: Order
}

struct Order: Codable, Identifiable {
    let id: String
    let date: String
    let status: String
    let orderType: String
    let pit: OrderPit
    let project: OrderProject
    let settlements: [Settlement]
    let loadEvents: [LoadEvent]?
    let _count: OrderCount?

    struct OrderPit: Codable {
        let name: String
        let address: String?
        let state: String
    }
    struct OrderProject: Codable {
        let name: String
    }
    struct OrderCount: Codable {
        let loadEvents: Int
    }

    var totalLoads: Int { _count?.loadEvents ?? loadEvents?.count ?? 0 }

    var totalSpentCents: Int {
        settlements.filter { $0.status == "PROCESSED" }.reduce(0) { $0 + $1.grossAmountCents }
    }

    var settledLoadCount: Int {
        settlements.filter { $0.status == "PROCESSED" }.reduce(0) { $0 + $1.verifiedLoadCount }
    }

    var unchargedLoadCount: Int { max(0, totalLoads - settledLoadCount) }
    var hasUnchargedLoads: Bool { unchargedLoadCount > 0 }

    var materialCounts: [String: Int] {
        guard let events = loadEvents else { return [:] }
        return events.reduce(into: [:]) { acc, e in acc[e.materialType, default: 0] += 1 }
    }

    var displayDate: String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso2 = ISO8601DateFormatter()
        if let d = iso.date(from: date) ?? iso2.date(from: date) {
            let fmt = DateFormatter(); fmt.dateStyle = .medium
            return fmt.string(from: d)
        }
        return date
    }
}

struct Settlement: Codable {
    let grossAmountCents: Int
    let verifiedLoadCount: Int
    let status: String
}

struct LoadEvent: Codable, Identifiable {
    let id: String
    let materialType: String
    let rateCentsAtTime: Int
    let createdAt: String
}

// MARK: - Project

struct ProjectsResponse: Codable {
    let projects: [Project]
}

struct ProjectCreatedResponse: Codable {
    let project: Project
}

struct Project: Codable, Identifiable {
    let id: String
    let name: String
    let location: String?
    let description: String?
    let _count: ProjectCount?

    struct ProjectCount: Codable {
        let orders: Int
    }

    var orderCount: Int { _count?.orders ?? 0 }
}

// MARK: - Operator

struct OperatorOrdersResponse: Codable {
    let orders: [OperatorOrder]
}

struct OperatorOrder: Codable, Identifiable {
    let id: String
    let date: String
    let orderType: String
    let buyer: OperatorBuyer
    let pit: OperatorPit
    let loadEvents: [LoadEvent]

    struct OperatorBuyer: Codable {
        let name: String?
        let company: String?
        let phone: String?
    }
    struct OperatorPit: Codable {
        let name: String
        let materialTypes: [String]
        let dumpRateCents: Int?
        let borrowRateCents: Int?
        let topsoilRateCents: Int?
    }

    var totalLoads: Int { loadEvents.count }
    var todayCounts: [String: Int] {
        loadEvents.reduce(into: [:]) { acc, e in acc[e.materialType, default: 0] += 1 }
    }
}

// MARK: - Helpers

extension Int {
    var centsToDisplay: String { String(format: "$%.2f", Double(self) / 100.0) }
}
