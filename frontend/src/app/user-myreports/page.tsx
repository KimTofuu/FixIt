"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./user-myreports.module.css";
import { toast } from "react-toastify";
import { useRouter, usePathname } from "next/navigation";

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
  comments?: { author: string; text: string }[];
  priority?: "urgent" | "not urgent" | string;
  category?: string;
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

export default function UserMyReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; index: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Add Report modal state (from user-map)
  const [addModalVisible, setAddModalVisible] = useState(false);
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

  const editMapRef = useRef<HTMLDivElement | null>(null);
  const [LRef, setLRef] = useState<any>(null);
  const [editMap, setEditMap] = useState<any>(null);
  const [editMarker, setEditMarker] = useState<any>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const profilePicUrl = userProfile?.profilePicture?.url || defaultProfilePic;

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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/reports/my`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const myReports = await res.json();
          setReports(myReports);
        } else {
          console.error("Failed to fetch my reports", await res.text());
        }
      } catch (err) {
        console.error("Failed to fetch my reports", err);
      }
    };
    fetchReports();
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
        longitude: lat.toString(),
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

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error("Each image must be less than 5MB");
      return;
    }

    setReportForm({ ...reportForm, images: files });

    const previews = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previews).then(setImagePreviews);
  };

  // ✅ Update removeAddImage to handle individual removal
  const removeAddImage = (index: number) => {
    const newImages = reportForm.images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setReportForm({ ...reportForm, images: newImages });
    setImagePreviews(newPreviews);
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
        setAddModalVisible(false);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to submit report");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit report");
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

  const handleComment = (index: number, comment: string) => {
    if (!comment.trim()) return;
    const updatedReports = [...reports];
    updatedReports[index].comments = updatedReports[index].comments || [];
    updatedReports[index].comments.push({ author: "You", text: comment });
    setReports(updatedReports);
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
    <div className={styles.pageWrap}>
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

          <ul className={`${styles.navList} ${menuOpen ? styles.open : ""}`}>
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

      <main className={styles.feedContainer}>
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
                  
                  return (
                    <article key={report._id || i} className={styles.reportCard}>
                      <div className={styles.reportRow}>
                        <div className={styles.reportContent}>
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
                            <span className={styles.reportUser}>{report.user.fName} {report.user.lName}</span>
                          </div>

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

                          <div className={styles.reportImageGallery}>
                            {(() => {
                              const allImages = report.images && report.images.length > 0 
                                ? report.images 
                                : report.image 
                                ? [report.image] 
                                : ["/images/broken-streetlights.jpg"];
                              
                              const displayImages = allImages.slice(0, 4);
                              const totalImages = allImages.length;
                              
                              return displayImages.map((img, idx) => {
                                const isLastImage = idx === 3 && totalImages === 5;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={styles.reportImageItem}
                                    onClick={() => openLightbox(allImages, idx)} // ✅ Make clickable
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
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className={styles.reportComments}>
                        <h4>Comments</h4>
                        <ul className={styles.commentList}>
                          {(report.comments ?? []).map((c, j) => (
                            <li key={j}><b>{c.author}:</b> {c.text}</li>
                          ))}
                        </ul>
                        <input type="text" className={styles.commentInput} placeholder="Add a comment..." onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleComment(i, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }} />
                      </div>
                    </article>
                  );
                })
              ) : (
                <p id="noResults" className={styles.noResults}>No reports found</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Edit Modal and Delete Modal remain the same */}
      {addModalVisible && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <button className={styles.close} onClick={() => setAddModalVisible(false)} aria-label="Close">&times;</button>
            <h2 className={styles.modalTitle}>Add Report</h2>

            <form className={styles.formGrid} onSubmit={handleAddReportSubmit}>
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
                  
                  {/* ✅ Image Previews Grid */}
                  <div className={styles.imagePreviewGrid}>
                    {imagePreviews.slice(0, 4).map((preview, index) => {
                      const isLastPreview = index === 3 && imagePreviews.length === 5;
                      
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
                            onClick={() => removeAddImage(index)}
                            aria-label="Remove image"
                          >
                            ✖
                          </button>
                        </div>
                      );
                    })}
                    
                    {imagePreviews.length === 0 && (
                      <div className={styles.uploadPlaceholder}>
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
                <button type="submit" className={styles.submitBtn}>Submit Report</button>
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
      
    </div>
  );
}
