"use client";

import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./AdminMap.module.css";
import Image from "next/image";
import AdminNavbar from "@/components/AdminNavbar";
import { useRouter } from "next/navigation";

interface Report {
  id: string | number;
  title: string;
  status: "Reported" | "Processing" | "Resolved" | string;
  location: string;
  latitude?: string | number;
  longitude?: string | number;
  user?: {
    fName?: string;
    lName?: string;
    profilePicture?: {
      url?: string;
      public_id?: string;
    };
  };
  images?: string[];
  image?: string;
}

type StatusFilter = "Reported" | "Processing" | "Resolved" | "All";

const isAwaitingApproval = (status?: string) =>
  typeof status === "string" && status.toLowerCase().includes("awaiting");

export default function AdminMapPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [resolvedReports, setResolvedReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({
    reported: 0,
    processing: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  
  const mapRef = useRef<L.Map | null>(null);
  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // Choose pin icon based on report status
  const getIconByStatus = (status?: string) => {
    const s = (status || "").toLowerCase();
    let iconUrl = "/images/pin_reported.png"; // default: reported / pending
    if (s.includes("resolve")) {
      iconUrl = "/images/pin_resolved.png";
    } else if (s.includes("progress") || s.includes("process")) {
      iconUrl = "/images/pin_inprogress.png";
    } else if (s.includes("pending") || s.includes("report")) {
      iconUrl = "/images/pin_reported.png";
    }
    return L.icon({
      iconUrl,
      // Slightly wider, slightly shorter
      iconSize: [36, 44],
      iconAnchor: [18, 44], // bottom-center
      popupAnchor: [0, -40],
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [resAll, resResolved] = await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/resolvedReports`),
        ]);

        if (resAll.status !== "fulfilled" || !resAll.value.ok) {
          throw new Error("Failed to fetch reports from API");
        }

        const data: any[] = await resAll.value.json();

        const normalizeStatus = (s?: string) => {
          if (!s) return "Reported";
          const lower = s.toLowerCase();
          if (lower === "pending" || lower === "reported") return "Reported";
          if (lower === "in-progress" || lower === "processing") return "Processing";
          if (lower === "resolved") return "Resolved";
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        };

        const transformed: Report[] = data.map((r) => ({
          id: r._id || r.id,
          title: r.title || r.subject || "No title",
          status: normalizeStatus((r as any).status) as Report["status"],
          location: r.location || r.address || "",
          latitude: r.latitude ?? r.lat ?? "",
          longitude: r.longitude ?? r.lng ?? "",
          user: r.user || r.reporter || undefined,
          images: Array.isArray(r.images) ? r.images : undefined,
          image: typeof r.image === "string" ? r.image : undefined,
        }));

        setReports(transformed);

        let resolvedCount = 0;
        if (resResolved.status === "fulfilled" && resResolved.value.ok) {
          try {
            const resolvedData = await resResolved.value.json();
            const resolvedTransformed: Report[] = Array.isArray(resolvedData)
              ? resolvedData.map((r: any) => ({
                  id: r._id || r.id,
                  title: r.title || r.subject || "No title",
                  status: "Resolved",
                  location: r.location || r.address || "",
                  latitude: r.latitude ?? r.lat ?? "",
                  longitude: r.longitude ?? r.lng ?? "",
                  user: r.user || r.reporter || undefined,
                  images: Array.isArray(r.images) ? r.images : undefined,
                  image: typeof r.image === "string" ? r.image : undefined,
                }))
              : [];
            setResolvedReports(resolvedTransformed);
            resolvedCount = resolvedTransformed.length;
          } catch {
            setResolvedReports([]);
            resolvedCount = transformed.filter((r) => r.status === "Resolved").length;
          }
        } else {
          setResolvedReports([]);
          resolvedCount = transformed.filter((r) => r.status === "Resolved").length;
        }

        setStats({
          reported: transformed.filter((r) => r.status === "Reported").length,
          processing: transformed.filter((r) => r.status === "Processing").length,
          resolved: resolvedCount,
        });
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map("map").setView([14.8292, 120.2828], 13);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    }).addTo(map);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const activeReports = reports.filter((r) => !isAwaitingApproval(r.status));
    const activeResolved = resolvedReports.filter((r) => !isAwaitingApproval(r.status));

    let reportsToShow: Report[] = [];
    if (filterStatus === "Resolved") {
      reportsToShow = activeResolved;
    } else if (filterStatus === "All") {
      const nonResolved = activeReports.filter((r) => r.status !== "Resolved");
      reportsToShow = [...nonResolved];
    } else {
      reportsToShow = activeReports.filter((report) => report.status === filterStatus);
    }

    reportsToShow.forEach((report: Report) => {
      if (isAwaitingApproval(report.status)) return;
      if (report.latitude != null && report.longitude != null) {
        const lat = parseFloat(String(report.latitude));
        const lng = parseFloat(String(report.longitude));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], { icon: getIconByStatus(report.status) }).addTo(map);

        const userName = report.user ? `${report.user.fName ?? ""} ${report.user.lName ?? ""}`.trim() || "Anonymous" : "Anonymous";
        const userPic = report.user?.profilePicture?.url || defaultProfilePic;
        const allImages = (report.images && report.images.length > 0)
          ? report.images
          : report.image
            ? [report.image]
            : [];
        const imageCount = allImages.length;

        marker.bindPopup(`
          <div style="text-align: center; min-width: 200px;">
            <img src="${userPic}" alt="${userName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;" />
            <br>
            <b>${report.title}</b><br>
            <b>Reported by:</b> ${userName}<br>
            <b>Status:</b> ${report.status}<br>
            <b>Location:</b> ${report.location}<br>
            ${imageCount > 0 ? `<b>Images:</b> ${imageCount}` : ''}
          </div>
        `);
      }
    });
  }, [reports, resolvedReports, filterStatus]);

  const handleFilterClick = (status: StatusFilter) => {
    setFilterStatus((prevStatus) => (prevStatus === status ? "All" : status));
  };

  return (
    <>
      <Head>
        <title>FixIt PH - Admin Map</title>
        <link
          href="https://fonts.googleapis.com/css?family=Inter"
          rel="stylesheet"
        />
        <script
          src="https://kit.fontawesome.com/830b39c5c0.js"
          crossOrigin="anonymous"
          defer
        ></script>
      </Head>

      <div className={styles.adminReportsRoot}>
        <AdminNavbar active="map" />

        <main className={styles.reportsPage}>
          <div className={styles.mainContainer}>
            <div className={styles.contentCard}>
              <div className={styles.statsAndMap}>
                <div
                  className={`${styles.reportsStats} ${styles.floatingStats}`}
                  role="region"
                  aria-label="Reports stats"
                >
                  <div
                    className={`${styles.statCard} ${filterStatus === "Reported" ? styles.activeCard : ""}`}
                    onClick={() => handleFilterClick("Reported")}
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    <h3>Reported</h3>
                    <h1>{loading ? "..." : stats.reported}</h1>
                  </div>

                  <div
                    className={`${styles.statCard} ${filterStatus === "Processing" ? styles.activeCard : ""}`}
                    onClick={() => handleFilterClick("Processing")}
                    style={{ background: "#f59e0b", color: "#fff" }}
                  >
                    <h3>Processing</h3>
                    <h1>{loading ? "..." : stats.processing}</h1>
                  </div>

                  <div
                    className={`${styles.statCard} ${filterStatus === "Resolved" ? styles.activeCard : ""}`}
                    onClick={() => handleFilterClick("Resolved")}
                    style={{ background: "#10b981", color: "#fff" }}
                  >
                    <h3>Resolved</h3>
                    <h1>{loading ? "..." : stats.resolved}</h1>
                  </div>
                </div>

                <div id="map" className={`${styles.map} ${styles.mapFull}`} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}