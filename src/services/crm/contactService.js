/* CRM contacts — customers and suppliers in one store, split by type. */

import { repo } from "../erp/erpDb.js";

export const CONTACT_TYPES = [
  { id: "customer",    label: "Customer"     },
  { id: "buyer",       label: "Buyer"        },
  { id: "wholesaler",  label: "Wholesaler"   },
  { id: "retailer",    label: "Retailer"     },
  { id: "distributor", label: "Distributor"  },
  { id: "supplier",    label: "Supplier"     },
  { id: "vendor",      label: "Vendor"       },
];

const SUPPLIER_TYPES = ["supplier", "vendor"];

const contacts = repo("contacts");

export const contactService = {
  add:     (data) => contacts.add(data),
  getAll:  () => contacts.getAll(),
  getById: (id) => contacts.getById(id),
  update:  (id, patch) => contacts.update(id, patch),
  remove:  (id) => contacts.remove(id),

  getCustomers: () => contacts.getAll()
    .then((l) => l.filter((c) => !SUPPLIER_TYPES.includes(c.type))),
  getSuppliers: () => contacts.getAll()
    .then((l) => l.filter((c) => SUPPLIER_TYPES.includes(c.type))),

  isSupplier: (c) => SUPPLIER_TYPES.includes(c.type),
  typeLabel:  (id) => CONTACT_TYPES.find((t) => t.id === id)?.label ?? id,
};
