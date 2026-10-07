/* Local ERP ↔ Cloud Farm Space Bridge — Phase 1: Land Parcels → Farm Fields.
 *
 * Bridges device-local offline ERP land parcels into cloud Farm Space farm_fields.
 * Keeps local and cloud data models strictly decoupled:
 *   - Local parcel.id maps to cloud farm_fields.client_uuid
 *   - Farm field id remains server-generated UUID
 *   - space_id is enforced on every operation
 *   - Dedicated PostgreSQL transport without external sync services or employee records
 *   - Idempotent and auditable via farm_audit_logs
 */

import { HttpError } from "../http.js";
import { audit } from "./gate.js";

export const SOIL_TYPE_MAP = {
  clay: "clay",
  loam: "loam",
  loamy: "loam",
  sandy: "sandy",
  silt: "silt",
  black: "black",
  "black (regur)": "black",
  red: "red",
  alluvial: "other",
  laterite: "other",
  saline: "other",
  other: "other",
};

export const IRRIGATION_MAP = {
  rainfed: "rainfed",
  "rain-fed": "rainfed",
  canal: "canal",
  borewell: "borewell",
  drip: "drip",
  sprinkler: "sprinkler",
  pond: "other",
  river: "other",
  other: "other",
};

export const CROP_TYPE_MAP = {
  rice: "rice",
  paddy: "rice",
  dhan: "rice",
  wheat: "wheat",
  gehun: "wheat",
  maize: "maize",
  makka: "maize",
  corn: "maize",
  cotton: "cotton",
  kapas: "cotton",
  sugarcane: "sugarcane",
  ganna: "sugarcane",
  mustard: "mustard",
  sarson: "mustard",
  soybean: "soybean",
  chickpea: "chickpea",
  chana: "chickpea",
  gram: "chickpea",
  potato: "potato",
  aloo: "potato",
  onion: "onion",
  pyaz: "onion",
  tomato: "tomato",
  tamatar: "tomato",
  vegetables: "vegetables",
  pulses: "pulses",
  oilseeds: "oilseeds",
  fruit: "fruit",
  other: "other",
};

export const VALID_AREA_UNITS = new Set(["acres", "bigha", "hectare", "guntha"]);
export const VALID_CROP_TYPES = new Set([
  "rice", "wheat", "maize", "cotton", "sugarcane", "mustard",
  "soybean", "chickpea", "potato", "onion", "tomato",
  "vegetables", "pulses", "oilseeds", "fruit", "other",
]);
export const VALID_SOIL_TYPES = new Set(["clay", "loam", "sandy", "silt", "black", "red", "other"]);
export const VALID_IRRIGATION_TYPES = new Set(["rainfed", "canal", "borewell", "drip", "sprinkler", "other"]);
export const VALID_SEASONS = new Set(["kharif", "rabi", "zaid", "perennial"]);

export function normalizeParcel(parcel) {
  if (!parcel || typeof parcel !== "object") {
    throw new HttpError(400, "Invalid parcel data");
  }
  const clientUuid = parcel.id != null ? String(parcel.id).trim() : "";
  if (!clientUuid) {
    throw new HttpError(400, "Parcel id is required");
  }

  const name = parcel.name != null ? String(parcel.name).trim() : "";
  if (!name) {
    throw new HttpError(400, `Parcel name is required for id "${clientUuid}"`);
  }

  const rawArea = parcel.areaAcres ?? parcel.acres ?? parcel.area;
  let area = null;
  if (rawArea !== undefined && rawArea !== null && rawArea !== "") {
    area = Number(rawArea);
    if (Number.isNaN(area) || area < 0) {
      throw new HttpError(400, `Invalid parcel area for "${name}"`);
    }
    // Round to 3 decimal places to match numeric(10,3)
    area = Math.round(area * 1000) / 1000;
  }

  const rawUnit = (parcel.areaUnit || parcel.area_unit || "acres").toLowerCase().trim();
  const areaUnit = VALID_AREA_UNITS.has(rawUnit) ? rawUnit : "acres";

  const rawSoil = (parcel.soilType || parcel.soil_type || "").toLowerCase().trim();
  let soilType = null;
  if (rawSoil) {
    soilType = SOIL_TYPE_MAP[rawSoil] || (VALID_SOIL_TYPES.has(rawSoil) ? rawSoil : "other");
  }

  const rawIrr = (parcel.irrigationType || parcel.irrigation_type || parcel.waterSource || "").toLowerCase().trim();
  let irrigationType = null;
  if (rawIrr) {
    irrigationType = IRRIGATION_MAP[rawIrr] || (VALID_IRRIGATION_TYPES.has(rawIrr) ? rawIrr : "other");
  }

  const currentCrop = parcel.currentCrop ? String(parcel.currentCrop).trim() : null;

  let cropType = "other";
  const rawCropType = (parcel.cropType || parcel.crop_type || "").toLowerCase().trim();
  if (rawCropType && VALID_CROP_TYPES.has(rawCropType)) {
    cropType = rawCropType;
  } else if (currentCrop) {
    const norm = currentCrop.toLowerCase();
    cropType = CROP_TYPE_MAP[norm] || (VALID_CROP_TYPES.has(norm) ? norm : "other");
  }

  let season = null;
  const rawSeason = (parcel.season || "").toLowerCase().trim();
  if (rawSeason && VALID_SEASONS.has(rawSeason)) {
    season = rawSeason;
  }

  const notes = parcel.notes ? String(parcel.notes).trim() : null;

  return {
    clientUuid,
    name,
    area,
    areaUnit,
    soilType,
    irrigationType,
    currentCrop,
    cropType,
    season,
    notes,
  };
}

