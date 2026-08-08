export const CORE_DBS = [
  {
    name: "agrios-erp",
    stores: [
      "farms", "parcels", "tasks", "inventory", "stockMoves",
      "assets", "maintenance", "employees", "attendance",
      "contacts", "orders", "devices", "telemetry", "ledgerTxns",
      "employeePayments", "employeeLeaves", "employeeDocuments", "employeeRecords",
    ],
  },
  {
    name: "agrios-livestock",
    stores: ["animals", "productions", "events"],
  },
  {
    name: "agrios-marketplace",
    stores: ["sellers", "products", "cart", "wishlist", "orders", "reviews"],
  },
  {
    name: "agrios-svc-marketplace",
    stores: [
      "providers", "services", "bookings", "svcReviews", "availability",
    ],
  },
  {
    name: "agrios-logistics",
    stores: [
      "transportProviders", "vehicles", "drivers", "shipments", "tracking",
      "warehouses", "storageBookings", "contracts", "auctions", "bids",
      "procurements", "exportOrders", "telemetry",
    ],
  },
  {
    name: "agrios-ai-commerce",
    stores: [
      "recommendations", "forecasts", "scores", "fraudReports",
      "leads", "aiAlerts", "insights",
    ],
  },
  {
    name: "agrios-admin",
    stores: [
      "auditLogs", "tickets", "articles", "announcements", "adminSessions",
    ],
  },
];

// Stores whose names collide across DBs need unique Firestore collection names.
// Key = "dbName:storeName", value = Firestore collection name.
export const FIRESTORE_RENAMES = {
  "agrios-marketplace:orders": "mpOrders",
  "agrios-logistics:telemetry": "logTelemetry",
};

export function firestoreName(dbName, storeName) {
  return FIRESTORE_RENAMES[`${dbName}:${storeName}`] || storeName;
}
