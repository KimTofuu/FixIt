"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLoader from "@/components/AdminLoader";
import AdminNavbar from "@/components/AdminNavbar";
import styles from "./admin-authorities.module.css";
import { useRouter } from "next/navigation";

interface Authority {
  _id: string;
  authorityName: string;
  department: string;
  contactEmail: string;
  class?: string;
}

interface AuthoritiesByCategory {
  [category: string]: Authority[];
}

export default function AdminAuthoritiesPage() {
  const router = useRouter();
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<Record<string, boolean>>({});
  const [draftNew, setDraftNew] = useState<Record<string, { name: string; department: string; email: string }>>({});
  const [removeMode, setRemoveMode] = useState<Record<string, boolean>>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  const fetchAuthorities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/authorities`);
      const data = await res.json();
      setAuthorities(data);
    } catch (error) {
      console.error("Error fetching authorities:", error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    void fetchAuthorities();
  }, [router, fetchAuthorities]);

  // Group by class from the Authority model
  const authoritiesByCategory = useMemo<AuthoritiesByCategory>(() => {
    const grouped: AuthoritiesByCategory = {};
    authorities.forEach(auth => {
      const category = auth.class || 'Others';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(auth);
    });
    return grouped;
  }, [authorities]);

  const saveEmail = async (category: string, id: string) => {
    const email = editing[`${category}|${id}`] ?? "";
    try {
      const res = await fetch(`${API_URL}/authorities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail: email.trim() })
      });
      if (res.ok) {
        await fetchAuthorities();
        cancelEdit(category, id);
      }
    } catch (error) {
      console.error('Error updating authority:', error);
    }
  };

  const saveAdd = async (category: string) => {
    const draft = draftNew[category];
    if (!draft?.name || !draft?.department) return;

    try {
      const res = await fetch(`${API_URL}/authorities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorityName: draft.name.trim(),
          department: draft.department.trim(),
          contactEmail: draft.email.trim() || `${draft.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
          class: category
        })
      });
      if (res.ok) {
        await fetchAuthorities();
        cancelAdd(category);
      }
    } catch (error) {
      console.error('Error adding authority:', error);
    }
  };

  const removeAuthority = async (category: string, id: string) => {
    if (!window.confirm("Remove this authority?")) return;
    
    try {
      const res = await fetch(`${API_URL}/authorities/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchAuthorities();
      }
    } catch (error) {
      console.error('Error removing authority:', error);
    }
  };

  const categories = useMemo(() => Object.keys(authoritiesByCategory), [authoritiesByCategory]);

  const handleEditChange = (category: string, id: string, value: string) => {
    setEditing((prev) => ({ ...prev, [`${category}|${id}`]: value }));
  };

  const startEdit = (category: string, a: Authority) => {
    setEditing((prev) => ({ ...prev, [`${category}|${a._id}`]: a.contactEmail || "" }));
  };

  const cancelEdit = (category: string, id: string) => {
    setEditing((prev) => {
      const cp = { ...prev };
      delete cp[`${category}|${id}`];
      return cp;
    });
  };

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

  const enableRemoveMode = (category: string) => {
    setRemoveMode((p) => ({ ...p, [category]: true }));
    setOpenMenu(null);
  };

  const exitRemoveMode = (category: string) => {
    setRemoveMode((p) => ({ ...p, [category]: false }));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return authoritiesByCategory;
    
    const out: AuthoritiesByCategory = {};
    Object.keys(authoritiesByCategory).forEach(cat => {
      const flt = authoritiesByCategory[cat].filter(a =>
        a.authorityName.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.contactEmail.toLowerCase().includes(q)
      );
      if (flt.length) out[cat] = flt;
    });
    return out;
  }, [authoritiesByCategory, search]);

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

          {loading ? (
            <div className={styles.cardLoader}>
              <AdminLoader message="Loading authorities..." />
            </div>
          ) : Object.keys(filtered).length === 0 ? (
            <p className={styles.empty}>No authorities found.</p>
          ) : (
            <div className={styles.listWrap}>
              {Object.keys(filtered).map((cat) => (
                <section key={cat} className={styles.categoryBlock}>
                  <div className={styles.categoryHeader}>
                    <h2 className={styles.categoryTitle}>
                      <span className={styles.categoryTitleBadge}>
                        {cat}
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
                      const key = `${cat}|${a._id}`;
                      const isEditing = key in editing;
                      return (
                        <div key={a._id} className={styles.row}>
                          <div className={styles.colName}>{a.authorityName}</div>
                          <div className={styles.colDept}>{a.department}</div>
                          <div className={styles.colEmail}>
                            {isEditing ? (
                              <input
                                value={editing[key]}
                                onChange={(e) => handleEditChange(cat, a._id, e.target.value)}
                                placeholder="Enter email"
                                className={styles.emailInput}
                              />)
                              : (
                                <span className={styles.emailValue}>{a.contactEmail || "—"}</span>
                              )}
                          </div>
                          <div className={styles.colActions}>
                            {removeMode[cat] ? (
                              <button className={`${styles.btn} ${styles.btnDangerOutline}`} onClick={() => removeAuthority(cat, a._id)}>Remove</button>
                            ) : isEditing ? (
                              <div className={styles.actionGroup}>
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveEmail(cat, a._id)}>Save</button>
                                <button className={`${styles.btn} ${styles.btnDangerOutline}`} onClick={() => cancelEdit(cat, a._id)}>Cancel</button>
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
