"use client";

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import styles from "./user-feed.module.css";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { useLoader } from "@/context/LoaderContext";
import { useRouter, usePathname } from "next/navigation";

interface Report {
  _id: string;
  user: { 
    _id?: string;
    fName: string; 
    lName: string; 
    email: string;
    profilePicture?: {
      url?: string;
      public_id?: string;
    };
    reputation?: {
      points: number;
      level: string;
      badges: Array<{
        name: string;
        icon: string;
        earnedAt: string;
      }>;
      totalReports: number;
      verifiedReports: number;
      resolvedReports: number;
      helpfulVotes: number;
    };
  } | null;
  title: string;
  description: string;
  status: string;
  location: string;
  category: string;
  isUrgent?: boolean;
  images?: string[];
  image?: string;
  helpfulVotes?: number;
  votedBy?: (string | any)[]; 
  comments?: { user: string; text: string; createdAt?: string }[];
  flags?: Array<{ // Add this
    userId: string;
    reason: string;
    description: string;
    createdAt: string;
  }>;
  flagCount?: number;
}

interface UserProfile {
  fName?: string;
  lName?: string;
  email?: string;
  barangay?: string;
  municipality?: string;
  contact?: string;
  profilePicture?: {
    url?: string;
    public_id?: string;
  };
}

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'Newcomer': return '🌱';
    case 'Contributor': return '📝';
    case 'Trusted': return '⭐';
    case 'Expert': return '🏆';
    case 'Guardian': return '👑';
    default: return '🌱';
  }
};

const getLevelColor = (level: string) => {
  switch (level) {
    case 'Newcomer': return '#94a3b8';
    case 'Contributor': return '#3b82f6';
    case 'Trusted': return '#8b5cf6';
    case 'Expert': return '#f59e0b';
    case 'Guardian': return '#ef4444';
    default: return '#94a3b8';
  }
};

