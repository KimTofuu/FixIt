"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import styles from "./admin-authorities.module.css";
import {
  Authority,
  AuthoritiesByCategory,
  getAuthoritiesMap,
  saveAuthoritiesToStorage,
} from "@/data/authorities";

export default function AdminAuthoritiesPage() {
  const [authorities, setAuthorities] = useState<AuthoritiesByCategory>({});
  const [editing, setEditing] = useState<Record<string, string>>({}); // key: `${category}|${id}` -> email
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null); // category for kebab
  const [addingFor, setAddingFor] = useState<Record<string, boolean>>({}); // category -> adding row visible
  const [draftNew, setDraftNew] = useState<Record<string, { name: string; department: string; email: string }>>({});
  const [removeMode, setRemoveMode] = useState<Record<string, boolean>>({}); // category -> removal mode on

  useEffect(() => {
    // Load from storage merged with defaults
    setAuthorities(getAuthoritiesMap());
  }, []);

  const categories = useMemo(() => Object.keys(authorities), [authorities]);

  const handleEditChange = (category: string, id: string, value: string) => {
    setEditing((prev) => ({ ...prev, [`${category}|${id}`]: value }));
  };

  const startEdit = (category: string, a: Authority) => {
    setEditing((prev) => ({ ...prev, [`${category}|${a.id}`]: a.email || "" }));
  };

  const cancelEdit = (category: string, id: string) => {
    setEditing((prev) => {
      const cp = { ...prev };
      delete cp[`${category}|${id}`];
      return cp;
    });
  };

  const saveEmail = (category: string, id: string) => {
    const key = `${category}|${id}`;
    const email = editing[key] ?? "";
    const next: AuthoritiesByCategory = JSON.parse(JSON.stringify(authorities));
    const list = next[category] || [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx].email = email.trim();
      next[category] = list;
      setAuthorities(next);
      saveAuthoritiesToStorage(next);
    }
    cancelEdit(category, id);
  };

  // Reset to defaults removed per request

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const beginAdd = (category: string) => {
    setAddingFor((p) => ({ ...p, [category]: true }));
    setDraftNew((p) => ({ ...p, [category]: { name: "", department: "", email: "" } }));
    setOpenMenu(null);
  };

  const cancelAdd = (category: string) => {
    setAddingFor((p) => ({ ...p, [category]: false }));
    setDraftNew((p) => {
      const cp = { ...p };
      delete cp[category];
      return cp;
    });
  };

  const saveAdd = (category: string) => {
    const draft = draftNew[category] || { name: "", department: "", email: "" };
    const name = draft.name.trim();
    const department = draft.department.trim();
    const email = draft.email.trim();
    if (!name || !department) return; // simple guard

    const next: AuthoritiesByCategory = JSON.parse(JSON.stringify(authorities));
    const list = next[category] || [];
    // generate unique id
    const baseId = `${category.slice(0, 3)}-${slugify(name)}`;
    let id = baseId || `${category.slice(0, 3)}-${Date.now()}`;
    let i = 1;
    const existingIds = new Set(list.map((x) => x.id));
    while (existingIds.has(id)) {
      id = `${baseId}-${i++}`;
    }
    list.push({ id, name, department, email });
    next[category] = list;
    setAuthorities(next);
    saveAuthoritiesToStorage(next);
    cancelAdd(category);
  };

  const enableRemoveMode = (category: string) => {
    setRemoveMode((p) => ({ ...p, [category]: true }));
    setOpenMenu(null);
  };

  const exitRemoveMode = (category: string) => {
    setRemoveMode((p) => ({ ...p, [category]: false }));
  };

  const removeAuthority = (category: string, id: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Remove this authority?");
      if (!ok) return;
    }
    const next: AuthoritiesByCategory = JSON.parse(JSON.stringify(authorities));
    const list = next[category] || [];
    next[category] = list.filter((x) => x.id !== id);
    setAuthorities(next);
    saveAuthoritiesToStorage(next);
  };

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return authorities;
    const out: AuthoritiesByCategory = {};
    for (const cat of Object.keys(authorities)) {
      const list = authorities[cat] || [];
      const flt = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q) ||
          (a.email || "").toLowerCase().includes(q)
      );
      if (flt.length) out[cat] = flt;
    }
    return out;
  }, [authorities, search]);

  return (
    <div className={styles.pageRoot}>
      <AdminNavbar active="authorities" />

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Authorities</h1>
            <div className={styles.headerActions}>
              <input
                className={styles.search}
                placeholder="Search name, department, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {Object.keys(filtered).length === 0 ? (
            <p className={styles.empty}>No authorities found.</p>
          ) : (
            <div className={styles.listWrap}>
              {Object.keys(filtered).map((cat) => (
                <section key={cat} className={styles.categoryBlock}>
                  <div className={styles.categoryHeader}>
                    <h2 className={styles.categoryTitle}>
                      <span className={styles.categoryTitleBadge}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                    </h2>
                    <div className={styles.kebabWrap}>
                      <button
                        className={styles.kebabButton}
                        aria-haspopup="menu"
                        aria-expanded={openMenu === cat}
                        onClick={() => setOpenMenu((m) => (m === cat ? null : cat))}
                        title="Category actions"
                      >
                        <span className={styles.kebabDot}></span>
                        <span className={styles.kebabDot}></span>
                        <span className={styles.kebabDot}></span>
                      </button>
                      {openMenu === cat && (
                        <div className={styles.kebabMenu} role="menu">
                          <button className={styles.kebabItem} role="menuitem" onClick={() => beginAdd(cat)}>
                            Add authority
                          </button>
                          <button className={styles.kebabItem} role="menuitem" onClick={() => enableRemoveMode(cat)}>
                            Remove authority
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.table}>
                    {removeMode[cat] && (
                      <div className={styles.removalBanner}>
                        <span>Removal mode is ON for this category.</span>
                        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => exitRemoveMode(cat)}>
                          Done
                        </button>
                      </div>
                    )}
                    {addingFor[cat] && (
                      <div className={styles.row}>
                        <div className={styles.colName}>
                          <input
                            className={styles.textInput}
                            placeholder="Authority name"
                            value={draftNew[cat]?.name || ""}
                            onChange={(e) => setDraftNew((p) => ({ ...p, [cat]: { ...(p[cat] || { name: "", department: "", email: "" }), name: e.target.value } }))}
                          />
                        </div>
                        <div className={styles.colDept}>
                          <input
                            className={styles.textInput}
                            placeholder="Department"
                            value={draftNew[cat]?.department || ""}
                            onChange={(e) => setDraftNew((p) => ({ ...p, [cat]: { ...(p[cat] || { name: "", department: "", email: "" }), department: e.target.value } }))}
                          />
                        </div>
                        <div className={styles.colEmail}>
                          <input
                            className={styles.emailInput}
                            placeholder="Email (optional)"
                            value={draftNew[cat]?.email || ""}
                            onChange={(e) => setDraftNew((p) => ({ ...p, [cat]: { ...(p[cat] || { name: "", department: "", email: "" }), email: e.target.value } }))}
                          />
                        </div>
                        <div className={styles.colActions}>
                          <div className={styles.actionGroup}>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveAdd(cat)}>Save</button>
                            <button className={`${styles.btn} ${styles.btnDangerOutline}`} onClick={() => cancelAdd(cat)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={`${styles.row} ${styles.rowHead}`}>
                      <div className={styles.colName}>Authority</div>
                      <div className={styles.colDept}>Department</div>
                      <div className={styles.colEmail}>Email</div>
                      <div className={styles.colActions}>Actions</div>
                    </div>
                    {(filtered[cat] || []).map((a) => {
                      const key = `${cat}|${a.id}`;
                      const isEditing = key in editing;
                      return (
                        <div key={a.id} className={styles.row}>
                          <div className={styles.colName}>{a.name}</div>
                          <div className={styles.colDept}>{a.department}</div>
                          <div className={styles.colEmail}>
                            {isEditing ? (
                              <input
                                value={editing[key]}
                                onChange={(e) => handleEditChange(cat, a.id, e.target.value)}
                                placeholder="Enter email"
                                className={styles.emailInput}
                              />)
                              : (
                                <span className={styles.emailValue}>{a.email || "—"}</span>
                              )}
                          </div>
                          <div className={styles.colActions}>
                            {removeMode[cat] ? (
                              <button className={`${styles.btn} ${styles.btnDangerOutline}`} onClick={() => removeAuthority(cat, a.id)}>Remove</button>
                            ) : isEditing ? (
                              <div className={styles.actionGroup}>
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveEmail(cat, a.id)}>Save</button>
                                <button className={`${styles.btn} ${styles.btnDangerOutline}`} onClick={() => cancelEdit(cat, a.id)}>Cancel</button>
                              </div>
                            ) : (
                              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => startEdit(cat, a)}>Edit</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
