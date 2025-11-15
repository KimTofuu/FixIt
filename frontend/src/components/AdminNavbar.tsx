"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./AdminNavbar.module.css";

interface AdminNavbarProps {
  active?:
    | "dashboard"
    | "map"
    | "reports"
    | "users"
    | "flag"
    | "summary"
    | "authorities"
    | "profile";
  profilePicUrl?: string;
}

export default function AdminNavbar({ active, profilePicUrl = "/images/sample_avatar.png" }: AdminNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <nav className={styles.adminNav}>
        <div className={styles.navLeft}>
          <Image
            src="/images/Fix-it_logo_3.png"
            alt="Fixit Logo"
            className={styles.logo}
            width={160}
            height={40}
            priority
          />
        </div>

        {/* Optional hamburger for small screens */}
        <button
          className={`${styles.hamburger} ${menuOpen ? styles.open : ""}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          type="button"
        >
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </button>

        <ul className={`${styles.navListUserSide} ${menuOpen ? styles.open : ""}`}>
          <li className={active === "dashboard" ? styles.activeNavItem : undefined}>
            <a href="/admin-dashboard" className={styles.navLink}>Dashboard</a>
          </li>
          <li className={active === "map" ? styles.activeNavItem : undefined}>
            <a href="/admin-map" className={styles.navLink}>Maps</a>
          </li>
          <li className={active === "summary" ? styles.activeNavItem : undefined}>
            <a href="/admin-summary" className={styles.navLink}>Summary</a>
          </li>
          <li className={active === "reports" ? styles.activeNavItem : undefined}>
            <a href="/admin-reports" className={styles.navLink}>Reports</a>
          </li>
          <li className={active === "flag" ? styles.activeNavItem : undefined}>
            <a href="/admin-flag" className={styles.navLink}>Flagged</a>
          </li>
          <li className={active === "users" ? styles.activeNavItem : undefined}>
            <a href="/admin-users" className={styles.navLink}>Users</a>
          </li>
          <li className={active === "authorities" ? styles.activeNavItem : undefined}>
            <a href="/admin-authorities" className={styles.navLink}>Authorities</a>
          </li>
        </ul>

        <div className={styles.bottomNav}>
          <a href="/admin-profile" className={`${styles.adminProfileLink} ${active === "profile" ? styles.activeNavItem : ""}`}>
            <Image
              src={profilePicUrl}
              alt="Admin Profile"
              className={styles.adminProfilePic}
              width={48}
              height={48}
              priority={false}
            />
          </a>
        </div>
      </nav>
    </header>
  );
}
