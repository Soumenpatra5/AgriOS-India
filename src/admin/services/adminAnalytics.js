import { productService } from "../../services/marketplace/productService.js";
import { sellerService } from "../../services/marketplace/sellerService.js";
import { mpOrderService } from "../../services/marketplace/mpOrderService.js";
import { providerService } from "../../services/svcMarketplace/providerService.js";
import { bookingService } from "../../services/svcMarketplace/bookingService.js";
import { warehouseService } from "../../services/logistics/warehouseService.js";
import { repo } from "../../services/logistics/logisticsDb.js";

const shipments = repo("shipments");

export const adminAnalytics = {
  async revenue() {
    const orders = await mpOrderService.getAll();
    const delivered = orders.filter((o) => o.status === "delivered");
    const total = delivered.reduce((s, o) => s + (o.total || 0), 0);
    const byMonth = {};
    delivered.forEach((o) => {
      const m = o.createdAt?.slice(0, 7) || "unknown";
      byMonth[m] = (byMonth[m] || 0) + (o.total || 0);
    });
    return { total, orderCount: orders.length, deliveredCount: delivered.length, byMonth };
  },

  async marketplace() {
    const [products, sellers, orders] = await Promise.all([
      productService.getAll(), sellerService.getAll(), mpOrderService.getAll(),
    ]);
    const categories = {};
    products.forEach((p) => { categories[p.category] = (categories[p.category] || 0) + 1; });
    return { products: products.length, sellers: sellers.length, orders: orders.length, categories };
  },

  async logistics() {
    const [s, w] = await Promise.all([shipments.getAll(), warehouseService.getAll()]);
    const byStatus = {};
    s.forEach((sh) => { byStatus[sh.status] = (byStatus[sh.status] || 0) + 1; });
    return { shipments: s.length, warehouses: w.length, byStatus };
  },

  async services() {
    const [providers, bookings] = await Promise.all([providerService.getAll(), bookingService.getAll()]);
    return { providers: providers.length, bookings: bookings.length };
  },
};