const handleHelpfulVote = async (reportId: string, setReports: React.Dispatch<React.SetStateAction<Report[]>>) => {
  const token = localStorage.getItem("token");
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  
  try {
    console.log('🗳️ Attempting to vote:', reportId);
    
    const res = await fetch(`${API}/reports/${reportId}/vote-helpful`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    
    console.log('📥 Vote response:', { status: res.status, data });

    if (res.ok) {
      toast.success("Voted as helpful! +5 points to report author 🎉");
      
      // Update the report in state immediately with string IDs
      setReports((prev) =>
        prev.map((r) =>
          r._id === reportId 
            ? { 
                ...r, 
                helpfulVotes: data.helpfulVotes, 
                votedBy: (data.votedBy || []).map((id: any) => String(id)) // Ensure strings
              }
            : r
        )
      );
    } else {
      console.error('❌ Vote failed:', data.message);
      toast.error(data.message || "Failed to vote");
    }
  } catch (error) {
    console.error("❌ Vote error:", error);
    toast.error("Network error. Please try again.");
  }
};

export default function UserFeedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const modalMapRef = useRef<HTMLDivElement>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMarker, setModalMarker] = useState<any>(null);
  const [modalMap, setModalMap] = useState<any>(null);
  const [LRef, setLRef] = useState<any>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentReportImages, setCurrentReportImages] = useState<string[]>([]);

  const [reportForm, setReportForm] = useState({
    title: "",
    description: "",
    category: "",
    isUrgent: false,
    images: [] as File[],
    address: "",
    latitude: "",
    longitude: "",
  });

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const { showLoader, hideLoader } = useLoader();

  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [flagForm, setFlagForm] = useState({
    reason: "",
    description: ""
  });

  const flagReasons = [
    "Spam or misleading information",
    "Inappropriate content",
    "Duplicate report",
    "False or fabricated issue",
    "Not a community issue",
    "Already resolved",
    "Other"
  ];

  const filteredReports = reports.filter((r) =>
    `${r.user?.fName ?? ""} ${r.user?.lName ?? ""} ${r.title} ${r.location} ${r.description}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (imagePreviews.length === 0) {
      if (previewIndex !== 0) {
        setPreviewIndex(0);
      }
      return;
    }

    if (previewIndex >= imagePreviews.length) {
      setPreviewIndex(imagePreviews.length - 1);
    }
  }, [imagePreviews, previewIndex]);

  // Fetch current user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/users/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          console.log("✅ User profile loaded:", data);
          console.log("📸 Nav profile picture URL:", data.profilePicture?.url);
          setUserProfile(data);

          // Check if profile is incomplete
          const isIncomplete = !data.barangay || !data.municipality || !data.contact;
          setShowProfileBanner(isIncomplete);
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };
    fetchUserProfile();
  }, [API]);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API}/reports`);
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Reports loaded:", data);
          console.log("📸 First report user pic:", data[0]?.user?.profilePicture?.url);

          // FILTER OUT reports still awaiting approval (any status containing "approval")
          const visibleReports = (data || []).filter((r: any) => {
            const status = (r?.status || "").toString();
            return !/approval/i.test(status); // exclude statuses like "Awaiting Approval", "For Approval", etc.
          });

          setReports(visibleReports);
        }
      } catch (err) {
        console.error("Failed to load reports", err);
      }
    };
    fetchReports();
  }, [API]);

  // Dynamically import Leaflet only on client
  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") {
        const leaflet = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        setLRef(leaflet);
      }
    })();
  }, []);

  // Initialize map when modal opens
  useEffect(() => {
    if (!modalVisible || !LRef) return;

    setTimeout(() => {
      const mapContainer = document.getElementById("modal-map");
      if (!mapContainer) return;

      if (mapContainer.innerHTML !== "") {
        mapContainer.innerHTML = "";
      }

      const L = LRef;
      const map = L.map(mapContainer).setView([14.8292, 120.2828], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const customPin = L.icon({
        iconUrl: "/images/pin.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      let marker: any = null;

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        if (marker) {
          marker.setLatLng([lat, lng]);
        } else {
          marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
        }

        const addressInput = document.getElementById("address") as HTMLInputElement;
        const latInput = document.getElementById("latitude") as HTMLInputElement;
        const lngInput = document.getElementById("longitude") as HTMLInputElement;

        latInput.value = lat.toString();
        lngInput.value = lng.toString();

        const address = await getAddressFromCoords(lat, lng);
        addressInput.value = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        setReportForm((prev) => ({
          ...prev,
          address: addressInput.value,
          latitude: lat.toString(),
          longitude: lng.toString(),
        }));
      });

      setTimeout(() => map.invalidateSize(), 200);
    }, 100);
  }, [modalVisible, LRef]);

  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      return data.display_name;
    } catch {
      return null;
    }
  };

  const toggleBookmark = (reportId: string) => {
    const btn = document.querySelector(`#bookmark-${reportId} i`);
    if (btn) {
      btn.classList.toggle("fa-regular");
      btn.classList.toggle("fa-solid");
    }
  };

  const addComment = async (reportId: string, text: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API}/reports/${reportId}/comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      }
    );
    if (res.ok) {
      const updatedComments = await res.json();
      setReports((prev) =>
        prev.map((r) =>
          r._id === reportId ? { ...r, comments: updatedComments } : r
        )
      );
    }
  };

  const ReportImage = ({ src, alt }: { src: string; alt: string }) => {
    const [imgSrc, setImgSrc] = useState(() => {
      if (!src) {
        console.warn('No image source provided');
        return "/images/broken-streetlights.jpg";
      }

      if (src.includes('\\') || src.includes('AppData') || src.includes('C:') || src.includes('Temp')) {
        console.error('❌ Invalid image path (local file detected):', src);
        return "/images/broken-streetlights.jpg";
      }

      if (src.startsWith('http://') || src.startsWith('https://')) {
        console.log('✅ Valid image URL:', src);
        return src;
      }

      console.warn('⚠️ Invalid image format:', src);
      return "/images/broken-streetlights.jpg";
    });

    return (
      <Image
        src={imgSrc}
        alt={alt}
        width={450}
        height={250}
        style={{ objectFit: 'cover', borderRadius: '8px' }}
        onError={() => {
          console.error('❌ Image failed to load:', imgSrc);
          setImgSrc("/images/broken-streetlights.jpg");
        }}
        unoptimized={imgSrc === "/images/broken-streetlights.jpg"} // Only unoptimize fallback
        priority={false}
      />
    );
  };

  const handlePreviewNavigation = (direction: "next" | "prev") => {
    if (imagePreviews.length <= 1) return;

    setPreviewIndex((prev) => {
      const total = imagePreviews.length;
      if (direction === "next") {
        return (prev + 1) % total;
      }
      return (prev - 1 + total) % total;
    });
  };

  const handleRemovePreview = (index: number) => {
    setReportForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));

    setImagePreviews((prev) => {
      const next = prev.filter((_, i) => i !== index);

      let nextIndex = previewIndex;
      if (index < previewIndex) {
        nextIndex = Math.max(0, nextIndex - 1);
      } else if (index === previewIndex) {
        nextIndex = next.length === 0 ? 0 : Math.min(nextIndex, next.length - 1);
      }

      setPreviewIndex(nextIndex);
      return next;
    });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!reportForm.category) {
    toast.error("Please select a category.");
    return;
  }

  if (reportForm.images.length === 0) {
    toast.error("Please upload at least one image.");
    return;
  }

  showLoader();

  try {
    const formData = new FormData();
    formData.append("title", reportForm.title);
    formData.append("description", reportForm.description);
    formData.append("category", reportForm.category);
    formData.append("isUrgent", String(reportForm.isUrgent));
    
    // ✅ Append multiple images
    reportForm.images.forEach((image) => {
      formData.append("images", image);
    });
    
    formData.append("location", reportForm.address);
    formData.append("latitude", reportForm.latitude);
    formData.append("longitude", reportForm.longitude);

    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/reports`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      toast.success("Report submitted successfully!");
      setModalVisible(false);
      setReportForm({
        title: "",
        description: "",
        category: "",
        isUrgent: false,
        images: [], // ✅ Reset images array
        address: "",
        latitude: "",
        longitude: "",
      });
      setImagePreviews([]); // ✅ Clear previews
      setPreviewIndex(0);

      const refreshRes = await fetch(`${API}/reports`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const visibleReports = (data || []).filter((r: any) => {
          const status = (r?.status || "").toString();
          return !/approval/i.test(status);
        });
        setReports(visibleReports);
      }
    } else {
      const errorData = await res.json();
      toast.error(errorData.message || "Failed to submit report");
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.error("An error occurred while submitting the report.");
  } finally {
    hideLoader();
  }
};

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!flagForm.reason) {
      toast.error("Please select a reason for flagging.");
      return;
    }

    if (flagForm.reason === "Other" && !flagForm.description.trim()) {
      toast.error("Please provide a description for 'Other' reason.");
      return;
    }

    showLoader();

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/reports/${selectedReportId}/flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: flagForm.reason,
          description: flagForm.description
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Report flagged successfully. Thank you for keeping our community safe!");
        setFlagModalVisible(false);
        setFlagForm({ reason: "", description: "" });
        setSelectedReportId(null);

        // Update the report in the list
        setReports((prev) =>
          prev.map((r) =>
            r._id === selectedReportId
              ? { ...r, flagCount: data.flagCount || (r.flagCount || 0) + 1 }
              : r
          )
        );
      } else {
        toast.error(data.message || "Failed to flag report");
      }
    } catch (error) {
      console.error("Flag submission error:", error);
      toast.error("An error occurred while flagging the report.");
    } finally {
      hideLoader();
    }
  };

  const openFlagModal = (reportId: string) => {
    setSelectedReportId(reportId);
    setFlagModalVisible(true);
  };

  const profilePicUrl = userProfile?.profilePicture?.url || defaultProfilePic;

  // Add this helper to check if current user voted
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/users/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data._id);
        }
      } catch (err) {
        console.error("Failed to fetch user ID", err);
      }
    };
    fetchUserId();
  }, [API]);

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

  return (
    <>
      <Head>
        <title>FixIt PH - Community Reports</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          src="https://kit.fontawesome.com/830b39c5c0.js"
          crossOrigin="anonymous"
          defer
        ></script>
      </Head>

      <header className={styles.headerWrap}>
        <nav className={styles.nav}>
          <div className={styles.brand}>
              <Image
              src="/images/Fix-it_logo_3.png"
              alt="Fixit Logo"
              className={styles.logo}
              width={160}
                height={40}
                priority
            />
          </div>

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <ul className={`${styles.navList} ${menuOpen ? styles.open : ""}`}>
            <li>
              <Link className={`${styles.navLink} ${pathname === '/user-map' ? styles.active : ''}`} href="/user-map">
                Map
              </Link>
            </li>
            <li>
              <Link className={`${styles.navLink} ${pathname === '/user-feed' ? styles.active : ''}`} href="/user-feed">
                Feed
              </Link>
            </li>
            <li>
              <Link className={`${styles.navLink} ${pathname === '/user-myreports' ? styles.active : ''}`} href="/user-myreports">
                My Reports
              </Link>
            </li>
            <li>
              <Link href="/user-profile" className={styles.profileLink}>
                <img
                  id="profilePic"
                  src={profilePicUrl}
                  alt="User Profile"
                  className={styles.profilePic}
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                />
              </Link>
            </li>
          </ul>
        </nav>

        {/* Profile Completion Banner */}
        {showProfileBanner && (
          <div className={styles.profileBanner}>
            <div className={styles.bannerContent}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '10px', fontSize: '18px' }}></i>
              <span>
                Your profile is incomplete. Please update your barangay, municipality, and contact information.
              </span>
              <button 
                className={styles.bannerBtn}
                onClick={() => router.push('/user-profile')}
              >
                Complete Profile
              </button>
              <button 
                className={styles.bannerClose}
                onClick={() => setShowProfileBanner(false)}
                aria-label="Dismiss"
              >
                ✖
              </button>
            </div>
          </div>
        )}

      </header>

      <main className={styles.pageWrap}>
        <div className={styles.feedContainer}>
          <div className={styles.toolbar} role="toolbar" aria-label="Reports toolbar">
          <div className={styles.toolbarInner}>
            <button
              className={`${styles.reportBtn} btn btnPrimary`}
              onClick={() => setModalVisible(true)}
            >
              + Add Report
            </button>

            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
          <section className={styles.feedMain}>
            <section id="reportList" className={styles.feedList}>
              {filteredReports.length > 0 ? (
                filteredReports.map((r) => {
                  const reportUserPic = r.user?.profilePicture?.url || defaultProfilePic;
                  
                  // Normalize votedBy array to always be strings
                  const normalizedVotedBy = (r.votedBy || []).map(voterId => {
                    if (typeof voterId === 'string') return voterId;
                    if (typeof voterId === 'object' && voterId !== null) {
                      return voterId._id || voterId.toString();
                    }
                    return String(voterId);
                  });
                  
                  // Check if current user has voted
                  const hasVoted = Boolean(
                    currentUserId && 
                    normalizedVotedBy.some(voterId => voterId === String(currentUserId))
                  );
                  
                  // Get report user ID safely and convert to string
                  const reportUserId = r.user?._id ? String(r.user._id) : null;
                  const isOwnReport = Boolean(currentUserId && reportUserId && String(reportUserId) === String(currentUserId));
                  
                  const isDisabled = hasVoted || isOwnReport;
                  
                  console.log('Vote Debug:', {
                    reportId: r._id,
                    currentUserId: String(currentUserId),
                    reportUserId,
                    normalizedVotedBy,
                    hasVoted,
                    isOwnReport,
                    isDisabled
                  });
                  
                  return (
                    <article className={styles.reportCard} key={r._id}>
                      <div className={styles.reportRow}>
                        <div>
                          <div className={styles.reportHeader}>
                            <img
                              src={reportUserPic}
                              className={styles.reportAvatar}
                              alt={r.user ? `${r.user.fName} ${r.user.lName}` : "User Avatar"}
                              style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = defaultProfilePic;
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <span className={styles.reportUser}>
                                {r.user ? `${r.user.fName} ${r.user.lName}` : "Unknown User"}
                              </span>
                              {r.user?.reputation && (
                                <div 
                                  className={styles.reputationBadge}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: getLevelColor(r.user.reputation.level)
                                  }}
                                  title={`${r.user.reputation.level} - ${r.user.reputation.points} points`}
                                >
                                  <span>{getLevelIcon(r.user.reputation.level)}</span>
                                  <span>{r.user.reputation.level}</span>
                                </div>
                              )}
                            </div>
                            <button
                              id={`bookmark-${r._id}`}
                              className={styles.bookmarkBtn}
                              onClick={() => toggleBookmark(r._id)}
                            >
                              <i className="fa-regular fa-bookmark"></i>
                            </button>
                          </div>

                          <h3 className={styles.reportTitle}>{r.title}</h3>

                          <p className={styles.reportCategory}>
                            {r.category || "Uncategorized"}
                          </p>

                          <p className={styles.reportLocation}>
                            <i className="fa-solid fa-location-dot"></i> {r.location}
                          </p>
                          <span
                            className={`${styles.reportStatus} ${styles[r.status.toLowerCase().replace(" ", "-")]}`}
                          >
                            {r.status}
                          </span>
                          <p className={styles.reportDetails}>{r.description}</p>
                        </div>

                        <div className={styles.reportImageGallery}>
                          {(() => {
                            const allImages = r.images && r.images.length > 0 ? r.images : r.image ? [r.image] : [];
                            const displayImages = allImages.slice(0, 4);
                            const totalImages = allImages.length;

                            return displayImages.map((imgSrc, idx) => {
                              const isLastImage = idx === 3 && totalImages === 5;
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={styles.reportImageItem}
                                  onClick={() => openLightbox(allImages, idx)} // ✅ Make clickable
                                  style={{ cursor: 'pointer' }}
                                >
                                  <ReportImage 
                                    src={imgSrc} 
                                    alt={`${r.title} - Image ${idx + 1}`} 
                                  />
                                  {isLastImage && (
                                    <div className={styles.imageOverlay}>
                                      <span className={styles.overlayText}>+1</span>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <div className={styles.reportActions}>
                        <button
                          type="button"
                          className={`${styles.helpfulBtn} ${hasVoted ? styles.voted : ''} btn btnSecondary`}
                          onClick={() => {
                            if (!isDisabled) {
                              handleHelpfulVote(r._id, setReports);
                            }
                          }}
                          disabled={isDisabled}
                          title={
                            isOwnReport 
                              ? "You can't vote your own report" 
                              : hasVoted 
                                ? "You already voted this as helpful" 
                                : "Vote as helpful"
                          }
                        >
                          <i className={`fa-${hasVoted ? 'solid' : 'regular'} fa-thumbs-up`}></i>
                          <span>Helpful</span>
                          <span className={styles.voteCount}>
                            {r.helpfulVotes || 0}
                          </span>
                        </button>

                        {/* Add Flag Button */}
                        <button
                          type="button"
                          className={`${styles.flagBtn} btn btnDestructiveOutline`}
                          onClick={() => openFlagModal(r._id)}
                          title="Flag this report as inappropriate"
                        >
                          <i className="fa-regular fa-flag"></i>
                          <span>Flag</span>
                          {r.flagCount && r.flagCount > 0 && (
                            <span className={styles.flagCount}>{r.flagCount}</span>
                          )}
                        </button>
                      </div>

                      <div className={styles.reportComments}>
                        <h4>Comments</h4>
                        <ul className={styles.commentList}>
                          {(r.comments ?? []).map((c, idx) => (
                            <li key={idx}>
                              <b>{c.user}:</b> {c.text}
                              {c.createdAt && (
                                <span className={styles.commentDate}>
                                  {new Date(c.createdAt).toLocaleString()}
                                </span>
                              )}
                            </li>
                          ))}
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
                    </article>
                  );
                })
              ) : (
                <p className={styles.noReports}>No reports found</p>
              )}
            </section>
          </section>
        </div>
      </main>

      {/* Modal */}
      {modalVisible && (
        <div id="feedModal" className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <button
              className={styles.close}
              onClick={() => setModalVisible(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className={styles.modalTitle}>Add Report</h2>

            <form className={styles.formGrid} onSubmit={handleReportSubmit}>
              <div className={styles.formLeft}>
                <input
                  className={styles.input}
                  type="text"
                  name="title"
                  placeholder="Report Title"
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  required
                />
                <textarea
                  className={styles.textarea}
                  name="description"
                  placeholder="Describe the issue..."
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  required
                />

                <select
                  className={styles.input}
                  name="category"
                  value={reportForm.category}
                  onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Select a Category --</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Sanitation and Waste">Sanitation and Waste</option>
                  <option value="Environment and Public Spaces">Environment and Public Spaces</option>
                  <option value="Community and Safety">Community and Safety</option>
                  <option value="Government / Administrative">Government / Administrative</option>
                  <option value="Others">Others</option>
                </select>

                <label className={styles.inputLabel} htmlFor="imageUpload">
                  Upload Images (Max 5)
                </label>
                <div className={styles.uploadWrapper}>
                  <input
                    className={styles.fileInput}
                    type="file"
                    id="imageUpload"
                    name="images"
                    accept="image/*"
                    multiple // ✅ Enable multiple file selection
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      
                      // ✅ Limit to 5 images
                      if (files.length > 5) {
                        toast.error("Maximum 5 images allowed");
                        return;
                      }

                      // ✅ Check file sizes (5MB per image)
                      const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
                      if (invalidFiles.length > 0) {
                        toast.error("Each image must be less than 5MB");
                        return;
                      }

                      setReportForm({ ...reportForm, images: files });

                      // ✅ Generate previews
                      const previews = files.map(file => {
                        return new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            resolve(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        });
                      });

                      Promise.all(previews).then((resolved) => {
                        setImagePreviews(resolved);
                        setPreviewIndex(0);
                      });
                    }}
                  />
                  
                  {/* ✅ Image Preview Carousel */}
                  <div className={`${styles.imagePreviewGrid} ${imagePreviews.length ? styles.hasImages : ""}`}>
                    {imagePreviews.length > 0 ? (
                      <div className={styles.previewFrame}>
                        {imagePreviews.length > 1 && (
                          <button
                            type="button"
                            className={`${styles.previewNav} ${styles.previewNavPrev}`}
                            onClick={() => handlePreviewNavigation("prev")}
                            aria-label="Previous image"
                          >
                            ‹
                          </button>
                        )}

                        <div
                          className={styles.previewSlide}
                          role="button"
                          tabIndex={0}
                          onClick={() => openLightbox(imagePreviews, previewIndex)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openLightbox(imagePreviews, previewIndex);
                            }
                          }}
                        >
                          <img
                            src={imagePreviews[previewIndex]}
                            alt={`Preview ${previewIndex + 1}`}
                            className={styles.previewImage}
                          />
                        </div>

                        {imagePreviews.length > 1 && (
                          <>
                            <button
                              type="button"
                              className={`${styles.previewNav} ${styles.previewNavNext}`}
                              onClick={() => handlePreviewNavigation("next")}
                              aria-label="Next image"
                            >
                              ›
                            </button>
                            <span className={styles.previewCounter}>
                              {previewIndex + 1}/{imagePreviews.length}
                            </span>
                          </>
                        )}

                        <button
                          type="button"
                          className={styles.removePreviewBtn}
                          onClick={() => handleRemovePreview(previewIndex)}
                          aria-label="Remove image"
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <div className={styles.uploadPlaceholder}>
                        <i
                          className="fa-solid fa-cloud-arrow-up"
                          style={{ fontSize: "32px", color: "#94a3b8", marginBottom: "8px" }}
                        ></i>
                        <p>Click to upload images</p>
                        <p style={{ fontSize: "12px", color: "#64748b" }}>Up to 5 images, 5MB each</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formRight}>
                <label className={styles.inputLabel} htmlFor="address">Location</label>
                <input
                  className={styles.input}
                  type="text"
                  id="address"
                  name="address"
                  placeholder="Search or click on map"
                  value={reportForm.address}
                  onChange={(e) => setReportForm({ ...reportForm, address: e.target.value })}
                  required
                />
                <input type="hidden" id="latitude" name="latitude" />
                <input type="hidden" id="longitude" name="longitude" />

                <div id="modal-map" ref={modalMapRef} className={styles.modalMap}></div>
             
                <div className={styles.urgentToggle}>
                  <input
                    type="checkbox"
                    id="isUrgent"
                    name="isUrgent"
                    checked={reportForm.isUrgent}
                    onChange={(e) => setReportForm({ ...reportForm, isUrgent: e.target.checked })}
                  />
                  <label htmlFor="isUrgent">Mark as Urgent</label>
                </div>
               </div>
              <div className={styles.submitRow}>
                <button type="submit" className={`${styles.submitBtn} btn btnPrimary`}>Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flag Report Modal */}
      {flagModalVisible && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <button
              className={styles.close}
              onClick={() => {
                setFlagModalVisible(false);
                setFlagForm({ reason: "", description: "" });
                setSelectedReportId(null);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className={styles.modalTitle}>
              <i className="fa-solid fa-flag" style={{ marginRight: '10px', color: '#ef4444' }}></i>
              Flag Report
            </h2>
            <p style={{ marginBottom: '20px', color: '#64748b', fontSize: '14px' }}>
              Help us maintain quality by flagging inappropriate or false reports.
            </p>

            <form onSubmit={handleFlagSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label className={styles.inputLabel} htmlFor="flagReason">
                  Reason for flagging <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="flagReason"
                  className={styles.input}
                  value={flagForm.reason}
                  onChange={(e) => setFlagForm({ ...flagForm, reason: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Select a reason --</option>
                  {flagReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className={styles.inputLabel} htmlFor="flagDescription">
                  Additional details {flagForm.reason === "Other" && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <textarea
                  id="flagDescription"
                  className={styles.textarea}
                  placeholder="Please provide more details about why you're flagging this report..."
                  value={flagForm.description}
                  onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
                  required={flagForm.reason === "Other"}
                  rows={4}
                />
              </div>

              <div className={styles.submitRow}>
                <button type="submit" className={`${styles.submitBtn} btn btnPrimary`}>
                  Submit Flag
                </button>
              </div>
            </form>
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
    </>
  );
}
