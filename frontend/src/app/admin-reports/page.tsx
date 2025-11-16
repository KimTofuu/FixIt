"use client";

import { useState, useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./AdminReports.module.css";
import Image from "next/image";
import { toast } from "react-toastify";
import AdminLoader from "@/components/AdminLoader";
import AdminNavbar from "@/components/AdminNavbar";
import { getAuthoritiesForCategory } from "@/data/authorities";
import { useRouter } from "next/navigation";

interface ReportComment {
  _id?: string;
  id?: string;
  userId?: string | { _id?: unknown; id?: unknown; $oid?: string } | null;
  user?: string;
  fName?: string;
  lName?: string;
  email?: string;
  barangay?: string;
  municipality?: string;
  profilePicture?: string;
  text: string;
  createdAt?: string;
  editedAt?: string | Date | null;
}

interface User {
  fName: string;
  lName: string;
  avatarUrl?: string;
  profilePicture?: { url?: string };
}

interface Report {
  _id: string;
  title: string;
  status: "awaiting-approval" | "pending" | "in-progress" | "resolved";
  location: string;
  timestamp: string;
  description: string;
  category?: string;
  imageUrl?: string;
  image?: string;
  images?: string[];
  videos?: string[];
  isUrgent?: boolean;
  user?: User;
  comments?: ReportComment[];
  summary?: string;
  resolvedAt?: string;
  originalReportId?: string;
  createdAt?: string;
  updatedAt?: string;
}

type AdminStatusFilter = "awaiting-approval" | "pending" | "in-progress" | "resolved";

const formatTimeAgo = (timestamp?: string): string => {
  if (!timestamp) return "";
  const t = new Date(timestamp).getTime();
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const resolveIdString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string" && value.trim() && value !== "[object Object]") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "object") {
    const obj = value as { [key: string]: unknown };
    if (typeof obj.$oid === "string") {
      return obj.$oid;
    }
    if (typeof (obj as { toString?: () => string }).toString === "function") {
      const asString = (obj as { toString: () => string }).toString();
      if (asString && asString !== "[object Object]") {
        return asString;
      }
    }
    const nestedKeys = ["_id", "id", "$id"];
    for (const key of nestedKeys) {
      const nested = resolveIdString(obj[key]);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<AdminStatusFilter>("awaiting-approval");
  const [searchTerm, setSearchTerm] = useState("");
  const [authorityModalOpen, setAuthorityModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string | null>(null);
  const [selectedAuthorityEmail, setSelectedAuthorityEmail] = useState<string>("");
  const [authorities, setAuthorities] = useState<any[]>([]); // Add this state

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<string[]>([]);
  const [rejectOther, setRejectOther] = useState("");

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentReportImages, setCurrentReportImages] = useState<string[]>([]);

  const [showCommenterModal, setShowCommenterModal] = useState(false);
  const [activeCommenter, setActiveCommenter] = useState<ReportComment | null>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ reportId: string; commentId: string } | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{ reportId: string; commentId: string; commentText?: string } | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const verificationEmail = "johnnabunturan1029384756@gmail.com"; // fallback only

  const currentUserId: string | null = null;
  const currentUserEmail: string | null = null;

  const getCommenterFirstName = (comment: ReportComment) => {
    if (comment.fName && comment.fName.trim().length > 0) {
      return comment.fName.trim();
    }
    if (comment.user && comment.user.trim().length > 0) {
      return comment.user.trim().split(" ")[0];
    }
    if (comment.lName && comment.lName.trim().length > 0) {
      return comment.lName.trim();
    }
    return "Resident";
  };

  const getCommenterFullName = (comment: ReportComment) => {
    const composed = `${comment.fName || ""} ${comment.lName || ""}`.trim();
    if (composed.length > 0) {
      return composed;
    }
    if (comment.user && comment.user.trim().length > 0) {
      return comment.user.trim();
    }
    return getCommenterFirstName(comment);
  };

  const openCommenterModal = (comment: ReportComment) => {
    setActiveCommenter(comment);
    setShowCommenterModal(true);
  };

  const closeCommenterModal = () => {
    setShowCommenterModal(false);
    setActiveCommenter(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        let endpoint;
        if (activeStatus === "resolved") {
          endpoint = `${process.env.NEXT_PUBLIC_API_URL}/reports/admin/resolved-reports`;
        } else if (activeStatus === "awaiting-approval") {
          endpoint = `${process.env.NEXT_PUBLIC_API_URL}/reports/admin/reports-for-approval`;
        } else {
          endpoint = `${process.env.NEXT_PUBLIC_API_URL}/reports`;
        }

        const token = localStorage.getItem("token");
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let errorMessage = `Error: ${res.statusText}`;
          try {
            const errorData = await res.json();
            errorMessage = `Error: ${errorData.message || res.statusText}`;
          } catch (e) {
            const errorText = await res.text();
            errorMessage = `Error: ${errorText || res.statusText}`;
          }
          console.error("Failed to fetch reports:", errorMessage);
          toast.error(errorMessage);
          setReports([]);
          return;
        }

        const data = await res.json();

        const normalized = Array.isArray(data)
          ? data.map((r: any) => ({
              ...r,
              status: String(r.status ?? "").toLowerCase(),
            }))
          : data;

        if (activeStatus === "resolved" || activeStatus === "awaiting-approval") {
          setReports(normalized);
        } else {
          const filteredData = normalized.filter(
            (report: Report) => (report.status ?? "").toLowerCase() === activeStatus
          );
          setReports(filteredData);
        }
      } catch (err) {
        console.error("A network or other error occurred:", err);
        toast.error("Could not connect to the server.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [activeStatus]);

  const toggleBookmark = (id: string) => {
    console.log("Bookmark toggled for:", id);
  };

  const addComment = async (reportId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${reportId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ text: trimmed }),
      });

      if (res.ok) {
        const updatedComments = await res.json();
        setReports((prev) =>
          prev.map((report) =>
            report._id === reportId ? { ...report, comments: updatedComments } : report
          )
        );
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Failed to add comment");
      }
    } catch (error) {
      console.error("addComment error", error);
      toast.error("Failed to add comment");
    }
  };

  const updateComment = async (reportId: string, commentId: string, text: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${reportId}/comment/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const updatedComments = await res.json();
        setReports((prev) =>
          prev.map((report) =>
            report._id === reportId ? { ...report, comments: updatedComments } : report
          )
        );
        toast.success("Comment updated");
        setOpenCommentMenu(null);
        setEditingComment(null);
        setEditingCommentText("");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Failed to update comment");
      }
    } catch (error) {
      console.error("updateComment error", error);
      toast.error("Failed to update comment");
    }
  };

  const deleteComment = async (reportId: string, commentId: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${reportId}/comment/${encodeURIComponent(commentId)}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (res.ok) {
        const updatedComments = await res.json();
        setReports((prev) =>
          prev.map((report) =>
            report._id === reportId ? { ...report, comments: updatedComments } : report
          )
        );
        toast.success("Comment deleted");
        if (editingComment && editingComment.commentId === commentId) {
          setEditingComment(null);
          setEditingCommentText("");
        }
        setOpenCommentMenu(null);
        return true;
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Failed to delete comment");
        return false;
      }
    } catch (error) {
      console.error("deleteComment error", error);
      toast.error("Failed to delete comment");
      return false;
    }
  };

  const handleStartEditComment = (reportId: string, comment: ReportComment) => {
    const commentId = resolveIdString(comment._id) || resolveIdString(comment.id);
    if (!commentId) {
      toast.error("Unable to edit this comment right now.");
      return;
    }
    setEditingComment({ reportId, commentId });
    setEditingCommentText(comment.text || "");
    setOpenCommentMenu(null);
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
    setEditingCommentText("");
  };

  const handleSubmitEditedComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingComment) return;

    const trimmed = editingCommentText.trim();
    if (!trimmed) {
      toast.error("Comment cannot be empty");
      return;
    }

    const report = reports.find((r) => r._id === editingComment.reportId);
    const existingComment = report?.comments?.find((c) => {
      const commentId = resolveIdString(c._id) || resolveIdString(c.id);
      return commentId === editingComment.commentId;
    });

    if (existingComment && (existingComment.text ?? "").trim() === trimmed) {
      toast.info("No changes to save");
      handleCancelEditComment();
      return;
    }

    await updateComment(editingComment.reportId, editingComment.commentId, trimmed);
  };

  const handleRequestDeleteComment = (reportId: string, commentId?: string, commentText?: string) => {
    if (!commentId) {
      toast.error("Unable to delete this comment right now.");
      return;
    }

    const normalizedCommentId = resolveIdString(commentId);
    if (!normalizedCommentId) {
      toast.error("Unable to delete this comment right now.");
      return;
    }

    setOpenCommentMenu(null);
    setPendingDeleteComment({ reportId, commentId: normalizedCommentId, commentText });
  };

  const handleCancelDeleteComment = () => {
    setPendingDeleteComment(null);
  };

  const handleConfirmDeleteComment = async () => {
    if (!pendingDeleteComment) return;
    const { reportId, commentId } = pendingDeleteComment;
    const success = await deleteComment(reportId, commentId);
    if (success) {
      setPendingDeleteComment(null);
    }
  };

  const handleApproveReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/admin/reports/${reportId}/approve`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
        toast.success("Report approved and moved to pending.");
      } else {
        toast.error("Failed to approve report.");
      }
    } catch (err) {
      toast.error("An error occurred while approving the report.");
    }
  };

  const openRejectModal = (report: Report) => {
    setSelectedReport(report);
    setRejectReasons([]);
    setRejectOther("");
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    setSelectedReport(null);
    setRejectReasons([]);
    setRejectOther("");
    setRejectModalOpen(false);
  };

  const submitReject = async () => {
    if (!selectedReport) return;
    try {
      const token = localStorage.getItem("token");
      const reasons = rejectOther.trim()
        ? [...rejectReasons, rejectOther.trim()]
        : rejectReasons;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/admin/reports/${selectedReport._id}/reject`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reasons }),
        }
      );
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r._id !== selectedReport._id));
        toast.success("Report rejected.");
        closeRejectModal();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to reject report.");
      }
    } catch (err) {
      console.error("Reject report error:", err);
      toast.error("An error occurred while rejecting the report.");
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: AdminStatusFilter) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/admin/reports/${reportId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        if (newStatus === "resolved") {
          setReports((prev) => prev.filter((r) => r._id !== reportId));
          toast.success("Report resolved and moved to resolved reports!");
        } else {
          setReports((prev) =>
            prev.map((r) =>
              r._id === reportId ? { ...r, status: newStatus as Report["status"] } : r
            )
          );
          toast.success("Report status updated");
        }
      } else {
        toast.error("Failed to update report status");
      }
    } catch (err) {
      toast.error("An error occurred while updating report status");
    }
  };

  const filteredReports = useMemo(() => {
    let filtered: Report[] = reports ?? [];
    if (activeStatus !== "resolved" && activeStatus !== "awaiting-approval") {
      filtered = filtered.filter(
        (r) => (r.status ?? "").toLowerCase() === activeStatus.toLowerCase()
      );
    }

    const term = (searchTerm ?? "").toLowerCase().trim();
    return filtered.filter((r) => {
      const title = (r.title ?? "").toLowerCase();
      const location = (r.location ?? "").toLowerCase();
      return title.includes(term) || location.includes(term);
    });
  }, [reports, activeStatus, searchTerm]);

  const openLightbox = (images: string[], index: number) => {
    setCurrentReportImages(images);
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setCurrentImageIndex(0);
    setCurrentReportImages([]);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === currentReportImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? currentReportImages.length - 1 : prev - 1
    );
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentReportImages.length]);

  useEffect(() => {
    if (!showCommenterModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCommenterModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showCommenterModal]);

  useEffect(() => {
    if (!openCommentMenu) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(`[data-comment-menu-key="${openCommentMenu}"]`)) {
        return;
      }
      setOpenCommentMenu(null);
    };

    document.addEventListener('click', handleClickAway);
    return () => document.removeEventListener('click', handleClickAway);
  }, [openCommentMenu]);

  // Authorities are now managed in a shared module and editable via Admin Authorities page
  const getAuthoritiesForReport = async (report: Report) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/authorities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        // Filter by category class if needed
        const categoryMap: Record<string, string> = {
          'infrastructure': 'Infrastructure',
          'utilities': 'Utilities',
          'sanitation': 'Sanitation and Waste',
          'waste': 'Sanitation and Waste',
          'environment': 'Environment and Public Spaces',
          'safety': 'Community and Safety',
          'community': 'Community and Safety',
          'government': 'Government / Administrative',
        };
        
        const reportCategory = (report.category ?? "").toLowerCase();
        const matchedClass = Object.entries(categoryMap).find(([key]) => 
          reportCategory.includes(key)
        )?.[1];
        
        return matchedClass 
          ? data.filter((a: any) => a.class === matchedClass)
          : data.filter((a: any) => a.class === 'Default' || a.class === 'Others');
      }
      return [];
    } catch (error) {
      console.error('Error fetching authorities:', error);
      return [];
    }
  };

  const openAuthorityModal = async (report: Report) => {
    setSelectedReport(report);
    setSelectedAuthorityId(null);
    setSelectedAuthorityEmail("");
    
    // Fetch authorities from database
    const fetchedAuthorities = await getAuthoritiesForReport(report);
    setAuthorities(fetchedAuthorities);
    
    setAuthorityModalOpen(true);
  };

  const closeAuthorityModal = () => {
    setSelectedReport(null);
    setSelectedAuthorityId(null);
    setSelectedAuthorityEmail("");
    setAuthorityModalOpen(false);
  };

  const sendReportToAuthority = async (contactEmail: string) => {
    if (!selectedReport) {
      toast.error("No report selected.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/${selectedReport._id}/notify-authority`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authorityEmail: contactEmail,
          reportId: selectedReport._id,
        }),
      });
      if (res.ok) {
        toast.success("Report sent to verification email.");
        closeAuthorityModal();
      } else {
        const data = await res.json();
        toast.error(data?.message || "Failed to send report to authority.");
      }
    } catch (err) {
      console.error("Error sending to authority:", err);
      toast.error("An error occurred while sending the report.");
    }
  };

  return (
    <div className={styles.adminReportsRoot}>
        <AdminNavbar active="reports" />

      <div className={styles.reportsPage}>
        <main className={styles.mainContainer}>
          <div className={styles.contentCard}>
            <div className={styles.toolbarWrapper}>
              <div className={styles.toolbar}>
                <div className={styles.toggleGroup}>
                  {(["awaiting-approval", "pending", "in-progress", "resolved"] as AdminStatusFilter[]).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => setActiveStatus(status)}
                        className={[
                          styles.toggleButton,
                          styles[`status_${status.replace("-", "_")}` as keyof typeof styles],
                          activeStatus === status ? styles.active : "",
                        ].join(" ")}
                      >
                        {status.charAt(0).toUpperCase() +
                          status.slice(1).replace("-", " ")}
                      </button>
                    )
                  )}
                </div>

                <div className={styles.searchWrap}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by title or location"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div id="admin-reportList" className={styles.reportList} role="region" aria-label="Reports list">
              {isLoading ? (
                <AdminLoader message="Loading reports..." className={styles.loadingText} />
              ) : filteredReports.length > 0 ? (
                filteredReports.map((r) => (
                  <div className={styles.adminReportCard} key={r._id}>
                    <div className={styles.reportsRow}>
                      <div className={styles.reportMain}>
                        <div className={styles.reportMetaRow}>
                          <Image
                            src={
                              (r.user?.profilePicture?.url as string) ||
                              (r.user?.avatarUrl as string) ||
                              "/images/sample_avatar.png"
                            }
                            className={styles.reportAvatar}
                            alt="Avatar"
                            width={36}
                            height={36}
                          />
                          <div className={styles.userMetaInline}>
                            <span className={styles.reportUser}>
                              {r.user?.fName && r.user?.lName
                                ? `${r.user.fName} ${r.user.lName}`
                                : 'Unknown User'}
                            </span>
                            <span className={styles.reportTime}>
                              {formatTimeAgo(r.timestamp || r.createdAt || r.updatedAt)}
                            </span>
                          </div>
                          <span className={styles.categoryPill}>{r.category ?? "Unspecified"}</span>
                          <button
                            id={`bookmark-${r._id}`}
                            className={styles.bookmarkBtn}
                            onClick={() => toggleBookmark(r._id)}
                            aria-label="Bookmark report"
                          >
                            <i className="fa-regular fa-bookmark" />
                          </button>
                        </div>

                        <h3 className={styles.reportTitle}>{r.title}</h3>

                        <p className={styles.reportLocation}>
                          <i className="fa-solid fa-location-dot" /> {r.location}
                        </p>
                        <p className={styles.reportDetails}>{r.description}</p>

                        {activeStatus === "awaiting-approval" ? (
                          <div className={styles.approvalActions}>
                            <button
                              onClick={() => handleApproveReport(r._id)}
                              className={`${styles.actionBtn} ${styles.approveBtn}`}
                            >
                              <i className="fa-solid fa-check" /> Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(r)}
                              className={`${styles.actionBtn} ${styles.rejectBtnOutline}`}
                            >
                              <i className="fa-solid fa-xmark" /> Reject
                            </button>
                          </div>
                        ) : (
                          <div className={styles.statusControl}>
                            <label className={styles.statusLabel}>Status</label>
                            <select
                              value={activeStatus === 'resolved' ? 'resolved' : (r.status || 'pending')}
                              onChange={(e) =>
                                updateReportStatus(
                                  r._id,
                                  e.target.value as AdminStatusFilter
                                )
                              }
                              className={styles.statusSelect}
                            >
                              <option value="pending">Pending</option>
                              <option value="in-progress">Processing</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                        )}

                        {activeStatus === "pending" && (
                          <div className={styles.reportToAuthoritiesWrap}>
                            <button
                              className={`${styles.actionBtn} ${styles.reportToAuthoritiesBtn}`}
                              onClick={() => openAuthorityModal(r)}
                            >
                              Report to Authorities
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={styles.reportImage}>
                        {(() => {
                          const allImages = (r.images && r.images.length > 0)
                            ? r.images
                            : r.imageUrl
                            ? [r.imageUrl]
                            : r.image
                            ? [r.image]
                            : [];

                          if (allImages.length === 0) {
                            return <div className={styles.noImageProvided}>No image provided</div>;
                          }

                          const galleryClass = [
                            styles.reportImageGallery,
                            allImages.length === 1 ? styles.oneImage : "",
                            allImages.length === 2 ? styles.twoImages : "",
                          ].filter(Boolean).join(" ");

                          const displayImages = allImages.slice(0, 4);
                          const totalImages = allImages.length;

                          return (
                            <div className={galleryClass}>
                              {displayImages.map((img, idx) => {
                                const isLastImage = idx === 3 && totalImages > 4;
                                return (
                                  <div
                                    key={idx}
                                    className={styles.reportImageItem}
                                    onClick={() => openLightbox(allImages, idx)}
                                    style={{ position: 'relative', cursor: 'pointer' }}
                                  >
                                    <img
                                      src={img}
                                      alt={`Report Image ${idx + 1}`}
                                      className={styles.inlineImage}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/images/broken-streetlights.jpg";
                                      }}
                                    />
                                    {isLastImage && (
                                      <div className={styles.imageOverlay}>
                                        <span className={styles.overlayText}>+{totalImages - 3}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {activeStatus !== "awaiting-approval" && (
                      <div className={styles.reportComments}>
                        <h4 className={styles.commentsTitle}>Comments</h4>
                        <ul className={styles.commentList}>
                          {(r.comments ?? []).map((c, idx) => {
                            const firstName = getCommenterFirstName(c);
                            const commentOwnerId = resolveIdString(c.userId);
                            const commentId = resolveIdString(c._id) || resolveIdString(c.id) || "";
                            const commentMenuKey = `${r._id}:${commentId || idx}`;
                            const ownsById = Boolean(
                              currentUserId && commentOwnerId && String(commentOwnerId) === String(currentUserId)
                            );
                            const commentEmail = c.email ? c.email.toLowerCase() : null;
                            const ownsByEmail = Boolean(
                              currentUserEmail && commentEmail && commentEmail === currentUserEmail
                            );
                            const canManageComment = Boolean(commentId && (ownsById || ownsByEmail));
                            const isEditing =
                              canManageComment &&
                              editingComment?.reportId === r._id &&
                              editingComment.commentId === commentId;
                            const createdLabel = c.createdAt ? new Date(c.createdAt).toLocaleString() : null;
                            const editedLabel = c.editedAt ? new Date(c.editedAt).toLocaleString() : null;

                            return (
                              <li key={c._id ?? `${r._id}-comment-${idx}`} className={styles.commentItem}>
                                <div className={styles.commentHeader}>
                                  <div className={styles.commentHeaderMain}>
                                    <button
                                      type="button"
                                      className={styles.commentAuthor}
                                      onClick={() => openCommenterModal(c)}
                                      aria-label={`View ${firstName}'s details`}
                                    >
                                      {firstName}
                                    </button>
                                    {createdLabel && (
                                      <span className={styles.commentTimestamp}>{createdLabel}</span>
                                    )}
                                    {c.editedAt && (
                                      <span
                                        className={styles.commentEdited}
                                        title={editedLabel ? `Edited ${editedLabel}` : "Edited"}
                                      >
                                        Edited
                                      </span>
                                    )}
                                  </div>

                                  {canManageComment && (
                                    <div className={styles.commentMenu} data-comment-menu-key={commentMenuKey}>
                                      <button
                                        type="button"
                                        className={styles.commentMenuButton}
                                        aria-label="Comment options"
                                        aria-haspopup="true"
                                        aria-expanded={openCommentMenu === commentMenuKey}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenCommentMenu((prev) =>
                                            prev === commentMenuKey ? null : commentMenuKey
                                          );
                                        }}
                                      >
                                        <span className={styles.commentMenuIcon} aria-hidden="true">⋮</span>
                                      </button>

                                      {openCommentMenu === commentMenuKey && (
                                        <div
                                          className={styles.commentMenuPanel}
                                          role="menu"
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            className={styles.commentMenuAction}
                                            role="menuitem"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleStartEditComment(r._id, c);
                                            }}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            className={`${styles.commentMenuAction} ${styles.commentMenuDanger}`}
                                            role="menuitem"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleRequestDeleteComment(r._id, commentId, c.text);
                                            }}
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {isEditing ? (
                                  <form className={styles.commentEditForm} onSubmit={handleSubmitEditedComment}>
                                    <textarea
                                      className={styles.commentEditTextarea}
                                      value={editingCommentText}
                                      onChange={(event) => setEditingCommentText(event.target.value)}
                                      rows={3}
                                    />
                                    <div className={styles.commentEditActions}>
                                      <button
                                        type="button"
                                        className={styles.commentEditCancel}
                                        onClick={handleCancelEditComment}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        className={`${styles.commentEditButton} btn btnPrimary`}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <p className={styles.commentText}>{c.text}</p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <input
                          type="text"
                          className={styles.commentInput}
                          placeholder="Add a comment..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
                              addComment(r._id, e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className={styles.noReportsText}>No reports found</p>
              )}
            </div>
          </div>
        </main>
      </div>

      {showCommenterModal && activeCommenter && (
        <div
          className={styles.commenterOverlay}
          role="dialog"
          aria-modal="true"
          onClick={closeCommenterModal}
        >
          <div
            className={styles.commenterCard}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.commenterClose}
              onClick={closeCommenterModal}
              aria-label="Close commenter details"
            >
              ✕
            </button>
            <div className={styles.commenterHeader}>
              {activeCommenter.profilePicture ? (
                <Image
                  src={activeCommenter.profilePicture}
                  alt={`${getCommenterFullName(activeCommenter)} avatar`}
                  width={64}
                  height={64}
                  className={styles.commenterAvatar}
                />
              ) : (
                <div className={styles.commenterAvatarFallback}>
                  {getCommenterFirstName(activeCommenter).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className={styles.commenterName}>{getCommenterFullName(activeCommenter)}</h3>
                {activeCommenter.email && (
                  <p className={styles.commenterSub}>{activeCommenter.email}</p>
                )}
              </div>
            </div>
            <div className={styles.commenterBody}>
              {activeCommenter.barangay && (
                <p className={styles.commenterField}>
                  <span>Barangay</span>
                  <strong>{activeCommenter.barangay}</strong>
                </p>
              )}
              {activeCommenter.municipality && (
                <p className={styles.commenterField}>
                  <span>Municipality</span>
                  <strong>{activeCommenter.municipality}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingDeleteComment && (
        <div
          className={styles.commentConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteAdminCommentTitle"
          onClick={handleCancelDeleteComment}
        >
          <div
            className={styles.commentConfirmCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.commentConfirmHeader}>
              <span className={styles.commentConfirmIcon} aria-hidden="true">🗑️</span>
              <div>
                <h3 id="deleteAdminCommentTitle" className={styles.commentConfirmTitle}>Delete comment?</h3>
                <p className={styles.commentConfirmSubtitle}>This action cannot be undone.</p>
              </div>
            </div>
            {pendingDeleteComment.commentText && (
              <blockquote className={styles.commentConfirmQuote}>
                {pendingDeleteComment.commentText.length > 160
                  ? `${pendingDeleteComment.commentText.slice(0, 160)}…`
                  : pendingDeleteComment.commentText}
              </blockquote>
            )}
            <div className={styles.commentConfirmActions}>
              <button
                type="button"
                className={styles.commentConfirmCancel}
                onClick={handleCancelDeleteComment}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.commentConfirmDelete}
                onClick={handleConfirmDeleteComment}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Reject report">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reject report</h3>
              <button className={styles.modalCloseBtn} onClick={closeRejectModal}>
                <i className="fa-solid fa-times" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{marginTop:0}}>Please select reason(s):</p>
              <div className={styles.rejectReasons}>
                {[
                  'Duplicate report',
                  'Needs more information',
                  'Spam or inappropriate content',
                ].map((reason) => (
                  <label key={reason} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={rejectReasons.includes(reason)}
                      onChange={(e) => {
                        setRejectReasons((prev) => e.target.checked
                          ? [...prev, reason]
                          : prev.filter((r) => r !== reason));
                      }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <div style={{marginTop:10}}>
                <label className={styles.fieldLabel}>Other (optional)</label>
                <input
                  className={styles.commentInput}
                  placeholder="Add a short note"
                  value={rejectOther}
                  onChange={(e) => setRejectOther(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={closeRejectModal}>
                Cancel
              </button>
              <button className={`${styles.actionBtn} ${styles.rejectBtn}`} onClick={submitReject}>
                <i className="fa-solid fa-xmark" /> Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {authorityModalOpen && selectedReport && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Report to Authorities">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Send report to authority</h3>
              <button className={styles.modalCloseBtn} onClick={closeAuthorityModal}>
                <i className="fa-solid fa-times" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalReportTitle}>{selectedReport.title}</p>
              <p className={styles.modalReportCategory}>Category: {selectedReport.category ?? "Unspecified"}</p>
              <div className={styles.authorityList}>
                {authorities.map((a) => {
                  const isSelected = selectedAuthorityId === a._id;
                  return (
                    <button
                      key={a._id}
                      className={[
                        styles.actionBtn,
                        styles.authorityBtn,
                        isSelected ? styles.authorityBtnSelected : "",
                      ].join(" ")}
                      onClick={() => {
                        setSelectedAuthorityId(a._id);
                        setSelectedAuthorityEmail(a.contactEmail);
                      }}
                      aria-pressed={isSelected}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.authorityName}</div>
                        <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{a.department}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={closeAuthorityModal}>
                Cancel
              </button>
              <button
                className={`${styles.actionBtn} ${styles.sendBtn}`}
                onClick={() => sendReportToAuthority(selectedAuthorityEmail)}
                disabled={!selectedAuthorityId}
                aria-disabled={!selectedAuthorityId}
                title={!selectedAuthorityId ? 'Select an authority first' : 'Send to selected authority'}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Image Lightbox Modal */}
      {lightboxOpen && (
        <div className={styles.lightboxBackdrop} onClick={closeLightbox}>
          <div className={styles.lightboxContainer} onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              className={styles.lightboxClose}
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              <i className="fa-solid fa-times"></i>
            </button>

            {/* Previous Button */}
            {currentReportImages.length > 1 && (
              <button
                className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                onClick={prevImage}
                aria-label="Previous image"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
            )}

            {/* Image */}
            <div className={styles.lightboxImageWrapper}>
              <img
                src={currentReportImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                className={styles.lightboxImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/broken-streetlights.jpg";
                }}
              />
            </div>

            {/* Next Button */}
            {currentReportImages.length > 1 && (
              <button
                className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                onClick={nextImage}
                aria-label="Next image"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            )}

            {/* Image Counter */}
            <div className={styles.lightboxCounter}>
              {currentImageIndex + 1} / {currentReportImages.length}
            </div>

            {/* Thumbnail Navigation */}
            {currentReportImages.length > 1 && (
              <div className={styles.lightboxThumbnails}>
                {currentReportImages.map((img, idx) => (
                  <div
                    key={idx}
                    className={`${styles.thumbnailItem} ${idx === currentImageIndex ? styles.activeThumbnail : ''}`}
                    onClick={() => setCurrentImageIndex(idx)}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
