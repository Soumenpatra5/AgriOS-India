/* /api/commerce/enamOndc
 *   GET  — returns formatted ONDC Beckn catalog or e-NAM lots for the active FPO / user
 *   POST — creates/validates an e-NAM Mandi trade lot or ONDC item
 */

import { getSql } from "../_lib/db.js";
import { requireUser } from "../_lib/requireUser.js";
import { sendError } from "../_lib/http.js";
import { formatEnamLot, formatBecknCatalog, validateEnamLot } from "../_lib/enamOndcAdapter.js";

export default async function handler(req, res) {
  try {
    const sql = getSql();
    const user = await requireUser(req, res, sql);
    if (!user) return;

    if (req.method === "GET") {
      const { format } = req.query;
      if (format === "beckn") {
        const catalog = formatBecknCatalog({
          provider: {
            id: `fpo-${user.id}`,
            name: user.name || "AgriOS FPO Collective",
            district: "Nadia",
            state: "West Bengal",
            phone: user.phone || "+919830123456",
          },
          items: [],
        });
        return res.status(200).json(catalog);
      }

      return res.status(200).json({ ok: true, status: "active", message: "e-NAM & ONDC Gateway Ready" });
    }

    if (req.method === "POST") {
      const err = validateEnamLot(req.body);
      if (err) return res.status(400).json({ error: { message: err } });

      const formatted = formatEnamLot(req.body);
      return res.status(200).json({ ok: true, lot: formatted });
    }

    return res.status(405).json({ error: { message: "GET or POST only" } });
  } catch (err) {
    return sendError(res, err, "commerce/enamOndc");
  }
}
