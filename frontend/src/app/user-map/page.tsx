"use client";
import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./user-map.module.css";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

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

interface Report {
  _id: string;
  user?: {
    fName: string;
    lName: string;
    profilePicture?: {
      url?: string;
      public_id?: string;
    };
  };
  title: string;
  description: string;
  status: string;
  location: string;
  category: string;
  isUrgent?: boolean;
  images?: string[];
  image?: string;
  latitude?: string | number;
  longitude?: string | number;
}

export default function UserMapPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedMapRef = useRef<L.Map | null>(null);
  const modalMapRef = useRef<L.Map | null>(null);
  const modalMarkerRef = useRef<L.Marker | null>(null);

  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Custom pin icon by status
  const getIconByStatus = (status?: string) => {
    const s = (status || "").toLowerCase();
    let iconUrl = "/images/pin_reported.png"; // default to reported-style
    if (s.includes("resolve")) {
      iconUrl = "/images/pin_resolved.png";
    } else if (s.includes("progress") || s.includes("process")) {
      // in-progress or processing
      iconUrl = "/images/pin_inprogress.png";
    } else if (s.includes("pending") || s.includes("report")) {
      iconUrl = "/images/pin_reported.png";
    }
    return L.icon({
      iconUrl,
      // Slightly wider, slightly shorter
      iconSize: [36, 44],
      iconAnchor: [18, 44], // bottom-center tip
      popupAnchor: [0, -40],
    });
  };

  // Neutral base pin (used for modal selection marker)
  const basePin = L.icon({
    iconUrl: "/images/pin.png",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -40],
  });

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
          console.log("📸 Profile picture URL:", data.profilePicture?.url);

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
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API}/reports`);
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Reports loaded:", data);
          // Filter out reports that are awaiting approval so they don't appear in the public map
          const visibleReports = (data || []).filter((r: any) => {
            const status = (r?.status || "").toString();
            return !/approval/i.test(status);
          });
          setReports(visibleReports);
        }
      } catch (err) {
        console.error("Failed to fetch reports", err);
      }
    };
    fetchReports();
  }, [API]);

  useEffect(() => {
    if (feedMapRef.current) return;

    // ✅ Wait for DOM to be ready
    const mapElement = document.getElementById("map");
    if (!mapElement) {
      console.warn('Map element not found in DOM yet');
      return;
    }

    try {
      const feedMap = L.map("map").setView([14.8292, 120.2828], 13);
      feedMapRef.current = feedMap;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      }).addTo(feedMap);

      // ✅ Ensure map is ready before continuing
      feedMap.whenReady(() => {
        console.log('✅ Feed map is ready');
        setTimeout(() => {
          try { 
            feedMap.invalidateSize(); 
          } catch (e) { 
            console.error('Error invalidating map size:', e);
          }
        }, 200);
      });

      const onResize = () => { 
        try { 
          feedMap.invalidateSize(); 
        } catch (e) {
          console.error('Error on resize:', e);
        } 
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        try { 
          feedMap.remove(); 
          feedMapRef.current = null;
        } catch (e) {
          console.error('Error removing map:', e);
        }
      };
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }, []);

  useEffect(() => {
    const feedMap = feedMapRef.current;
    if (!feedMap) return;

    // ✅ Wait for map to be fully ready
    if (!feedMap.getContainer()) {
      console.warn('Map container not ready yet');
      return;
    }

    // Remove existing markers
    feedMap.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        feedMap.removeLayer(layer);
      }
    });

    const locationCounts = new Map<string, number>();

    reports.forEach((r) => {
      if (r.latitude && r.longitude) {
        try {
          const lat = parseFloat(String(r.latitude));
          const lng = parseFloat(String(r.longitude));
          
          // ✅ Validate coordinates
          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for report ${r._id}:`, { lat, lng });
            return;
          }

          const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
          const occurrence = locationCounts.get(key) ?? 0;
          locationCounts.set(key, occurrence + 1);

          // Offset overlapping markers slightly so repeated coordinates stay visible
          let markerLat = lat;
          let markerLng = lng;
          if (occurrence > 0) {
            const angle = (occurrence * 45 * Math.PI) / 180;
            const radius = 0.0002 * occurrence;
            markerLat = lat + radius * Math.cos(angle);
            markerLng = lng + radius * Math.sin(angle);
          }

          const m = L.marker([markerLat, markerLng], {
            icon: getIconByStatus(r.status),
          }).addTo(feedMap);
          
          const userName = r.user ? `${r.user.fName} ${r.user.lName}` : 'Anonymous';
          const userPic = r.user?.profilePicture?.url || defaultProfilePic;
          
          // ✅ Get all images
          const allImages = r.images && r.images.length > 0 ? r.images : r.image ? [r.image] : [];
          const imageCount = allImages.length;
          
          m.bindPopup(`
            <div style="text-align: center; min-width: 200px;">
              <img src="${userPic}" alt="${userName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;" />
              <br>
              <b>${r.title}</b><br>
              <b>Reported by:</b> ${userName}<br>
              <b>Status:</b> ${r.status}<br>
              <b>Location:</b> ${r.location}<br>
              ${imageCount > 0 ? `<b>Images:</b> ${imageCount}` : ''}
              ${occurrence > 0 ? '<div style="margin-top:8px; font-size:12px; color:#64748b;">Pin offset from exact location to show overlapping reports.</div>' : ''}
            </div>
          `);
        } catch (error) {
          console.error(`Failed to add marker for report ${r._id}:`, error);
        }
      }
    });
  }, [reports, defaultProfilePic]);

  useEffect(() => {
    if (!modalOpen || modalMapRef.current) return;

    // ✅ Wait for modal map element
    const modalMapElement = document.getElementById("modal-map");
    if (!modalMapElement) {
      console.warn('Modal map element not found yet');
      return;
    }

    try {
      const modalMap = L.map("modal-map").setView([14.8292, 120.2828], 13);
      modalMapRef.current = modalMap;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(modalMap);

      modalMap.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        if (modalMarkerRef.current) {
          modalMarkerRef.current.setLatLng([lat, lng]);
        } else {
          modalMarkerRef.current = L.marker([lat, lng], {
            icon: basePin,
          }).addTo(modalMap);
        }

        (document.getElementById("latitude") as HTMLInputElement).value =
          lat.toString();
        (document.getElementById("longitude") as HTMLInputElement).value =
          lng.toString();

        const address = await getAddressFromCoords(lat, lng);
        (document.getElementById("address") as HTMLInputElement).value =
          address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        setReportForm((prev) => ({
          ...prev,
          address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          latitude: lat.toString(),
          longitude: lng.toString(),
        }));
      });

      // ✅ Wait for modal map to be ready
      modalMap.whenReady(() => {
        console.log('✅ Modal map is ready');
        setTimeout(() => {
          try {
            modalMap.invalidateSize();
          } catch (e) {
            console.error('Error invalidating modal map:', e);
          }
        }, 200);
      });
    } catch (error) {
      console.error('Failed to initialize modal map:', error);
    }
  }, [modalOpen]);

  async function getAddressFromCoords(
    lat: number,
    lng: number
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      return data.display_name;
    } catch {
      return null;
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setPreviewIndex(0);
    });
  };

  const handlePreviewNavigation = (direction: "next" | "prev") => {
    if (imagePreviews.length <= 1) return;

    setPreviewIndex((prev) => {
      const total = imagePreviews.length;
      return direction === "next"
        ? (prev + 1) % total
        : (prev - 1 + total) % total;
    });
  };

  const handlePreviewClick = () => {
    const current = imagePreviews[previewIndex];
    if (!current) return;

    if (typeof window !== "undefined") {
      window.open(current, "_blank", "noopener,noreferrer");
    }
  };

  const handleRemovePreview = (index: number) => {
    setReportForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));

    setImagePreviews((prevPreviews) => {
      const nextPreviews = prevPreviews.filter((_, i) => i !== index);

      setPreviewIndex((current) => {
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

    setIsSubmitting(true);

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
        const data = await res.json();
        const createdReport = data.report || data;
        toast.success("Report submitted successfully!");

        if (createdReport.latitude) {
          createdReport.latitude = parseFloat(String(createdReport.latitude));
        }
        if (createdReport.longitude) {
          createdReport.longitude = parseFloat(String(createdReport.longitude));
        }

        const statusStr = String(createdReport.status || "");
        if (!/approval/i.test(statusStr)) {
          setReports((prev) => [createdReport, ...prev]);
        } else {
          toast.info("Report submitted and is awaiting approval before appearing in the public feed.");
        }

        // ✅ Reset form including images
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
        setModalOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to submit report");
      }
    } catch (error) {
      toast.error("An error occurred while submitting the report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, '', '/user-map');
    }
  }, [searchParams]);

  const profilePicUrl = userProfile?.profilePicture?.url || defaultProfilePic;

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

      {isSubmitting && (
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

      <header className={styles.overlayNav}>
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

          <ul
            className={`${styles.navList} ${menuOpen ? styles.open : ""}`}
            onClick={() => setMenuOpen(false)}
          >
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
                  src={profilePicUrl}
                  alt="User Profile"
                  className={styles.profilePic}
                  style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    console.error('Failed to load profile picture');
                    (e.target as HTMLImageElement).src = defaultProfilePic;
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

      <main className={styles.fullMapWrap}>
        <div id="map" className={styles.fullMap} aria-label="Community map"></div>

        <button
          className={`${styles.reportBtn} btn btnPrimary`}
          onClick={() => setModalOpen(true)}
          aria-label="Add report"
        >
          Add Report
        </button>
      </main>

      {modalOpen && (
        <div id="reportModal" className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <button
              className={styles.close}
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className={styles.modalTitle}>Add Report</h2>

            <form
              className={styles.formGrid}
              onSubmit={handleReportSubmit}
              aria-busy={isSubmitting}
            >
              <div className={styles.formLeft}>
                <input
                  className={styles.input}
                  type="text"
                  name="title"
                  placeholder="Report Title"
                  value={reportForm.title}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, title: e.target.value })
                  }
                  required
                />
                <textarea
                  className={styles.textarea}
                  name="description"
                  placeholder="Describe the issue..."
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm({
                      ...reportForm,
                      description: e.target.value,
                    })
                  }
                  required
                />
                <select
                  className={styles.input}
                  name="category"
                  value={reportForm.category}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, category: e.target.value })
                  }
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
                    onChange={handleImageChange}
                  />
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
                          onClick={handlePreviewClick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handlePreviewClick();
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
                          style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }}
                        ></i>
                        <p>Click to upload images</p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>Up to 5 images, 5MB each</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formRight}>
                <label className={styles.inputLabel} htmlFor="address">
                  Location
                </label>
                <input
                  className={styles.input}
                  type="text"
                  id="address"
                  name="address"
                  placeholder="Search or click on map"
                  value={reportForm.address}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, address: e.target.value })
                  }
                  required
                />
                <input type="hidden" id="latitude" name="latitude" />
                <input type="hidden" id="longitude" name="longitude" />
                <div id="modal-map" className={styles.modalMap}></div>

                <div className={styles.urgentToggle}>
                  <input
                    type="checkbox"
                    id="isUrgent"
                    name="isUrgent"
                    checked={reportForm.isUrgent}
                    onChange={(e) =>
                      setReportForm({ ...reportForm, isUrgent: e.target.checked })
                    }
                  />
                  <label htmlFor="isUrgent">Mark as Urgent</label>
                </div>
              </div>

              <div className={styles.submitRow}>
                <button
                  type="submit"
                  className={`${styles.submitBtn} btn btnPrimary`}
                  disabled={isSubmitting}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
