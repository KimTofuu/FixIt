"use client";

import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./AdminMap.module.css";
import Image from "next/image";
import AdminNavbar from "@/components/AdminNavbar";

interface Report {
  id: number;
  title: string;
  status: "Reported" | "Processing" | "Resolved";
  location: string;
  latitude?: string;
  longitude?: string;
}

type StatusFilter = "Reported" | "Processing" | "Resolved" | "All";

export default function AdminMapPage() {
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
      shadowUrl: "/images/marker-shadow.png",
      shadowSize: [41, 41],
    });
  };

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
          latitude: r.latitude?.toString?.() || r.lat?.toString?.() || "",
          longitude: r.longitude?.toString?.() || r.lng?.toString?.() || "",
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
                  latitude: r.latitude?.toString?.() || r.lat?.toString?.() || "",
                  longitude: r.longitude?.toString?.() || r.lng?.toString?.() || "",
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

    let reportsToShow: Report[] = [];
    if (filterStatus === "Resolved") {
      reportsToShow = resolvedReports;
    } else if (filterStatus === "All") {
      const nonResolved = reports.filter((r) => r.status !== "Resolved");
      reportsToShow = [...nonResolved];
    } else {
      reportsToShow = reports.filter((report) => report.status === filterStatus);
    }

    reportsToShow.forEach((report: Report) => {
      if (report.latitude && report.longitude) {
        const lat = parseFloat(report.latitude as string);
        const lng = parseFloat(report.longitude as string);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], { icon: getIconByStatus(report.status) }).addTo(map);
        marker.bindPopup(`
          <b>${report.title}</b><br>
          <b>Status:</b> ${report.status}<br>
          <b>Location:</b> ${report.location}
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