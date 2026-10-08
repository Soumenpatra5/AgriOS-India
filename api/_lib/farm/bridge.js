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

export { preview as previewParcels };

/* ═════════════════════════════════════════════════════════════════════════════
 * Local ERP ↔ Cloud Farm Space Bridge — Phase 2: Livestock Herd Publishing
 * ═════════════════════════════════════════════════════════════════════════════
 * Bridges device-local offline ERP animals (dairy, goat, sheep, pig) into cloud
 * Farm Space livestock registers (dairy_animals, goat_animals, pig_animals).
 * Keeps local and cloud data models strictly decoupled:
 *   - Local animal.id maps to cloud client_uuid
 *   - space_id is enforced on every operation
 *   - Requires enterprise dashboard module to be enabled in target space
 *   - Enforces farm.<enterprise>.manage permission
 *   - Strict cross-space isolation prevents asset duplication or collision
 *   - Idempotent and auditable via farm_audit_logs (action: bridge.publish_livestock)
 */

export const ENTERPRISE_MODULE_MAP = {
  dairy: "dairyDashboard",
  goat: "goatDashboard",
  sheep: "goatDashboard",
  pig: "pigDashboard",
};

export const ENTERPRISE_TABLE_MAP = {
  dairy: "dairy_animals",
  goat: "goat_animals",
  sheep: "goat_animals",
  pig: "pig_animals",
};

export function getLivestockPermission(enterprise) {
  const e = String(enterprise || "").toLowerCase().trim();
  if (e === "dairy") return "farm.dairy.manage";
  if (e === "goat" || e === "sheep") return "farm.goat.manage";
  if (e === "pig") return "farm.pig.manage";
  throw new HttpError(400, `Unsupported livestock enterprise "${enterprise}". Supported: dairy, goat, sheep, pig`);
}

export async function assertLivestockModuleEnabled(sql, spaceId, enterprise) {
  const moduleId = ENTERPRISE_MODULE_MAP[enterprise];
  if (!moduleId) {
    throw new HttpError(400, `Unsupported livestock enterprise "${enterprise}". Supported: dairy, goat, sheep, pig`);
  }
  const rows = await sql`
    select enabled
    from farm_space_modules
    where space_id = ${spaceId} and module_id = ${moduleId}
  `;
  if (rows.length > 0 && !rows[0].enabled) {
    throw new HttpError(400, `Module "${moduleId}" is disabled in target Farm Space`);
  }
}

export function normalizeDairyAnimal(record) {
  if (!record || typeof record !== "object") {
    throw new HttpError(400, "Invalid dairy animal data");
  }
  const clientUuid = record.id != null ? String(record.id).trim() : "";
  if (!clientUuid) {
    throw new HttpError(400, "Animal id is required");
  }
  const name = record.name != null ? String(record.name).trim() : "";
  if (!name) {
    throw new HttpError(400, `Animal name is required for id "${clientUuid}"`);
  }

  const rawType = String(record.type || "cow").trim().toLowerCase();
  const species = rawType === "buffalo" ? "buffalo" : "cow";
  const breed = record.breed && String(record.breed).trim() ? String(record.breed).trim() : null;
  const tagId = record.tagNo && String(record.tagNo).trim() ? String(record.tagNo).trim() : null;

  /* Lactation mapping:
   *   lactating -> milking
   *   dry -> dry
   *   pregnant -> dry
   * Note: The cloud schema has no pregnancy status. pregnant -> dry is a schema-compatible
   * fallback because the existing local and cloud status models do not represent pregnancy equivalently.
   * Unknown/missing -> fallback 'heifer' (cloud check constraint requires one of heifer|milking|dry)
   */
  const rawLact = String(record.lactationStatus || "").trim().toLowerCase();
  let currentStatus = "heifer";
  if (rawLact === "lactating") {
    currentStatus = "milking";
  } else if (rawLact === "dry" || rawLact === "pregnant") {
    currentStatus = "dry";
  } else if (rawLact === "heifer") {
    currentStatus = "heifer";
  }

  return {
    clientUuid,
    name,
    species,
    breed,
    tagId,
    currentStatus,
    dob: null,
    acquisitionDate: null,
    acquisitionSource: null,
    notes: null,
  };
}