export function diffField(local, cloud) {
  const diffs = [];

  if (local.name !== cloud.name) {
    diffs.push({ field: "name", local: local.name, cloud: cloud.name });
  }

  const localArea = local.area != null ? Number(local.area) : null;
  const cloudArea = cloud.area != null ? Number(cloud.area) : null;
  if (localArea !== cloudArea) {
    diffs.push({ field: "area", local: localArea, cloud: cloudArea });
  }

  if (local.areaUnit !== (cloud.area_unit || "acres")) {
    diffs.push({ field: "area_unit", local: local.areaUnit, cloud: cloud.area_unit });
  }

  if ((local.soilType || null) !== (cloud.soil_type || null)) {
    diffs.push({ field: "soil_type", local: local.soilType, cloud: cloud.soil_type });
  }

  if ((local.irrigationType || null) !== (cloud.irrigation_type || null)) {
    diffs.push({ field: "irrigation_type", local: local.irrigationType, cloud: cloud.irrigation_type });
  }

  if (local.cropType !== (cloud.crop_type || "other")) {
    diffs.push({ field: "crop_type", local: local.cropType, cloud: cloud.crop_type });
  }

  if ((local.currentCrop || null) !== (cloud.current_crop || null)) {
    diffs.push({ field: "current_crop", local: local.currentCrop, cloud: cloud.current_crop });
  }

  if ((local.season || null) !== (cloud.season || null)) {
    diffs.push({ field: "season", local: local.season, cloud: cloud.season });
  }

  if ((local.notes || null) !== (cloud.notes || null)) {
    diffs.push({ field: "notes", local: local.notes, cloud: cloud.notes });
  }

  return diffs;
}

export async function preview(sql, membership, payload = {}) {
  const { spaceId, parcels } = payload;

  if (spaceId && String(spaceId) !== String(membership.space_id)) {
    throw new HttpError(400, "Target Farm Space mismatch");
  }

  if (!Array.isArray(parcels)) {
    throw new HttpError(400, "parcels must be an array");
  }

  if (parcels.length === 0) {
    return {
      spaceId: membership.space_id,
      summary: { total: 0, newCount: 0, sameCount: 0, diffCount: 0, conflictCount: 0 },
      items: [],
    };
  }

  const normalized = parcels.map(normalizeParcel);
  const clientUuids = normalized.map((p) => p.clientUuid);

  const existingRows = await sql`
    select * from farm_fields
    where client_uuid = any(${clientUuids})
      and deleted_at is null
  `;

  const existingMap = new Map();
  for (const row of existingRows) {
    existingMap.set(row.client_uuid, row);
  }

  const items = [];
  let newCount = 0;
  let sameCount = 0;
  let diffCount = 0;
  let conflictCount = 0;

  for (const local of normalized) {
    const cloud = existingMap.get(local.clientUuid);

    if (!cloud) {
      newCount++;
      items.push({
        clientUuid: local.clientUuid,
        name: local.name,
        status: "NEW",
        local,
        cloud: null,
        diffs: [],
      });
    } else if (String(cloud.space_id) !== String(membership.space_id)) {
      conflictCount++;
      items.push({
        clientUuid: local.clientUuid,
        name: local.name,
        status: "CONFLICT_OTHER_SPACE",
        error: "Parcel is already linked to another Farm Space",
        local,
        cloud: { id: cloud.id, space_id: cloud.space_id, name: cloud.name },
        diffs: [],
      });
    } else {
      const diffs = diffField(local, cloud);
      if (diffs.length === 0) {
        sameCount++;
        items.push({
          clientUuid: local.clientUuid,
          name: local.name,
          status: "EXISTS_SAME",
          local,
          cloud: {
            id: cloud.id,
            name: cloud.name,
            area: cloud.area != null ? Number(cloud.area) : null,
            area_unit: cloud.area_unit,
            soil_type: cloud.soil_type,
            irrigation_type: cloud.irrigation_type,
            crop_type: cloud.crop_type,
            current_crop: cloud.current_crop,
            season: cloud.season,
            notes: cloud.notes,
          },
          diffs: [],
        });
      } else {
        diffCount++;
        items.push({
          clientUuid: local.clientUuid,
          name: local.name,
          status: "EXISTS_DIFF",
          local,
          cloud: {
            id: cloud.id,
            name: cloud.name,
            area: cloud.area != null ? Number(cloud.area) : null,
            area_unit: cloud.area_unit,
            soil_type: cloud.soil_type,
            irrigation_type: cloud.irrigation_type,
            crop_type: cloud.crop_type,
            current_crop: cloud.current_crop,
            season: cloud.season,
            notes: cloud.notes,
          },
          diffs,
        });
      }
    }
  }

  return {
    spaceId: membership.space_id,
    summary: {
      total: normalized.length,
      newCount,
      sameCount,
      diffCount,
      conflictCount,
    },
    items,
  };
}

