"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Head from "next/head";
import Image from "next/image";
import AdminLoader from "@/components/AdminLoader";
import styles from "./admin-users.module.css";
import AdminNavbar from "@/components/AdminNavbar";

type User = {
  _id: string;
  id?: string;
  name: string;
  email?: string;
  address?: string;
  suspended?: boolean;
  suspendedAt?: string;
  suspensionReason?: string;
  lastLogin?: string;
  reputation?: {
    points: number;
    level: string;
    totalReports: number;
  };
};

type UserStats = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalReports: number;
};

export default function AdminUserListPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended">("all");
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      
      const [usersRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/admin/users/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!usersRes.ok) {
        if (usersRes.status === 401 || usersRes.status === 403) {
          toast.error("Session expired. Please login again.");
          localStorage.clear();
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch users");
      }

      if (!statsRes.ok) throw new Error("Failed to fetch stats");

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();

      console.log("✅ Fetched users:", usersData.length);
      console.log("✅ Stats:", statsData);

      setUsers(usersData);
      setStats(statsData);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err?.message || "Failed to load data");
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [API, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Please login first");
      router.push("/login");
      return;
    }

    void fetchData();
  }, [router, fetchData]);

  const computeCredibilityLabel = (user: User) => {
    const reportsCount = user.reputation?.totalReports || 0;
    if (reportsCount === 0) return "Newcomer";
    if (reportsCount <= 2) return "Trusted";
    if (reportsCount <= 5) return "Active";
    return "Veteran";
  };

  const isActiveFromLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return false;
    const then = new Date(lastLogin).getTime();
    const diffDays = (Date.now() - then) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  const filteredAndSearchedUsers = users
    .filter((u) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "suspended") return !!u.suspended;
      const active = isActiveFromLastLogin(u.lastLogin);
      return statusFilter === "active" ? active && !u.suspended : !active && !u.suspended;
    })
    .filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.address || "").toLowerCase().includes(q) ||
        (u.id || "").toLowerCase().includes(q)
      );
    });

  const handleSuspend = async (userId: string, reason: string) => {
    setActionLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      const user = users.find((u) => u._id === userId);
      
      if (!user) throw new Error("User not found");
      if (user.suspended) throw new Error("User is already suspended");

      const res = await fetch(`${API}/admin/users/${userId}/suspend`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to suspend user");
      }

      toast.success("User suspended successfully");
      
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, suspended: true, suspendedAt: new Date().toISOString(), suspensionReason: reason } : u)));
      setShowSuspendModal(false);
      setUserToSuspend(null);
      setSuspendReason("");
      setViewingUser(null);
      
      void fetchData();
    } catch (err: any) {
      console.error("❌ Suspend error:", err);
      setError(err?.message || "Could not suspend user");
      toast.error(err?.message || "Failed to suspend user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    setActionLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API}/admin/users/${userId}/unsuspend`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to unsuspend user");
      }

      toast.success("User unsuspended successfully");
      
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, suspended: false, suspendedAt: undefined, suspensionReason: undefined } : u)));
      setViewingUser(null);
      
      void fetchData();
    } catch (err: any) {
      console.error("❌ Unsuspend error:", err);
      toast.error(err?.message || "Failed to unsuspend user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ["ID", "Name", "Email", "Location", "Reports", "Credibility", "Status", "Last Login"];
    const rows = filteredAndSearchedUsers.map(u => [
      u.id || u._id,
      u.name,
      u.email || "",
      u.address || "",
      u.reputation?.totalReports || 0,
      computeCredibilityLabel(u),
      u.suspended ? "Suspended" : isActiveFromLastLogin(u.lastLogin) ? "Active" : "Inactive",
      u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success("Users exported successfully");
  };

  const truncateId = (id: string) => {
    if (!id || id.length <= 12) return id;
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("ID copied to clipboard!");
    }).catch((err) => {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy ID");
    });
  };

  return (
    <>
      <Head>
        <title>FixIt PH - Admin Users</title>
        <link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <div className={styles.adminUsersRoot}>
        <AdminNavbar active="users" />

        <main className={styles.adminUsersMain}>
          <div className={styles.headerRow}>
            <div className={styles.controls}>   
              <div className={styles.searchWrap}>
                <input
                  aria-label="Search users"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                <i className="fa fa-search" aria-hidden />
              </div>

              <button className={styles.btn} onClick={handleExport}>
                <i className="fa fa-download" style={{ marginRight: "8px" }}></i>
                Export
              </button>
            </div>
          </div>

          {error && <div className={styles.error}><strong>Error:</strong> {error}</div>}

          <section className={styles.tableSection}>
            <div className={styles.filterRow}>
              <button className={`${styles.filterBtn} ${statusFilter === "all" ? styles.active : ""}`} onClick={() => setStatusFilter("all")}>
                All ({users.length})
              </button>
              <button className={`${styles.filterBtn} ${statusFilter === "active" ? styles.active : ""}`} onClick={() => setStatusFilter("active")}>
                Active ({users.filter(u => isActiveFromLastLogin(u.lastLogin) && !u.suspended).length})
              </button>
              <button className={`${styles.filterBtn} ${statusFilter === "inactive" ? styles.active : ""}`} onClick={() => setStatusFilter("inactive")}>
                Inactive ({users.filter(u => !isActiveFromLastLogin(u.lastLogin) && !u.suspended).length})
              </button>
              <button className={`${styles.filterBtn} ${statusFilter === "suspended" ? styles.active : ""}`} onClick={() => setStatusFilter("suspended")}>
                Suspended ({users.filter(u => u.suspended).length})
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Location</th>
                    <th>Reports</th>
                    <th>Credibility</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody className={styles.tbodyScrollable}>
                  {loading ? (
                    <tr><td colSpan={8} className={styles.emptyCell}>
                      <AdminLoader message="Loading users..." compact />
                    </td></tr>
                  ) : filteredAndSearchedUsers.length === 0 ? (
                    <tr><td colSpan={8} className={styles.emptyCell}>No users found.</td></tr>
                  ) : (
                    filteredAndSearchedUsers.map((user) => {
                      const reportsCount = user.reputation?.totalReports || 0;
                      const credibility = computeCredibilityLabel(user);
                      const isSuspended = !!user.suspended;
                      const active = isActiveFromLastLogin(user.lastLogin);
                      const fullId = user.id || user._id;

                      return (
                        <tr key={user._id} className={`${isSuspended ? styles.suspendedRow : ""}`}>
                          <td className={styles.cellId}>
                            <div className={styles.idWrapper} title={fullId}>
                              <span className={styles.idText}>{truncateId(fullId)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(fullId);
                                }}
                                className={styles.copyBtn}
                                aria-label="Copy ID"
                                title="Copy full ID"
                              >
                                <i className="fa-regular fa-copy"></i>
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className={styles.nameCell}>
                              <div className={styles.nameText}>{user.name}</div>
                              <div className={styles.subText}>
                                {user.reputation?.level || 'Newcomer'}
                              </div>
                            </div>
                          </td>
                          <td>{user.email || "N/A"}</td>
                          <td>{user.address || "No address provided"}</td>
                          <td><strong>{reportsCount}</strong></td>
                          <td><span className={`${styles.credBadge} ${styles[`cred_${credibility.toLowerCase()}`]}`}>{credibility}</span></td>
                          <td>
                            <div className={active && !isSuspended ? styles.activeStatus : styles.inactiveStatus}>
                              {isSuspended ? "Suspended" : active ? "Active" : "Inactive"}
                            </div>
                          </td>
                          <td>
                            <div className={styles.detailsCell}>
                              <button onClick={() => setViewingUser(user)} className={styles.linkBtn}>View</button>
                              {isSuspended ? (
                                <button
                                  onClick={() => handleUnsuspend(user._id)}
                                  className={`${styles.btn} ${styles.btnSuccess}`}
                                  disabled={actionLoading}
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setUserToSuspend(user._id);
                                    setShowSuspendModal(true);
                                  }}
                                  className={`${styles.btn} ${styles.btnWarning}`}
                                  disabled={actionLoading}
                                >
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showSuspendModal && userToSuspend && (
            <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={() => {
              setShowSuspendModal(false);
              setUserToSuspend(null);
              setSuspendReason("");
            }}>
              <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>Suspend User</h3>
                  <button onClick={() => {
                    setShowSuspendModal(false);
                    setUserToSuspend(null);
                    setSuspendReason("");
                  }} className={styles.linkBtn}>
                    <i className="fa fa-times"></i>
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <p>Please provide a reason for suspending this user:</p>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Enter suspension reason..."
                    className={styles.suspendReasonInput}
                    rows={4}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button
                    onClick={() => {
                      setShowSuspendModal(false);
                      setUserToSuspend(null);
                      setSuspendReason("");
                    }}
                    className={styles.btn}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSuspend(userToSuspend, suspendReason)}
                    className={`${styles.btn} ${styles.btnWarning}`}
                    disabled={actionLoading || !suspendReason.trim()}
                  >
                    {actionLoading ? "Suspending..." : "Suspend User"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewingUser && (
            <div className={styles.modalBackdrop} role="dialog" aria-modal="true" onClick={() => setViewingUser(null)}>
              <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>User Details</h3>
                  <button onClick={() => setViewingUser(null)} className={styles.linkBtn}>
                    <i className="fa fa-times"></i>
                  </button>
                </div>

                <div className={styles.modalGrid}>
                  <div className={styles.labelCol}>ID</div>
                  <div className={styles.idWrapper}>
                    <span className={styles.idText}>{viewingUser.id || viewingUser._id}</span>
                    <button
                      onClick={() => copyToClipboard(viewingUser.id || viewingUser._id)}
                      className={styles.copyBtn}
                      aria-label="Copy ID"
                      title="Copy ID"
                    >
                      <i className="fa-regular fa-copy"></i>
                    </button>
                  </div>

                  <div className={styles.labelCol}>Name</div>
                  <div>{viewingUser.name}</div>

                  <div className={styles.labelCol}>Email</div>
                  <div>{viewingUser.email || "N/A"}</div>

                  <div className={styles.labelCol}>Location</div>
                  <div>{viewingUser.address || "No address provided"}</div>

                  <div className={styles.labelCol}>Reports</div>
                  <div>{viewingUser.reputation?.totalReports || 0}</div>

                  <div className={styles.labelCol}>Reputation Points</div>
                  <div>{viewingUser.reputation?.points || 0}</div>

                  <div className={styles.labelCol}>Level</div>
                  <div>{viewingUser.reputation?.level || 'Newcomer'}</div>

                  <div className={styles.labelCol}>Credibility</div>
                  <div>{computeCredibilityLabel(viewingUser)}</div>

                  <div className={styles.labelCol}>Status</div>
                  <div>{viewingUser.suspended ? "Suspended" : isActiveFromLastLogin(viewingUser.lastLogin) ? "Active" : "Inactive"}</div>

                  {viewingUser.suspended && (
                    <>
                      <div className={styles.labelCol}>Suspended At</div>
                      <div>{viewingUser.suspendedAt ? new Date(viewingUser.suspendedAt).toLocaleString() : "N/A"}</div>

                      <div className={styles.labelCol}>Suspension Reason</div>
                      <div>{viewingUser.suspensionReason || "No reason provided"}</div>
                    </>
                  )}

                  <div className={styles.labelCol}>Last Login</div>
                  <div>{viewingUser.lastLogin ? new Date(viewingUser.lastLogin).toLocaleString() : "Never"}</div>
                </div>

                <div className={styles.modalActions}>
                  {viewingUser.suspended ? (
                    <button
                      onClick={() => handleUnsuspend(viewingUser._id)}
                      className={`${styles.btn} ${styles.btnSuccess}`}
                      disabled={actionLoading}
                    >
                      <i className="fa fa-undo" style={{ marginRight: "8px" }}></i>
                      {actionLoading ? "Unsuspending..." : "Unsuspend User"}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setUserToSuspend(viewingUser._id);
                        setShowSuspendModal(true);
                      }}
                      className={`${styles.btn} ${styles.btnWarning}`}
                      disabled={actionLoading}
                    >
                      <i className="fa fa-ban" style={{ marginRight: "8px" }}></i>
                      Suspend User
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