export function normalizeGoatAnimal(record) {
  if (!record || typeof record !== "object") {
    throw new HttpError(400, "Invalid goat/sheep animal data");
  }
  const clientUuid = record.id != null ? String(record.id).trim() : "";
  if (!clientUuid) {
    throw new HttpError(400, "Animal id is required");
  }
  const name = record.name != null ? String(record.name).trim() : "";
  if (!name) {
    throw new HttpError(400, `Animal name is required for id "${clientUuid}"`);
  }

  const enterprise = String(record.enterprise || "goat").trim().toLowerCase();
  const species = enterprise === "sheep" ? "sheep" : "goat";

  const rawGender = String(record.gender || "").trim().toLowerCase();
  let sex = "unknown";
  if (rawGender === "female") {
    sex = "female";
  } else if (rawGender === "male") {
    sex = "male";
  }

  const breed = record.breed && String(record.breed).trim() ? String(record.breed).trim() : null;
  const tagId = record.tagNo && String(record.tagNo).trim() ? String(record.tagNo).trim() : null;

  /* Approved age mapping:
   *   age <= 6 months -> kid
   *   6 < age <= 12 -> grower
   *   age > 12 and male -> breeding
   *   age > 12 and female -> milking
   * Invalid/missing age -> approved fallback 'kid' (cloud table default)
   */
  const age = Number(record.ageMonths);
  let currentStatus = "kid";
  if (!Number.isNaN(age) && age > 0) {
    if (age <= 6) {
      currentStatus = "kid";
    } else if (age <= 12) {
      currentStatus = "grower";
    } else {
      currentStatus = sex === "male" ? "breeding" : "milking";
    }
  }

  return {
    clientUuid,
    name,
    species,
    sex,
    breed,
    tagId,
    currentStatus,
    dob: null,
    acquisitionDate: null,
    acquisitionSource: null,
    notes: null,
  };
}

export function normalizePigAnimal(record) {
  if (!record || typeof record !== "object") {
    throw new HttpError(400, "Invalid pig animal data");
  }
  const clientUuid = record.id != null ? String(record.id).trim() : "";
  if (!clientUuid) {
    throw new HttpError(400, "Animal id is required");
  }
  const name = record.name != null ? String(record.name).trim() : "";
  if (!name) {
    throw new HttpError(400, `Animal name is required for id "${clientUuid}"`);
  }

  const rawGender = String(record.gender || "").trim().toLowerCase();
  const age = Number(record.ageMonths);

  /* Sex mapping:
   *   male -> boar
   *   female and age > 7 -> sow
   *   female and age <= 7 -> gilt
   *   missing/invalid -> unknown
   */
  let sex = "unknown";
  if (rawGender === "male") {
    sex = "boar";
  } else if (rawGender === "female") {
    sex = (!Number.isNaN(age) && age > 7) ? "sow" : "gilt";
  }

  const breed = record.breed && String(record.breed).trim() ? String(record.breed).trim() : null;
  const tagId = record.tagNo && String(record.tagNo).trim() ? String(record.tagNo).trim() : null;

  /* Approved current_status mapping:
   *   age <= 2 -> piglet
   *   2 < age <= 5 -> grower
   *   5 < age <= 8 -> finisher
   *   age > 8 -> breeder
   * Invalid/missing age -> approved fallback 'piglet' (cloud table default)
   */
  let currentStatus = "piglet";
  if (!Number.isNaN(age) && age > 0) {
    if (age <= 2) {
      currentStatus = "piglet";
    } else if (age <= 5) {
      currentStatus = "grower";
    } else if (age <= 8) {
      currentStatus = "finisher";
    } else {
      currentStatus = "breeder";
    }
  }

  return {
    clientUuid,
    name,
    sex,
    breed,
    tagId,
    currentStatus,
    dob: null,
    acquisitionDate: null,
    acquisitionSource: null,
    notes: null,
  };
}

export function getNormalizerForEnterprise(enterprise) {
  const e = String(enterprise || "").toLowerCase().trim();
  if (e === "dairy") return normalizeDairyAnimal;
  if (e === "goat" || e === "sheep") return normalizeGoatAnimal;
  if (e === "pig") return normalizePigAnimal;
  throw new HttpError(400, `Unsupported livestock enterprise "${enterprise}". Supported: dairy, goat, sheep, pig`);
}

export function diffAnimal(enterprise, local, cloud) {
  const diffs = [];
  const check = (field, localVal, cloudVal) => {
    const l = localVal == null ? null : String(localVal).trim();
    const c = cloudVal == null ? null : String(cloudVal).trim();
    if (l !== c) {
      diffs.push({ field, local: localVal, cloud: cloudVal });
    }
  };

  check("name", local.name, cloud.name);
  if (enterprise === "dairy" || enterprise === "goat" || enterprise === "sheep") {
    check("species", local.species, cloud.species);
  }
  if (enterprise === "goat" || enterprise === "sheep" || enterprise === "pig") {
    check("sex", local.sex, cloud.sex);
  }
  check("breed", local.breed, cloud.breed);
  check("tag_id", local.tagId, cloud.tag_id);
  check("current_status", local.currentStatus, cloud.current_status);

  return diffs;
}