export async function publishFields(sql, membership, actorUserId, payload = {}) {
  const { spaceId, parcels, overwrite = false } = payload;

  if (spaceId && String(spaceId) !== String(membership.space_id)) {
    throw new HttpError(400, "Target Farm Space mismatch");
  }

  if (!Array.isArray(parcels)) {
    throw new HttpError(400, "parcels must be an array");
  }

  if (parcels.length === 0) {
    return {
      success: true,
      spaceId: membership.space_id,
      created: [],
      updated: [],
      skipped: [],
      total: 0,
    };
  }

  const normalized = parcels.map(normalizeParcel);
  const clientUuids = normalized.map((p) => p.clientUuid);

  const runInTx = typeof sql.begin === "function" ? (fn) => sql.begin(fn) : (fn) => fn(sql);

  const results = await runInTx(async (tx) => {
    const existingRows = await tx`
      select * from farm_fields
      where client_uuid = any(${clientUuids})
        and deleted_at is null
    `;

    const existingMap = new Map();
    for (const row of existingRows) {
      existingMap.set(row.client_uuid, row);
    }

    // Strict cross-space isolation check
    for (const item of normalized) {
      const existing = existingMap.get(item.clientUuid);
      if (existing && String(existing.space_id) !== String(membership.space_id)) {
        throw new HttpError(409, `Cross-space publish rejected: parcel "${item.name}" already belongs to another Farm Space`);
      }
    }

    const created = [];
    const updated = [];
    const skipped = [];

    for (const local of normalized) {
      const cloud = existingMap.get(local.clientUuid);

      if (!cloud) {
        const rows = await tx`
          insert into farm_fields
            (space_id, name, area, area_unit, crop_type, current_crop,
             season, soil_type, irrigation_type, notes, client_uuid, created_by)
          values (
            ${membership.space_id},
            ${local.name},
            ${local.area},
            ${local.areaUnit},
            ${local.cropType},
            ${local.currentCrop},
            ${local.season},
            ${local.soilType},
            ${local.irrigationType},
            ${local.notes},
            ${local.clientUuid},
            ${actorUserId}
          )
          returning id, space_id, name, client_uuid
        `;
        created.push({
          id: rows[0].id,
          clientUuid: rows[0].client_uuid,
          name: rows[0].name,
        });
      } else {
        const diffs = diffField(local, cloud);

        if (diffs.length === 0) {
          skipped.push({
            id: cloud.id,
            clientUuid: cloud.client_uuid,
            name: cloud.name,
            reason: "already_synced",
          });
        } else if (overwrite) {
          const rows = await tx`
            update farm_fields set
              name            = ${local.name},
              area            = ${local.area},
              area_unit       = ${local.areaUnit},
              crop_type       = ${local.cropType},
              current_crop    = ${local.currentCrop},
              season          = ${local.season},
              soil_type       = ${local.soilType},
              irrigation_type = ${local.irrigationType},
              notes           = ${local.notes},
              updated_at      = now()
            where id = ${cloud.id} and space_id = ${membership.space_id}
            returning id, space_id, name, client_uuid
          `;
          updated.push({
            id: rows[0].id,
            clientUuid: rows[0].client_uuid,
            name: rows[0].name,
          });
        } else {
          skipped.push({
            id: cloud.id,
            clientUuid: cloud.client_uuid,
            name: cloud.name,
            reason: "exists_diff_no_overwrite",
          });
        }
      }
    }

    return { created, updated, skipped };
  });

  await audit(sql, {
    spaceId: membership.space_id,
    actorUserId,
    action: "bridge.publish_fields",
    targetType: "farm_fields",
    meta: {
      total: normalized.length,
      createdCount: results.created.length,
      updatedCount: results.updated.length,
      skippedCount: results.skipped.length,
      clientUuids,
    },
  });

  return {
    success: true,
    spaceId: membership.space_id,
    created: results.created,
    updated: results.updated,
    skipped: results.skipped,
    total: normalized.length,
  };
}
