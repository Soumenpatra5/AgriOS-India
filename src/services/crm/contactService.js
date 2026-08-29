/* CRM contacts — customers and suppliers in one store, split by type. */

import { repo } from "../erp/erpDb.js";

/* label stays English — it is the stored contact type and goes into reports.
   i18n is what the UI shows. */
export const CONTACT_TYPES = [
  { id: "customer",    label: "Customer"     , i18n: { en: "Customer", hi: "ग्राहक", bn: "ক্রেতা" } },
  { id: "buyer",       label: "Buyer"        , i18n: { en: "Buyer", hi: "खरीदार", bn: "ক্রয়কারী" } },
  { id: "wholesaler",  label: "Wholesaler"   , i18n: { en: "Wholesaler", hi: "थोक विक्रेता", bn: "পাইকারি বিক্রেতা" } },
  { id: "retailer",    label: "Retailer"     , i18n: { en: "Retailer", hi: "फुटकर विक्रेता", bn: "খুচরা বিক্রেতা" } },
  { id: "distributor", label: "Distributor"  , i18n: { en: "Distributor", hi: "वितरक", bn: "পরিবেশক" } },
  { id: "supplier",    label: "Supplier"     , i18n: { en: "Supplier", hi: "आपूर्तिकर्ता", bn: "সরবরাহকারী" } },
  { id: "vendor",      label: "Vendor"       , i18n: { en: "Vendor", hi: "विक्रेता", bn: "বিক্রেতা" } },
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