export async function previewLivestock(sql, membership, payload = {}) {
  const { spaceId, enterprise, animals } = payload;

  if (spaceId && String(spaceId) !== String(membership.space_id)) {
    throw new HttpError(400, "Target Farm Space mismatch");
  }

  const e = String(enterprise || "").toLowerCase().trim();
  const normalizer = getNormalizerForEnterprise(e);
  await assertLivestockModuleEnabled(sql, membership.space_id, e);

  if (!Array.isArray(animals)) {
    throw new HttpError(400, "animals must be an array");
  }

  const targetTable = ENTERPRISE_TABLE_MAP[e];

  if (animals.length === 0) {
    return {
      spaceId: membership.space_id,
      enterprise: e,
      targetTable,
      summary: { total: 0, newCount: 0, sameCount: 0, diffCount: 0, conflictCount: 0 },
      items: [],
    };
  }

  const normalized = animals.map(normalizer);
  const clientUuids = normalized.map((a) => a.clientUuid);

  let existingRows = [];
  if (e === "dairy") {
    existingRows = await sql`
      select id, space_id, name, species, breed, tag_id, current_status, client_uuid
      from dairy_animals
      where client_uuid = any(${clientUuids}) and deleted_at is null
    `;
  } else if (e === "goat" || e === "sheep") {
    existingRows = await sql`
      select id, space_id, name, species, sex, breed, tag_id, current_status, client_uuid
      from goat_animals
      where client_uuid = any(${clientUuids}) and deleted_at is null
    `;
  } else if (e === "pig") {
    existingRows = await sql`
      select id, space_id, name, breed, sex, tag_id, current_status, client_uuid
      from pig_animals
      where client_uuid = any(${clientUuids}) and deleted_at is null
    `;
  }

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
        error: "Animal is already linked to another Farm Space",
        local,
        cloud: { id: cloud.id, space_id: cloud.space_id, name: cloud.name },
        diffs: [],
      });
    } else {
      const diffs = diffAnimal(e, local, cloud);
      if (diffs.length === 0) {
        sameCount++;
        items.push({
          clientUuid: local.clientUuid,
          name: local.name,
          status: "EXISTS_SAME",
          local,
          cloud,
          diffs: [],
        });
      } else {
        diffCount++;
        items.push({
          clientUuid: local.clientUuid,
          name: local.name,
          status: "EXISTS_DIFF",
          local,
          cloud,
          diffs,
        });
      }
    }
  }

  return {
    spaceId: membership.space_id,
    enterprise: e,
    targetTable,
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

export async function publishLivestock(sql, membership, actorUserId, payload = {}) {
  const { spaceId, enterprise, animals, overwrite = false } = payload;

  if (spaceId && String(spaceId) !== String(membership.space_id)) {
    throw new HttpError(400, "Target Farm Space mismatch");
  }

  const e = String(enterprise || "").toLowerCase().trim();
  const normalizer = getNormalizerForEnterprise(e);
  await assertLivestockModuleEnabled(sql, membership.space_id, e);

  if (!Array.isArray(animals)) {
    throw new HttpError(400, "animals must be an array");
  }

  const targetTable = ENTERPRISE_TABLE_MAP[e];

  if (animals.length === 0) {
    return {
      success: true,
      spaceId: membership.space_id,
      enterprise: e,
      targetTable,
      created: [],
      updated: [],
      skipped: [],
      total: 0,
    };
  }

  const normalized = animals.map(normalizer);
  const clientUuids = normalized.map((a) => a.clientUuid);

  const runInTx = typeof sql.begin === "function" ? (fn) => sql.begin(fn) : (fn) => fn(sql);

  const results = await runInTx(async (tx) => {
    let existingRows = [];
    if (e === "dairy") {
      existingRows = await tx`
        select id, space_id, name, species, breed, tag_id, current_status, client_uuid
        from dairy_animals
        where client_uuid = any(${clientUuids}) and deleted_at is null
      `;
    } else if (e === "goat" || e === "sheep") {
      existingRows = await tx`
        select id, space_id, name, species, sex, breed, tag_id, current_status, client_uuid
        from goat_animals
        where client_uuid = any(${clientUuids}) and deleted_at is null
      `;
    } else if (e === "pig") {
      existingRows = await tx`
        select id, space_id, name, breed, sex, tag_id, current_status, client_uuid
        from pig_animals
        where client_uuid = any(${clientUuids}) and deleted_at is null
      `;
    }

    const existingMap = new Map();
    for (const row of existingRows) {
      existingMap.set(row.client_uuid, row);
    }

    // Strict cross-space isolation check: rollback entire transaction if any animal belongs elsewhere
    for (const item of normalized) {
      const existing = existingMap.get(item.clientUuid);
      if (existing && String(existing.space_id) !== String(membership.space_id)) {
        throw new HttpError(409, `Cross-space publish rejected: animal "${item.name}" already belongs to another Farm Space`);
      }
    }

    const created = [];
    const updated = [];
    const skipped = [];

    for (const local of normalized) {
      const cloud = existingMap.get(local.clientUuid);

      if (!cloud) {
        let inserted = null;
        if (e === "dairy") {
          const rows = await tx`
            insert into dairy_animals
              (space_id, name, species, breed, tag_id, current_status, client_uuid, created_by)
            values (
              ${membership.space_id}, ${local.name}, ${local.species}, ${local.breed},
              ${local.tagId}, ${local.currentStatus}, ${local.clientUuid}, ${actorUserId}
            )
            returning id, space_id, name, client_uuid
          `;
          inserted = rows[0];
        } else if (e === "goat" || e === "sheep") {
          const rows = await tx`
            insert into goat_animals
              (space_id, name, species, sex, breed, tag_id, current_status, client_uuid, created_by)
            values (
              ${membership.space_id}, ${local.name}, ${local.species}, ${local.sex}, ${local.breed},
              ${local.tagId}, ${local.currentStatus}, ${local.clientUuid}, ${actorUserId}
            )
            returning id, space_id, name, client_uuid
          `;
          inserted = rows[0];
        } else if (e === "pig") {
          const rows = await tx`
            insert into pig_animals
              (space_id, name, sex, breed, tag_id, current_status, client_uuid, created_by)
            values (
              ${membership.space_id}, ${local.name}, ${local.sex}, ${local.breed},
              ${local.tagId}, ${local.currentStatus}, ${local.clientUuid}, ${actorUserId}
            )
            returning id, space_id, name, client_uuid
          `;
          inserted = rows[0];
        }

        created.push({
          id: inserted.id,
          clientUuid: inserted.client_uuid,
          name: inserted.name,
        });
      } else {
        const diffs = diffAnimal(e, local, cloud);

        if (diffs.length === 0) {
          skipped.push({
            id: cloud.id,
            clientUuid: cloud.client_uuid,
            name: cloud.name,
            reason: "already_synced",
          });
        } else if (overwrite) {
          let updatedRow = null;
          if (e === "dairy") {
            const rows = await tx`
              update dairy_animals set
                name = ${local.name},
                species = ${local.species},
                breed = ${local.breed},
                tag_id = ${local.tagId},
                current_status = ${local.currentStatus},
                updated_at = now()
              where id = ${cloud.id} and space_id = ${membership.space_id}
              returning id, space_id, name, client_uuid
            `;
            updatedRow = rows[0];
          } else if (e === "goat" || e === "sheep") {
            const rows = await tx`
              update goat_animals set
                name = ${local.name},
                species = ${local.species},
                sex = ${local.sex},
                breed = ${local.breed},
                tag_id = ${local.tagId},
                current_status = ${local.currentStatus},
                updated_at = now()
              where id = ${cloud.id} and space_id = ${membership.space_id}
              returning id, space_id, name, client_uuid
            `;
            updatedRow = rows[0];
          } else if (e === "pig") {
            const rows = await tx`
              update pig_animals set
                name = ${local.name},
                sex = ${local.sex},
                breed = ${local.breed},
                tag_id = ${local.tagId},
                current_status = ${local.currentStatus},
                updated_at = now()
              where id = ${cloud.id} and space_id = ${membership.space_id}
              returning id, space_id, name, client_uuid
            `;
            updatedRow = rows[0];
          }

          updated.push({
            id: updatedRow.id,
            clientUuid: updatedRow.client_uuid,
            name: updatedRow.name,
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
    action: "bridge.publish_livestock",
    targetType: targetTable,
    meta: {
      enterprise: e,
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
    enterprise: e,
    targetTable,
    created: results.created,
    updated: results.updated,
    skipped: results.skipped,
    total: normalized.length,
  };
}
