export type Authority = {
  id: string;
  name: string;
  department: string;
  email?: string;
};

export type AuthoritiesByCategory = Record<string, Authority[]>;

const DEFAULT_AUTHORITIES: AuthoritiesByCategory = {
  // Olongapo City, Zambales — core infra/public works
  infrastructure: [
    { id: "infra-ceo", name: "City Engineering Office (CEO)", department: "Public Works & Infrastructure", email: "" },
    { id: "infra-ocbo", name: "Office of the City Building Official (OCBO)", department: "Building Permits & Structural Safety", email: "" },
    { id: "infra-cpdo", name: "City Planning & Development Office (CPDO)", department: "Planning, Zoning & Urban Development", email: "" },
    { id: "infra-dpwh-zam2", name: "DPWH Zambales 2nd District Engineering Office", department: "National Roads & Bridges within Olongapo", email: "" },
  ],

  // Utilities servicing Olongapo
  utilities: [
    { id: "util-subicwater", name: "Subic Water and Sewerage Company, Inc. (SUBICWATER)", department: "Water & Sewerage Utility", email: "" },
    { id: "util-oedc", name: "Olongapo Electricity Distribution Company (OEDC)", department: "Electric Distribution Utility", email: "" },
    { id: "util-pldt", name: "PLDT Olongapo", department: "Telecommunications / Landline / Fiber", email: "" },
    { id: "util-globe", name: "Globe Telecom – Olongapo", department: "Telecommunications / Mobile / Broadband", email: "" },
    { id: "util-converge", name: "Converge ICT – Olongapo", department: "Telecommunications / Fiber", email: "" },
  ],

  // Solid waste and sanitation
  "sanitation and waste": [
    { id: "san-esmo", name: "Environmental Sanitation & Management Office (ESMO)", department: "Solid Waste Management Division", email: "" },
    { id: "san-cenro", name: "City Environment & Natural Resources Office (CENRO)", department: "Environmental Management & Sanitation", email: "" },
  ],

  // Green/open spaces and environmental concerns
  "environment and public spaces": [
    { id: "env-ppmo", name: "Parks & Plaza Management Office (PPMO)", department: "City Parks, Plazas & Beautification", email: "" },
    { id: "env-cenro", name: "City Environment & Natural Resources Office (CENRO)", department: "Urban Forestry, Environment & Compliance", email: "" },
  ],

  // Safety, emergency, transport, community
  "community and safety": [
    { id: "safe-ocpo", name: "Olongapo City Police Office (OCPO)", department: "Law Enforcement", email: "" },
    { id: "safe-bfp", name: "Bureau of Fire Protection – Olongapo City", department: "Fire Safety & Emergency Response", email: "" },
    { id: "safe-cdrrmo", name: "City Disaster Risk Reduction & Management Office (CDRRMO)", department: "Disaster Preparedness & Response", email: "" },
    { id: "safe-otmps", name: "Office of Traffic Management & Public Safety (OTMPS)", department: "Traffic & Road Safety", email: "" },
    { id: "safe-brgy", name: "Barangay Office – [specify barangay]", department: "Local Barangay Government Unit", email: "" },
  ],

  // City government administration
  "government / administrative": [
    { id: "gov-admin", name: "Office of the City Administrator", department: "City Government Administration", email: "" },
    { id: "gov-mayor", name: "Office of the Mayor", department: "Executive Leadership", email: "" },
    { id: "gov-legal", name: "City Legal Office", department: "Legal Affairs & Compliance", email: "" },
    { id: "gov-council", name: "Sangguniang Panlungsod (City Council) Secretariat", department: "Legislative Support", email: "" },
  ],

  // Misc / partner agencies
  others: [
    { id: "other-sbma", name: "Subic Bay Metropolitan Authority (SBMA)", department: "Freeport Zone Jurisdiction", email: "" },
    { id: "other-dswd", name: "DSWD – Olongapo City Field Office", department: "Social Welfare & Community Support", email: "" },
    { id: "other-deped", name: "DepEd – Olongapo City Schools Division Office", department: "Public Schools & Facilities", email: "" },
  ],

  // Fallback when category is missing/unknown
  default: [
    { id: "default-mayor", name: "Office of the Mayor", department: "General Fallback", email: "" },
  ],
};

const STORAGE_KEY = "authorities_emails_v1";

export function getDefaultAuthorities(): AuthoritiesByCategory {
  // Return a deep copy to avoid accidental mutations of the singleton
  return JSON.parse(JSON.stringify(DEFAULT_AUTHORITIES));
}

export function loadAuthoritiesFromStorage(): AuthoritiesByCategory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthoritiesByCategory;
    return parsed || null;
  } catch {
    return null;
  }
}

export function saveAuthoritiesToStorage(map: AuthoritiesByCategory) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function mergeAuthorities(
  base: AuthoritiesByCategory,
  overrides: AuthoritiesByCategory | null
): AuthoritiesByCategory {
  if (!overrides) return base;
  const result: AuthoritiesByCategory = {};
  const categories = new Set([...Object.keys(base), ...Object.keys(overrides)]);
  for (const cat of categories) {
    const baseList = base[cat] || [];
    const overList = overrides[cat] || [];
    const byId = new Map<string, Authority>();
    for (const a of baseList) byId.set(a.id, { ...a });
    for (const a of overList) byId.set(a.id, { ...byId.get(a.id), ...a });
    result[cat] = Array.from(byId.values());
  }
  return result;
}

export function getAuthoritiesMap(): AuthoritiesByCategory {
  const base = getDefaultAuthorities();
  const stored = loadAuthoritiesFromStorage();
  return mergeAuthorities(base, stored);
}

export function getAuthoritiesForCategory(category: string): Authority[] {
  const map = getAuthoritiesMap();
  const key = (category || "default").toLowerCase();
  return map[key] || map["default"] || [];
}

export function updateAuthorityEmail(category: string, authorityId: string, email: string) {
  const current = getAuthoritiesMap();
  const key = (category || "default").toLowerCase();
  const list = current[key] || [];
  const idx = list.findIndex((a) => a.id === authorityId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], email };
  }
  current[key] = list;
  saveAuthoritiesToStorage(current);
}
