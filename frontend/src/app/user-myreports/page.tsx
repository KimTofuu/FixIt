"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./user-myreports.module.css";
import { toast } from "react-toastify";
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
  createdAt?: string;
  editedAt?: string | Date | null;
}

interface Report {
  _id: string;
  user: {
    fName: string;
    lName: string;
    profilePicture?: {
      url?: string;
      public_id?: string;
    };
  };
  title: string;
  location?: string;
  description?: string;
  status: "Pending" | "In Progress" | string;
  images?: string[]; // ✅ Array of images
  image?: string | null;
  latitude?: string | number;
  longitude?: string | number;
  comments?: ReportComment[];
  priority?: "urgent" | "not urgent" | string;
  category?: string;
  createdAt?: string | Date;
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

export default function UserMyReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; index: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [showCommenterModal, setShowCommenterModal] = useState(false);
  const [activeCommenter, setActiveCommenter] = useState<ReportComment | null>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ reportId: string; commentId: string } | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{ reportId: string; commentId: string; commentText?: string } | null>(null);

  // Add Report modal state (from user-map)
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [reportForm, setReportForm] = useState({
    title: "",
    description: "",
    category: "",
    isUrgent: false,
    images: [] as File[], // ✅ Changed to array
    address: "",
    latitude: "",
    longitude: "",
  });

  const addModalMapRef = useRef<any | null>(null);
  const addModalMarkerRef = useRef<any | null>(null);

  // ✅ Update editForm for multiple images
  const [editForm, setEditForm] = useState({
    _id: "",
    title: "",
    description: "",
    location: "",
    latitude: "",
    longitude: "",
    imageFiles: [] as File[], // ✅ Changed to array
    imagePreviews: [] as string[], // ✅ Array of previews
    existingImages: [] as string[], // ✅ Existing images from DB
    removeImages: [] as string[], // ✅ Images to remove
    priority: "not urgent",
    category: "",
  });

  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [addPreviewIndex, setAddPreviewIndex] = useState(0);

  const editMapRef = useRef<HTMLDivElement | null>(null);
  const [LRef, setLRef] = useState<any>(null);
  const [editMap, setEditMap] = useState<any>(null);
  const [editMarker, setEditMarker] = useState<any>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const profilePicUrl = userProfile?.profilePicture?.url || defaultProfilePic;

  const currentUserId = userProfile?._id || userProfile?.id || null;
  const currentUserEmail = userProfile?.email ? userProfile.email.toLowerCase() : null;

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

  const normalizeStatus = (s?: string): Report["status"] => {
    if (!s) return "Reported";
    const lower = s.toLowerCase();
    if (lower.includes("pend")) return "Pending";
    if (lower.includes("report")) return "Reported";
    if (lower.includes("in-progress") || lower.includes("progress") || lower.includes("process")) return "Processing";
    if (lower.includes("resolved") || lower.includes("resolve")) return "Resolved";
    if (lower === "pending") return "Pending";
    if (lower === "reported") return "Reported";
    if (lower === "processing") return "Processing";
    if (lower === "resolved") return "Resolved";
    return s;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

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

  useEffect(() => {
    let active = true;

    const fetchReports = async () => {
      setReportsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/reports/my`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          console.error("Failed to fetch my reports", await res.text());
          return;
        }

        const myReports = await res.json();
        if (active) {
          setReports(myReports);
        }
      } catch (err) {
        console.error("Failed to fetch my reports", err);
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

  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") {
        const leafletModule = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        setLRef(leafletModule.default || leafletModule);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showCommenterModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommenterModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
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

    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, [openCommentMenu]);

  // Initialize map for Add Report modal when it opens
  useEffect(() => {
    if (!addModalVisible || !LRef) return;

    if (addModalMapRef.current) {
      try { addModalMapRef.current.remove(); } catch (e) {}
      addModalMapRef.current = null;
    }

    const L = LRef;
    const map = L.map("add-modal-map").setView([14.8292, 120.2828], 13);
    addModalMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const customPin = L.icon({
      iconUrl: "/images/pin.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng;
      if (addModalMarkerRef.current) {
        addModalMarkerRef.current.setLatLng([lat, lng]);
      } else {
        addModalMarkerRef.current = L.marker([lat, lng], { icon: customPin }).addTo(map);
      }

      (document.getElementById("add-latitude") as HTMLInputElement).value = lat.toString();
      (document.getElementById("add-longitude") as HTMLInputElement).value = lng.toString();

      const address = await getAddressFromCoords(lat, lng);
      (document.getElementById("add-address") as HTMLInputElement).value = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      setReportForm((prev) => ({
        ...prev,
        address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        latitude: lat.toString(),
        longitude: lng.toString(),
      }));
    });

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      try { map.remove(); } catch (e) {}
      addModalMapRef.current = null;
      addModalMarkerRef.current = null;
    };
  }, [addModalVisible, LRef]);

  // ✅ Replace handleAddImageChange
  const handleAddImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    const invalidFiles = files.filter((file) => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error("Each image must be less than 5MB");
      return;
    }

    setReportForm((prev) => ({ ...prev, images: files }));

    const previews = files.map((file) => {
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
      setAddPreviewIndex(0);
    });
  };

  const handleAddPreviewNavigation = (direction: "next" | "prev") => {
    if (imagePreviews.length <= 1) return;

    setAddPreviewIndex((prev) => {
      const total = imagePreviews.length;
      return direction === "next"
        ? (prev + 1) % total
        : (prev - 1 + total) % total;
    });
  };

  const handleAddPreviewClick = () => {
    const current = imagePreviews[addPreviewIndex];
    if (!current) return;

    if (typeof window !== "undefined") {
      window.open(current, "_blank", "noopener,noreferrer");
    }
  };

  // ✅ Update removeAddImage to handle individual removal
  const removeAddImage = (index: number) => {
    setReportForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));

    setImagePreviews((prevPreviews) => {
      const nextPreviews = prevPreviews.filter((_, i) => i !== index);

      setAddPreviewIndex((current) => {
        if (nextPreviews.length === 0) return 0;
        if (index < current) return Math.max(0, current - 1);
        if (index === current) {
          return Math.min(current, nextPreviews.length - 1);
        }
        return current;
      });

      return nextPreviews;
    });
  };

  const handleAddReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.category) {
      toast.error("Please select a category.");
      return;
    }

    if (reportForm.images.length === 0) {
      toast.error("Please upload at least one image.");
      return;
    }

    setIsAddSubmitting(true);

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
      if (reportForm.latitude) formData.append("latitude", String(reportForm.latitude));
      if (reportForm.longitude) formData.append("longitude", String(reportForm.longitude));

      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/reports`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const data = await res.json();
        const createdReport = data.report || data;
        toast.success("Report submitted successfully!");
        setReports((prev) => [createdReport, ...prev]);
        
        // ✅ Reset form
        setReportForm({ 
          title: "", 
          description: "", 
          category: "", 
          isUrgent: false, 
          images: [], 
          address: "", 
          latitude: "", 
          longitude: "" 
        });
        setImagePreviews([]);
        setAddPreviewIndex(0);
        setAddModalVisible(false);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to submit report");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit report");
    } finally {
      setIsAddSubmitting(false);
    }
  };

  async function getAddressFromCoords(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      return data.display_name;
    } catch (err) {
      return null;
    }
  }

  useEffect(() => {
    if (!LRef) return;

    if (editModalVisible && editMapRef.current) {
      const L = LRef;

      if (editMapRef.current.innerHTML !== "") {
        editMapRef.current.innerHTML = "";
      }

      const lat = Number(editForm.latitude) || 14.8292;
      const lng = Number(editForm.longitude) || 120.2828;

      const map = L.map(editMapRef.current).setView([lat, lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      setEditMap(map);

      const customPin = L.icon({
        iconUrl: "/images/pin.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      let marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
      setEditMarker(marker);

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);

        const address = await getAddressFromCoords(lat, lng);
        setEditForm((prev) => ({
          ...prev,
          location: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          latitude: lat,
          longitude: lng,
        }));
      });

      setTimeout(() => map.invalidateSize(), 200);
    }

    if (!editModalVisible && editMap) {
      try {
        editMap.remove();
      } catch (e) {}
      setEditMap(null);
      setEditMarker(null);
    }
  }, [editModalVisible, LRef]);

  // Add this function after your other handler functions, before the return statement

  const tryPlaceMarker = (report: Report) => {
    if (!LRef || !editMap) return;

    const lat = Number(report.latitude);
    const lng = Number(report.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn("Invalid coordinates for report", report._id);
      return;
    }

    const L = LRef;
    const customPin = L.icon({
      iconUrl: "/images/pin.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    editMap.setView([lat, lng], 14);

    if (editMarker) {
      try {
        editMarker.setLatLng([lat, lng]);
      } catch (e) {
        const marker = L.marker([lat, lng], { icon: customPin }).addTo(editMap);
        setEditMarker(marker);
      }
    } else {
      const marker = L.marker([lat, lng], { icon: customPin }).addTo(editMap);
      setEditMarker(marker);
    }
  };

  const handleDelete = async (reportId: string, index: number) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/${reportId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const updatedReports = reports.filter((_, i) => i !== index);
        setReports(updatedReports);
        toast.success("Report deleted successfully!");
      } else {
        toast.error("Failed to delete report");
      }
    } catch (err) {
      toast.error("Failed to delete report");
    }
  };

  // Helper: determine if status is locked (in-progress or resolved)
  const isLockedStatus = (s?: string) => {
    const lower = String(s || '').toLowerCase();
    return lower.includes('in-progress') || lower.includes('progress') || lower.includes('resolved') || lower.includes('resolve');
  };

  // Wrapper: gate edit with status warning
  const handleAttemptEdit = (report: Report) => {
    if (isLockedStatus(report.status)) {
      toast.warn(`You can't edit a report that is ${report.status}.`);
      return;
    }
    handleEditClick(report);
  };

  // Wrapper: gate delete with status warning
  const handleAttemptDelete = (report: Report, index: number) => {
    if (isLockedStatus(report.status)) {
      toast.warn(`You can't delete a report that is ${report.status}.`);
      return;
    }
    confirmDelete(report._id, index);
  };

  // ✅ Update handleEditClick
  const handleEditClick = (report: Report) => {
    const existingImages = report.images && report.images.length > 0 
      ? report.images 
      : report.image 
      ? [report.image] 
      : [];

    setEditForm({
      _id: report._id,
      title: report.title || "",
      description: report.description || "",
      location: report.location || "",
      latitude: String(report.latitude ?? ""),
      longitude: String(report.longitude ?? ""),
      imageFiles: [],
      imagePreviews: [],
      existingImages: existingImages,
      removeImages: [],
      priority: (report.priority as string) || "not urgent",
      category: (report.category as string) || "",
    });

    setEditImagePreviews(existingImages);
    setEditModalVisible(true);

    setTimeout(() => {
      if (LRef && editMapRef.current) {
        tryPlaceMarker(report);
      }
    }, 250);
  };

  // ✅ Add handler for edit image changes
  const onEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = editForm.existingImages.length + editForm.imageFiles.length + files.length;
    
    if (totalImages > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error("Each image must be less than 5MB");
      return;
    }

    const newImageFiles = [...editForm.imageFiles, ...files];
    setEditForm({ ...editForm, imageFiles: newImageFiles });

    const previews = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previews).then(newPreviews => {
      setEditImagePreviews([...editForm.existingImages, ...editForm.imagePreviews, ...newPreviews]);
    });
  };

  // ✅ Remove existing image
  const handleRemoveExistingImage = (imageUrl: string, index: number) => {
    setEditForm({
      ...editForm,
      existingImages: editForm.existingImages.filter((_, i) => i !== index),
      removeImages: [...editForm.removeImages, imageUrl]
    });
    setEditImagePreviews(editImagePreviews.filter((_, i) => i !== index));
  };

  // ✅ Remove new image preview
  const handleRemoveNewImage = (index: number) => {
    const actualIndex = index - editForm.existingImages.length;
    const newImageFiles = editForm.imageFiles.filter((_, i) => i !== actualIndex);
    const newPreviews = editForm.imagePreviews.filter((_, i) => i !== actualIndex);
    
    setEditForm({
      ...editForm,
      imageFiles: newImageFiles,
      imagePreviews: newPreviews
    });
    setEditImagePreviews(editImagePreviews.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm._id) {
      toast.error("No report selected");
      return;
    }

    const formData = new FormData();
    formData.append("title", editForm.title);
    formData.append("description", editForm.description);
    formData.append("location", editForm.location);
    formData.append("category", editForm.category);
    
    if (editForm.latitude) formData.append("latitude", String(editForm.latitude));
    if (editForm.longitude) formData.append("longitude", String(editForm.longitude));
    
    // ✅ Append new images
    editForm.imageFiles.forEach((file) => {
      formData.append("images", file);
    });

    // ✅ Send images to remove
    if (editForm.removeImages.length > 0) {
      formData.append("removeImages", JSON.stringify(editForm.removeImages));
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API}/reports/${editForm._id}`, {
        method: "PATCH",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const updatedReport = await res.json();
        setReports((prev) => prev.map((r) => (r._id === updatedReport.report._id ? updatedReport.report : r)));
        toast.success("Report updated successfully!");
        setEditModalVisible(false);
        setEditImagePreviews([]);
      } else {
        const txt = await res.text();
        console.error("Update failed:", txt);
        toast.error("Failed to update report");
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update report");
    }
  };

  const filteredReports = reports.filter((r) => {
    const text = `${r.user?.fName ?? ""} ${r.user?.lName ?? ""} ${r.title} ${r.location} ${r.description}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const confirmDelete = (id: string, index: number) => {
    setDeleteTarget({ id, index });
    setDeleteModalVisible(true);
  };

  const performDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id, deleteTarget.index);
    setDeleteTarget(null);
    setDeleteModalVisible(false);
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentReportImages, setCurrentReportImages] = useState<string[]>([]);

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
      {isAddSubmitting && (
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
            <Image src="/images/Fix-it_logo_3.png" alt="Fixit Logo" className={styles.logo} width={160} height={40} priority />
          </div>

          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <ul
            className={`${styles.navList} ${menuOpen ? styles.open : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            <li><Link href="/user-map" className={`${styles.navLink} ${pathname === '/user-map' ? styles.active : ''}`}>Map</Link></li>
            <li><Link href="/user-feed" className={`${styles.navLink} ${pathname === '/user-feed' ? styles.active : ''}`}>Feed</Link></li>
            <li><Link href="/user-myreports" className={`${styles.navLink} ${pathname === '/user-myreports' ? styles.active : ''}`}>My Reports</Link></li>
            <li>
              <Link href="/user-profile" className={styles.profileLink}>
                <img 
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
                className={`${styles.reportBtn}`}
                onClick={() => setAddModalVisible(true)}
              >
                + Add Report
              </button>

              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <section className={styles.feedList} id="user-myreports">
            <div className={styles.myreportsColumn}>

              <div id="reportList" className={styles.reportList}>
                {filteredReports.length > 0 ? (
                  filteredReports.map((report, i) => {
                  const reportUserPic = report.user?.profilePicture?.url || defaultProfilePic;
                  const statusClass = String(report.status || "").toLowerCase().replace(/\s+/g, "-");
                  const createdTimeLabel = formatRelativeTime(report.createdAt);
                  
                  return (
                    <article key={report._id || i} className={styles.reportCard}>
                      <div className={styles.reportMetaRow}>
                        <div className={styles.reportHeader}>
                          <img 
                            src={reportUserPic} 
                            alt="Avatar" 
                            className={styles.reportAvatar}
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                          <div className={styles.reportHeaderMain}>
                            <div className={styles.reportUserMeta}>
                              <span className={styles.reportUser}>{report.user.fName} {report.user.lName}</span>
                              {createdTimeLabel && (
                                <span className={styles.reportTime}>{createdTimeLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={`btn btnSecondary ${styles.kebabBtn}`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === i}
                            onClick={() => setOpenMenuId(openMenuId === i ? null : i)}
                            title="Actions"
                          >
                            <span className={styles.kebabIcon}>⋮</span>
                          </button>
                          {openMenuId === i && (
                            <div className={styles.kebabMenu} role="menu">
                              {(() => {
                                const statusNorm = String(report.status || '').toLowerCase().replace(/\s+/g,'-');
                                const canModify = statusNorm === 'pending' || statusNorm === 'awaiting-approval';
                                return (
                                  <>
                                    <button
                                      type="button"
                                      className={`btn btnSecondary ${styles.menuItem}`}
                                      onClick={() => handleAttemptEdit(report)}
                                      title={isLockedStatus(report.status) ? `You can't edit a report that is ${report.status}` : 'Edit this report'}
                                      role="menuitem"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btnDestructive ${styles.menuItem}`}
                                      onClick={() => handleAttemptDelete(report, i)}
                                      title={isLockedStatus(report.status) ? `You can't delete a report that is ${report.status}` : 'Delete this report'}
                                      role="menuitem"
                                    >
                                      Delete
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.reportRow}>
                        <div className={styles.reportContent}>
                          <h3 className={styles.reportTitle}>{report.title}</h3>

                          <p className={styles.reportCategory}>
                            {report.category ?? "Uncategorized"}
                          </p>

                          <p className={styles.reportLocation} title={report.location || ''}>
                            <i className="fa-solid fa-location-dot"></i> {report.location}
                          </p>

                          <div className={styles.statusPriorityRow}>
                            <span className={`${styles.reportStatus} ${styles[statusClass] || ""}`}>
                              {report.status}
                            </span>
                          </div>

                          <p className={styles.reportDetails}>{report.description}</p>
                        </div>

                        <div className={styles.reportImage}>
                          {(() => {
                            const allImages = report.images && report.images.length > 0
                              ? report.images
                              : report.image
                              ? [report.image]
                              : ["/images/broken-streetlights.jpg"];

                            const totalImages = allImages.length;
                            if (totalImages === 0) {
                              return null;
                            }

                            const displayImages = allImages.slice(0, 4);
                            return (
                              <div className={styles.reportImageGallery}>
                                {displayImages.map((img, idx) => {
                                  const isLastImage = idx === 3 && totalImages === 5;

                                  return (
                                    <div
                                      key={idx}
                                      className={styles.reportImageItem}
                                      onClick={() => openLightbox(allImages, idx)}
                                      style={{ position: 'relative', cursor: 'pointer' }}
                                    >
                                      <Image
                                        src={img}
                                        alt={`Report Image ${idx + 1}`}
                                        width={500}
                                        height={250}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "/images/broken-streetlights.jpg";
                                        }}
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
                      </div>

                      <div className={styles.reportComments}>
                        <h4>Comments</h4>
                        <ul className={styles.commentList}>
                          {(report.comments ?? []).map((c, idx) => {
                            const firstName = getCommenterFirstName(c);
                            const commentOwnerId = resolveIdString(c.userId);
                            const commentId = resolveIdString(c._id) || resolveIdString(c.id) || "";
                            const commentMenuKey = `${report._id}:${commentId || idx}`;
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
                              editingComment?.reportId === report._id &&
                              editingComment.commentId === commentId;
                            const createdLabel = c.createdAt ? new Date(c.createdAt).toLocaleString() : null;
                            const editedLabel = c.editedAt ? new Date(c.editedAt).toLocaleString() : null;

                            return (
                              <li key={c._id ?? `${report._id}-comment-${idx}`} className={styles.commentItem}>
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
                                              handleStartEditComment(report._id, c);
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
                                              handleRequestDeleteComment(report._id, commentId, c.text);
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
                              addComment(report._id, e.currentTarget.value);
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </article>
                  );
                  })
                ) : reportsLoading ? (
                  <div className={styles.loaderWrap}>
                    <AdminLoader message="Loading reports..." />
                  </div>
                ) : (
                  <p id="noResults" className={styles.noResults}>No reports found</p>
                )}
              </div>
            </div>
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

      {pendingDeleteComment && (
        <div
          className={styles.commentConfirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteCommentTitle"
          onClick={handleCancelDeleteComment}
        >
          <div
            className={styles.commentConfirmCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.commentConfirmHeader}>
              <span className={styles.commentConfirmIcon} aria-hidden="true">🗑️</span>
              <div>
                <h3 id="deleteCommentTitle" className={styles.commentConfirmTitle}>Delete comment?</h3>
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

      {/* Edit Modal and Delete Modal remain the same */}
      {addModalVisible && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <button className={styles.close} onClick={() => setAddModalVisible(false)} aria-label="Close">&times;</button>
            <h2 className={styles.modalTitle}>Add Report</h2>

            <form
              className={styles.formGrid}
              onSubmit={handleAddReportSubmit}
              aria-busy={isAddSubmitting}
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

                <label className={styles.inputLabel} htmlFor="addImageUpload">Upload Images (Max 5)</label>
                <div className={styles.uploadWrapper}>
                  <input
                    className={styles.fileInput}
                    type="file"
                    id="addImageUpload"
                    name="images"
                    accept="image/*"
                    multiple
                    onChange={handleAddImageChange}
                  />
                  
                  {/* ✅ Image Preview Carousel */}
                  <div className={`${styles.addImagePreviewGrid} ${imagePreviews.length ? styles.addHasImages : ""}`}>
                    {imagePreviews.length > 0 ? (
                      <div className={styles.addPreviewFrame}>
                        {imagePreviews.length > 1 && (
                          <button
                            type="button"
                            className={`${styles.addPreviewNav} ${styles.addPreviewNavPrev}`}
                            onClick={() => handleAddPreviewNavigation("prev")}
                            aria-label="Previous image"
                          >
                            ‹
                          </button>
                        )}

                        <div
                          className={styles.addPreviewSlide}
                          role="button"
                          tabIndex={0}
                          onClick={handleAddPreviewClick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleAddPreviewClick();
                            }
                          }}
                        >
                          <img
                            src={imagePreviews[addPreviewIndex]}
                            alt={`Preview ${addPreviewIndex + 1}`}
                            className={styles.addPreviewImage}
                          />
                        </div>

                        {imagePreviews.length > 1 && (
                          <>
                            <button
                              type="button"
                              className={`${styles.addPreviewNav} ${styles.addPreviewNavNext}`}
                              onClick={() => handleAddPreviewNavigation("next")}
                              aria-label="Next image"
                            >
                              ›
                            </button>
                            <span className={styles.addPreviewCounter}>
                              {addPreviewIndex + 1}/{imagePreviews.length}
                            </span>
                          </>
                        )}

                        <button
                          type="button"
                          className={styles.addRemovePreviewBtn}
                          onClick={() => removeAddImage(addPreviewIndex)}
                          aria-label="Remove image"
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <div className={styles.addUploadPlaceholder}>
                        <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}></i>
                        <p>Click to upload images</p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>Up to 5 images, 5MB each</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formRight}>
                <label className={styles.inputLabel} htmlFor="add-address">Location</label>
                <input
                  className={styles.input}
                  type="text"
                  id="add-address"
                  name="address"
                  placeholder="Search or click on map"
                  value={reportForm.address}
                  onChange={(e) => setReportForm({ ...reportForm, address: e.target.value })}
                  required
                />
                <input type="hidden" id="add-latitude" name="latitude" />
                <input type="hidden" id="add-longitude" name="longitude" />
                <div id="add-modal-map" className={styles.modalMap}></div>

                <div className={styles.urgentToggle}>
                  <input
                    type="checkbox"
                    id="addIsUrgent"
                    name="isUrgent"
                    checked={reportForm.isUrgent}
                    onChange={(e) => setReportForm({ ...reportForm, isUrgent: e.target.checked })}
                  />
                  <label htmlFor="addIsUrgent">Mark as Urgent</label>
                </div>
              </div>

              <div className={styles.submitRow}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isAddSubmitting}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editModalVisible && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <button className={styles.close} onClick={() => setEditModalVisible(false)} aria-label="Close">×</button>
            <h2 className={styles.modalTitle}>Edit Report</h2>

            <form className={styles.formGrid} onSubmit={handleEditSubmit}>
              <div className={styles.formLeft}>
                <input 
                  className={styles.input}
                  type="text" 
                  name="title" 
                  placeholder="Report Title" 
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} 
                />

                <textarea 
                  className={styles.textarea}
                  name="description" 
                  placeholder="Describe the issue..." 
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} 
                />

                {/* Category dropdown added to edit modal (design only) */}
                <select
                  className={styles.input}
                  name="category"
                  value={(editForm as any).category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
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

                <label htmlFor="editImageUpload" className={styles.inputLabel}>
                  Upload Images (Max 5) - {editImagePreviews.length}/5
                </label>
                <div className={styles.uploadWrapper}>
                  <input
                    type="file"
                    id="editImageUpload"
                    name="images"
                    accept="image/*"
                    multiple
                    onChange={onEditImageChange}
                    disabled={editImagePreviews.length >= 5}
                  />

                  <div className={styles.imagePreviewGrid}>
                    {editImagePreviews.slice(0, 4).map((preview, index) => {
                      const isExisting = index < editForm.existingImages.length;
                      const isLastPreview = index === 3 && editImagePreviews.length === 5;
                      
                      return (
                        <div key={index} className={styles.previewItem}>
                          <img 
                            src={preview} 
                            alt={`Preview ${index + 1}`}
                            className={styles.previewImage}
                            style={isLastPreview ? { filter: 'brightness(0.4)' } : {}}
                          />
                          
                          {isLastPreview && (
                            <div className={styles.overlayCount}>
                              +1
                            </div>
                          )}
                          
                          <button
                            type="button"
                            className={styles.removePreviewBtn}
                            onClick={() => {
                              if (isExisting) {
                                handleRemoveExistingImage(preview, index);
                              } else {
                                handleRemoveNewImage(index);
                              }
                            }}
                            aria-label="Remove image"
                          >
                            ✖
                          </button>
                        </div>
                      );
                    })}
                    
                    {editImagePreviews.length === 0 && (
                      <div className={styles.uploadPlaceholder}>
                        <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}></i>
                        <p>No images</p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>Click to upload</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formRight}>
                <label htmlFor="editAddress" className={styles.inputLabel}>Location</label>
                <input 
                  type="text" 
                  id="editAddress" 
                  name="address" 
                  placeholder="Search or click on map"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} 
                />

                <input type="hidden" id="editLatitude" name="latitude" value={String(editForm.latitude ?? "")} />
                <input type="hidden" id="editLongitude" name="longitude" value={String(editForm.longitude ?? "")} />

                <div id="edit-modal-map" ref={editMapRef} className={styles.modalMap} />
              </div>

              <div className={styles.submitRow}>
                <button type="submit" className={styles.submitBtn}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModalVisible && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.confirmModal}>
            <h3 className={styles.confirmTitle}>Delete report</h3>
            <p className={styles.confirmText}>Are you sure you want to delete this report? This action cannot be undone.</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => { setDeleteModalVisible(false); setDeleteTarget(null); }}>Cancel</button>
              <button className={styles.confirmBtn} onClick={performDeleteConfirmed}>Delete</button>
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
      
    </>
  );
}
