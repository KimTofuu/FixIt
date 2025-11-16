"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Image from "next/image";
import AdminLoader from "@/components/AdminLoader";
import styles from "./admin-flag.module.css";
import AdminNavbar from "@/components/AdminNavbar";

interface User {
  _id: string;
  fName: string;
  lName: string;
  email: string;
  profilePicture?: {
    url?: string;
  };
}

interface Flag {
  userId: {
    _id: string;
    fName: string;
    lName: string;
    email: string;
  };
  reason: string;
  description: string;
  createdAt: string;
}

interface FlaggedReport {
  _id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  image?: string;
  images?: string[];
  user: User;
  flags: Flag[];
  flagCount: number;
  createdAt: string;
  helpfulVotes?: number;
}

export default function AdminFlagPage() {
  const router = useRouter();
  const [flaggedReports, setFlaggedReports] = useState<FlaggedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<FlaggedReport | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [filterReason, setFilterReason] = useState<string>("all");

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentReportImages, setCurrentReportImages] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ type: "dismissAll" | "removeReport"; reportId: string } | null>(null);
  
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchFlaggedReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      console.log("📡 Fetching from:", `${API}/reports/admin/flagged-reports`);
      console.log("📡 Using token:", token?.substring(0, 20) + "...");
      
      const res = await fetch(`${API}/reports/admin/flagged-reports`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      console.log("📡 Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Error response:", errorText);
        
        if (res.status === 401 || res.status === 403) {
          toast.error("Session expired. Please login again.");
          localStorage.clear();
          router.push("/login");
          return;
        }
        
        throw new Error(`Failed to fetch flagged reports: ${res.status}`);
      }

      const data = await res.json();
      console.log("✅ Fetched data:", data.length, "reports");
      setFlaggedReports(data);
    } catch (error) {
      console.error("❌ Error fetching flagged reports:", error);
      toast.error("Failed to load flagged reports");
    } finally {
      setIsLoading(false);
    }
  }, [API, router]);

  const flagReasons = [
    "Spam or misleading information",
    "Inappropriate content",
    "Duplicate report",
    "False or fabricated issue",
    "Not a community issue",
    "Already resolved",
    "Other"
  ];

  // ✅ Move all functions and hooks BEFORE any conditional returns
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

  const openConfirmModal = (type: "dismissAll" | "removeReport", reportId: string) => {
    setConfirmAction({ type, reportId });
  };

  const closeConfirmModal = () => {
    setConfirmAction(null);
  };

  const executeConfirmAction = () => {
    if (!confirmAction) return;
    const { type, reportId } = confirmAction;
    closeConfirmModal();
    if (type === "dismissAll") {
      void handleDismissAllFlags(reportId);
    } else {
      void handleRemoveReport(reportId);
    }
  };

  // ✅ This useEffect must be before any conditional returns
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
    if (!confirmAction) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmAction(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [confirmAction]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");

    console.log("🔐 Checking authentication...");
    console.log("Token:", token ? "exists" : "missing");

    if (!token) {
      console.log("❌ No token, redirecting to login");
      toast.error("Please login first");
      router.push("/login");
      return;
    }

    console.log("✅ Authentication passed");
    void fetchFlaggedReports();
  }, [router, fetchFlaggedReports]);

  const handleDismissFlag = async (reportId: string, flagUserId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/reports/admin/${reportId}/dismiss-flag`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flagUserId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Flag dismissed successfully");
        void fetchFlaggedReports();
        if (selectedReport?._id === reportId) {
          setDetailsModalVisible(false);
          setSelectedReport(null);
        }
      } else {
        toast.error(data.message || "Failed to dismiss flag");
      }
    } catch (error) {
      console.error("Error dismissing flag:", error);
      toast.error("An error occurred");
    }
  };

  const handleRemoveReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      
      // Use the admin-specific delete endpoint
      const res = await fetch(`${API}/admin/reports/${reportId}/delete-flagged`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Report removed successfully");
        void fetchFlaggedReports();
        setDetailsModalVisible(false);
        setSelectedReport(null);
      } else {
        toast.error(data.message || "Failed to remove report");
      }
    } catch (error) {
      console.error("Error removing report:", error);
      toast.error("An error occurred");
    }
  };

  const handleDismissAllFlags = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/reports/admin/${reportId}/dismiss-all-flags`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("All flags dismissed successfully");
        void fetchFlaggedReports();
        setDetailsModalVisible(false);
        setSelectedReport(null);
      } else {
        toast.error(data.message || "Failed to dismiss flags");
      }
    } catch (error) {
      console.error("Error dismissing all flags:", error);
      toast.error("An error occurred");
    }
  };

  const openDetailsModal = (report: FlaggedReport) => {
    setSelectedReport(report);
    setDetailsModalVisible(true);
  };

  const filteredReports = flaggedReports.filter((report) => {
    if (filterReason === "all") return true;
    return report.flags.some((flag) => flag.reason === filterReason);
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "#f59e0b";
      case "in-progress":
        return "#3b82f6";
      case "resolved":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <>
      <div className={styles.adminFlagRoot}>
        <AdminNavbar active="flag" />

        <div className={styles.flagPage}>
          <main className={styles.mainContainer}>
            <div className={styles.contentCard}>
              <div className={styles.pageHeader}> 
                 <div className={styles.filterSection}>
                <label htmlFor="reasonFilter" className={styles.filterLabel}>
                  Filter by reason:
                </label>
                <select
                  id="reasonFilter"
                  className={styles.filterSelect}
                  value={filterReason}
                  onChange={(e) => setFilterReason(e.target.value)}
                >
                  <option value="all">All Reasons ({flaggedReports.length})</option>
                  {flagReasons.map((reason) => {
                    const count = flaggedReports.filter((r) =>
                      r.flags.some((f) => f.reason === reason)
                    ).length;
                    return (
                      <option key={reason} value={reason}>
                        {reason} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
                <div className={styles.stats}>
                  <div className={styles.statCard}>
                    <i className="fa-solid fa-flag"></i>
                    <div>
                      <div className={styles.statNumber}>{flaggedReports.length}</div>
                      <div className={styles.statLabel}>Flagged Reports</div>
                    </div>
                  </div>
                </div>
              </div>

              <div id="admin-reportList" className={styles.reportList}>
                {isLoading ? (
                  <AdminLoader message="Loading flagged reports..." className={styles.loadingState} />
                ) : filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <div className={styles.flagCard} key={report._id}>
                      <div className={styles.reportsRow}>
                        <div className={styles.reportMain}>
                          <div className={styles.reportMetaRow}>
                            <Image
                              src={
                                (report.user?.profilePicture?.url as string) ||
                                "/images/sample_avatar.png"
                              }
                              className={styles.reportAvatar}
                              alt="Avatar"
                              width={36}
                              height={36}
                            />
                            <div className={styles.userMetaInline}>
                              <span className={styles.reportAuthor}>
                                {report.user?.fName && report.user?.lName
                                  ? `${report.user.fName} ${report.user.lName}`
                                  : "Unknown User"}
                              </span>
                              <span className={styles.reportTime}>{formatTimeAgo(report.createdAt)}</span>
                            </div>
                            <span className={styles.reportTag}>{report.category ?? "Unspecified"}</span>
                            <div className={styles.flagBadge}>
                              <i className="fa-solid fa-flag"></i>
                              {report.flagCount} {report.flagCount === 1 ? "Flag" : "Flags"}
                            </div>
                          </div>

                          <h3 className={styles.reportTitle}>{report.title}</h3>
                          <p className={styles.reportLocation}>
                            <i className="fa-solid fa-location-dot" /> {report.location}
                          </p>
                          <p className={styles.reportDescription}>{report.description}</p>

                          <div className={styles.flagsList}>
                            <h4 className={styles.flagsTitle}>Flags</h4>
                            {report.flags.slice(0, 2).map((flag, index) => (
                              <div className={styles.flagItem} key={index}>
                                <div className={styles.flagHeader}>
                                  <span className={styles.flagUser}>
                                    <i className="fa-solid fa-user-circle"></i>
                                    {flag.userId.fName} {flag.userId.lName}
                                  </span>
                                  <span className={styles.flagTime}>
                                    {formatTimeAgo(flag.createdAt)}
                                  </span>
                                </div>
                                <div className={styles.flagReason}>
                                  <i className="fa-solid fa-circle-exclamation"></i>
                                  {flag.reason}
                                </div>
                                {flag.description && (
                                  <div className={styles.flagDescription}>
                                    "{flag.description}"
                                  </div>
                                )}
                              </div>
                            ))}
                            {report.flags.length > 2 && (
                              <p className={styles.moreFlagsText}>
                                +{report.flags.length - 2} more flag{report.flags.length - 2 > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>

                          <div className={styles.cardActions}>
                            <button
                              className={styles.viewDetailsBtn}
                              onClick={() => openDetailsModal(report)}
                            >
                              <i className="fa-solid fa-eye"></i>
                              View Details
                            </button>
                            <button
                              className={styles.dismissAllBtn}
                              onClick={() => openConfirmModal("dismissAll", report._id)}
                            >
                              <i className="fa-solid fa-check"></i>
                              Dismiss All
                            </button>
                            <button
                              className={styles.removeBtn}
                              onClick={() => openConfirmModal("removeReport", report._id)}
                            >
                              <i className="fa-solid fa-trash"></i>
                              Remove Report
                            </button>
                          </div>
                        </div>

                        <div className={styles.reportImage}>
                          {(() => {
                            const allImages = report.images && report.images.length > 0
                              ? report.images
                              : report.image
                              ? [report.image]
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
                                        onError={(e) => { (e.target as HTMLImageElement).src = "/images/broken-streetlights.jpg"; }}
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
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <i className="fa-solid fa-flag" style={{ fontSize: "64px", color: "#cbd5e1" }}></i>
                    <h3>No Flagged Reports</h3>
                    <p>There are no reports matching your filter criteria.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Details Modal */}
        {detailsModalVisible && selectedReport && (
          <div className={styles.modal} onClick={() => setDetailsModalVisible(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.closeBtn}
                onClick={() => setDetailsModalVisible(false)}
              >
                &times;
              </button>

              <h2 className={styles.modalTitle}>
                <i className="fa-solid fa-file-lines"></i>
                Report Details
              </h2>

              <div className={styles.modalBody}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Report Information</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <strong>Title:</strong>
                      <span>{selectedReport.title}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Category:</strong>
                      <span>{selectedReport.category}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Location:</strong>
                      <span>{selectedReport.location}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Status:</strong>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: getStatusColor(selectedReport.status) }}
                      >
                        {selectedReport.status}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Reported by:</strong>
                      <span>
                        {selectedReport.user.fName} {selectedReport.user.lName}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <strong>Helpful Votes:</strong>
                      <span>{selectedReport.helpfulVotes || 0}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem} style={{ marginTop: '12px' }}>
                    <strong>Description:</strong>
                    <p style={{ marginTop: '8px', lineHeight: '1.6' }}>
                      {selectedReport.description}
                    </p>
                  </div>
                </div>

                {/* ✅ Display multiple images in modal */}
                {(() => {
                  const allImages = selectedReport.images && selectedReport.images.length > 0 
                    ? selectedReport.images 
                    : selectedReport.image 
                    ? [selectedReport.image] 
                    : [];

                  if (allImages.length > 0) {
                    return (
                      <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>
                          Images ({allImages.length})
                        </h3>
                        <div className={styles.modalImageGallery}>
                          {allImages.slice(0, 4).map((img, idx) => {
                            const isLastImage = idx === 3 && allImages.length === 5;
                            
                            return (
                              <div 
                                key={idx} 
                                className={styles.modalImageItem}
                                onClick={() => openLightbox(allImages, idx)}
                                style={{ position: 'relative', cursor: 'pointer' }}
                              >
                                <img
                                  src={img}
                                  alt={`Report Image ${idx + 1}`}
                                  className={styles.reportImage}
                                />
                                {isLastImage && (
                                  <div className={styles.imageOverlay}>
                                    <span className={styles.overlayText}>+1</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    All Flags ({selectedReport.flags.length})
                  </h3>
                  <div className={styles.flagsDetailList}>
                    {selectedReport.flags.map((flag, index) => (
                      <div className={styles.flagDetailItem} key={index}>
                        <div className={styles.flagDetailHeader}>
                          <div>
                            <strong>{flag.userId.fName} {flag.userId.lName}</strong>
                            <span className={styles.flagDetailEmail}>
                              ({flag.userId.email})
                            </span>
                          </div>
                          <span className={styles.flagDetailTime}>
                            {new Date(flag.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className={styles.flagDetailReason}>
                          <strong>Reason:</strong> {flag.reason}
                        </div>
                        {flag.description && (
                          <div className={styles.flagDetailDesc}>
                            <strong>Details:</strong> {flag.description}
                          </div>
                        )}
                        <button
                          className={styles.dismissFlagBtn}
                          onClick={() => handleDismissFlag(selectedReport._id, flag.userId._id)}
                        >
                          <i className="fa-solid fa-times"></i>
                          Dismiss this flag
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.modalDismissBtn}
                  onClick={() => openConfirmModal("dismissAll", selectedReport._id)}
                >
                  Dismiss All Flags
                </button>
                <button
                  className={styles.modalRemoveBtn}
                  onClick={() => openConfirmModal("removeReport", selectedReport._id)}
                >
                  Remove Report
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className={styles.modal} onClick={closeConfirmModal}>
            <div
              className={`${styles.modalContent} ${styles.confirmModalContent}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={styles.closeBtn}
                onClick={closeConfirmModal}
                aria-label="Close confirmation modal"
              >
                &times;
              </button>

              <h2 className={styles.confirmModalTitle}>
                {confirmAction.type === "dismissAll"
                  ? "Dismiss all flags?"
                  : "Remove report?"}
              </h2>

              <p className={styles.confirmModalMessage}>
                {confirmAction.type === "dismissAll" ? (
                  <>
                    This will clear <span className={styles.confirmModalHighlight}>every flag</span> linked to this report. The report itself will stay available.
                  </>
                ) : (
                  <>
                    This will permanently remove the report for all users. <span className={styles.confirmModalHighlight}>This action cannot be undone.</span>
                  </>
                )}
              </p>

              <div className={styles.confirmModalActions}>
                <button className={styles.confirmCancelBtn} onClick={closeConfirmModal}>
                  Cancel
                </button>
                <button
                  className={
                    confirmAction.type === "dismissAll"
                      ? styles.confirmDismissBtn
                      : styles.confirmRemoveBtn
                  }
                  onClick={executeConfirmAction}
                >
                  {confirmAction.type === "dismissAll" ? "Dismiss Flags" : "Remove Report"}
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
    </>
  );
}