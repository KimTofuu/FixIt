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
import AdminLoader from "@/components/AdminLoader";

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
  createdAt?: string | Date;
  editedAt?: string | Date | null;
}

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
  comments?: ReportComment[];
  createdAt?: string;
  flags?: Array<{ // Add this
    userId: string;
    reason: string;
    description: string;
    createdAt: string;
  }>;
  flagCount?: number;
}

interface UserProfile {
  _id?: string;
  id?: string;
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

const handleHelpfulVote = async (
  reportId: string,
  setReports: React.Dispatch<React.SetStateAction<Report[]>>,
  isOwnReport: boolean
) => {
  if (isOwnReport) {
    toast.info("You can't upvote your own report.");
    return;
  }

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

const formatRelativeTime = (timestamp?: string | Date): string => {
  if (!timestamp) {
    return "";
  }

  const created = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(created.getTime())) {
    return "";
  }

  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  if (diffMs <= 0) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

export default function UserFeedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const modalMapRef = useRef<HTMLDivElement>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
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
  const [reportsLoading, setReportsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const { showLoader, hideLoader } = useLoader();

  const buildBannerStorageKey = (profile?: UserProfile | null) => {
    if (!profile) return null;
    const identifier = profile._id || profile.id || profile.email;
    return identifier ? `profileBannerDismissed:${identifier}` : null;
  };

  const handleDismissProfileBanner = () => {
    if (typeof window !== "undefined") {
      const key = buildBannerStorageKey(userProfile);
      if (key) {
        localStorage.setItem(key, "true");
      }
    }
    setShowProfileBanner(false);
  };

  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [flagForm, setFlagForm] = useState({
    reason: "",
    description: ""
  });
  const [showCommenterModal, setShowCommenterModal] = useState(false);
  const [activeCommenter, setActiveCommenter] = useState<ReportComment | null>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ reportId: string; commentId: string } | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{ reportId: string; commentId: string; commentText?: string } | null>(null);

  const flagReasons = [
    "Spam or misleading information",
    "Inappropriate content",
    "Duplicate report",
    "False or fabricated issue",
    "Not a community issue",
    "Already resolved",
    "Other"
  ];

  const getCommenterFirstName = (comment: ReportComment) => {
    if (comment.fName && comment.fName.trim().length > 0) {
      return comment.fName.trim();
    }
    if (comment.user && comment.user.trim().length > 0) {
      return comment.user.trim().split(' ')[0];
    }
    if (comment.lName && comment.lName.trim().length > 0) {
      return comment.lName.trim();
    }
    return "Resident";
  };

  const getCommenterFullName = (comment: ReportComment) => {
    const composed = `${comment.fName || ''} ${comment.lName || ''}`.trim();
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

          const normalizedProfile: UserProfile = {
            ...data,
            _id: data._id || data.id,
            id: data.id,
          };

          setUserProfile(normalizedProfile);

          const isIncomplete =
            !normalizedProfile.barangay ||
            !normalizedProfile.municipality ||
            !normalizedProfile.contact;

          const dismissalKey = buildBannerStorageKey(normalizedProfile);

          if (!isIncomplete) {
            setShowProfileBanner(false);
            if (typeof window !== "undefined" && dismissalKey) {
              localStorage.removeItem(dismissalKey);
            }
          } else {
            if (typeof window !== "undefined" && dismissalKey) {
              const dismissed = localStorage.getItem(dismissalKey) === "true";
              setShowProfileBanner(!dismissed);
            } else {
              setShowProfileBanner(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };
    fetchUserProfile();
  }, [API]);

  // Fetch reports
  useEffect(() => {
    let active = true;

    const fetchReports = async () => {
      setReportsLoading(true);
      try {
        const res = await fetch(`${API}/reports`);
        if (!res.ok) {
          return;
        }

        const data = await res.json();
        console.log("✅ Reports loaded:", data);
        console.log("📸 First report user pic:", data[0]?.user?.profilePicture?.url);

        const visibleReports = (data || []).filter((r: any) => {
          const status = (r?.status || "").toString();
          return !/approval/i.test(status);
        });

        if (active) {
          setReports(visibleReports);
        }
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        if (active) {
          setReportsLoading(false);
        }
      }
    };

    void fetchReports();

    return () => {
      active = false;
    };
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

  const updateComment = async (reportId: string, commentId: string, text: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/reports/${reportId}/comment/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const updatedComments = await res.json();
        setReports((prev) =>
          prev.map((r) =>
            r._id === reportId ? { ...r, comments: updatedComments } : r
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
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const updatedComments = await res.json();
        setReports((prev) =>
          prev.map((r) =>
            r._id === reportId ? { ...r, comments: updatedComments } : r
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
    const existingComment = report?.comments?.find((c) => c._id === editingComment.commentId);
    if (existingComment && existingComment.text?.trim() === trimmed) {
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

  setIsReportSubmitting(true);

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
    setIsReportSubmitting(false);
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
  const currentUserEmail = userProfile?.email ? userProfile.email.toLowerCase() : null;

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
          setCurrentUserId(data._id || data.id || null);
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

      {isReportSubmitting && (
        <div className={styles.fullscreenSpinner} role="status" aria-live="polite">
          <div className={styles.modalSpinnerShell}>
            <div className={styles.modalSpinnerRing}></div>
            <Image
              src="/images/Fix-it_logo_3.png"
              alt="FixIt loading"
              width={64}
              height={64}
              className={styles.modalSpinnerLogo}
              priority
            />
          </div>
          <p className={styles.modalSpinnerLabel}>Submitting report…</p>
        </div>
      )}

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
            <button
              className={styles.bannerClose}
              onClick={handleDismissProfileBanner}
              aria-label="Dismiss profile reminder"
            >
              ✕
            </button>
            <div className={styles.bannerContent}>
              <p className={styles.bannerText}>
                Your profile is incomplete. Please update your barangay, municipality, and contact information.
              </p>
              <button
                className={styles.bannerBtn}
                onClick={() => router.push('/user-profile')}
              >
                Complete Profile
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
                {reportsLoading ? (
                  <div className={styles.loaderWrap}>
                    <AdminLoader message="Loading reports..." />
                  </div>
                ) : filteredReports.length > 0 ? (
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
                  
                  const viewerId = currentUserId || currentUserEmail;
                  
                  // Check if current user has voted
                  const hasVoted = Boolean(
                    viewerId && 
                    normalizedVotedBy.some(voterId => voterId === String(viewerId))
                  );
                  
                  // Get report user ID safely and convert to string
                  const reportUserId = r.user?._id ? String(r.user._id) : (r.user?.email ? r.user.email.toLowerCase() : null);
                  const isOwnReport = Boolean(
                    viewerId && reportUserId && String(reportUserId) === String(viewerId)
                  );

                  const createdTimeLabel = formatRelativeTime(r.createdAt);
                  
                  console.log('Vote Debug:', {
                    reportId: r._id,
                    viewerId: viewerId ? String(viewerId) : null,
                    reportUserId,
                    normalizedVotedBy,
                    hasVoted,
                    isOwnReport
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
                            <div className={styles.reportHeaderMain}>
                              <div className={styles.reportUserMeta}>
                                <span className={styles.reportUser}>
                                  {r.user ? `${r.user.fName} ${r.user.lName}` : "Unknown User"}
                                </span>
                                {createdTimeLabel && (
                                  <span className={styles.reportTime}>{createdTimeLabel}</span>
                                )}
                              </div>
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

                        {(() => {
                          const allImages = r.images && r.images.length > 0 ? r.images : r.image ? [r.image] : [];
                          const totalImages = allImages.length;
                          if (totalImages === 0) {
                            return null;
                          }
                          const displayImages = allImages.slice(0, 4);
                          return (
                            <div className={styles.reportImageGallery}>
                              {displayImages.map((imgSrc, idx) => {
                                const isLastImage = idx === 3 && totalImages === 5;

                                return (
                                  <div
                                    key={idx}
                                    className={styles.reportImageItem}
                                    onClick={() => openLightbox(allImages, idx)}
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
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <div className={styles.reportActions}>
                        <button
                          type="button"
                          className={`${styles.helpfulBtn} ${hasVoted ? styles.voted : ''} btn btnSecondary`}
                          onClick={() => {
                            if (hasVoted) return;
                            handleHelpfulVote(r._id, setReports, isOwnReport);
                          }}
                          disabled={hasVoted}
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
                            const createdLabel = c.createdAt
                              ? new Date(c.createdAt).toLocaleString()
                              : null;
                            const editedLabel = c.editedAt
                              ? new Date(c.editedAt).toLocaleString()
                              : null;

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
                                        title={editedLabel ? `Edited ${editedLabel}` : 'Edited'}
                                      >
                                        Edited
                                      </span>
                                    )}
                                  </div>

                                  {canManageComment && (
                                    <div
                                      className={styles.commentMenu}
                                      data-comment-menu-key={commentMenuKey}
                                    >
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

            <form
              className={styles.formGrid}
              onSubmit={handleReportSubmit}
              aria-busy={isReportSubmitting}
            >
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
                <button
                  type="submit"
                  className={`${styles.submitBtn} btn btnPrimary`}
                  disabled={isReportSubmitting}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteComment && (
        <div
          className={styles.confirmModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteCommentTitle"
          onClick={handleCancelDeleteComment}
        >
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmModalHeader}>
              <span className={styles.confirmModalIcon} aria-hidden="true">🗑️</span>
              <div>
                <h3 id="deleteCommentTitle" className={styles.confirmModalTitle}>Delete comment?</h3>
                <p className={styles.confirmModalSubtitle}>This action cannot be undone.</p>
              </div>
            </div>
            {pendingDeleteComment.commentText && (
              <blockquote className={styles.confirmModalComment}>
                {pendingDeleteComment.commentText.length > 160
                  ? `${pendingDeleteComment.commentText.slice(0, 160)}…`
                  : pendingDeleteComment.commentText}
              </blockquote>
            )}
            <div className={styles.confirmModalActions}>
              <button
                type="button"
                className={styles.confirmModalCancel}
                onClick={handleCancelDeleteComment}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmModalDelete}
                onClick={handleConfirmDeleteComment}
              >
                Delete
              </button>
            </div>
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
