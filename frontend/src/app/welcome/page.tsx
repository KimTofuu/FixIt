"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import styles from "./Welcome.module.css";

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileData, setProfileData] = useState({
    barangay: "",
    municipality: "",
    contact: "",
  });

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    const isNew = searchParams.get("new");
    
    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      window.history.replaceState({}, "", "/welcome");
      setIsAuthenticated(true);
      
      // Show profile form for new Google users
      if (isNew === "true") {
        checkProfileCompletion();
      }
    } else {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
        checkProfileCompletion();
      }
    }
  }, [router, searchParams]);

  const checkProfileCompletion = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const user = await res.json();
        // Show form if barangay or municipality is missing
        if (!user.barangay || !user.municipality) {
          setShowProfileForm(true);
        }
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (res.ok) {
        toast.success("Profile completed!");
        setShowProfileForm(false);
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile");
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <Image
            src="/images/Fix-it_logo_3.png"
            alt="FixItPH logo"
            className={styles.logo}
            width={160}
            height={40}
            priority
          />
        </nav>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          {showProfileForm ? (
            <>
              <h1 className={styles.title}>Complete your profile</h1>
              <p className={styles.subtitle}>
                Add your barangay and municipality so we can route your future reports to the correct officials.
              </p>

              <form className={styles.form} onSubmit={handleProfileSubmit} autoComplete="off">
                <div className={styles.field}>
                  <label htmlFor="barangay" className={styles.label}>
                    Barangay
                  </label>
                  <input
                    id="barangay"
                    name="barangay"
                    type="text"
                    className={styles.input}
                    value={profileData.barangay}
                    onChange={(e) => setProfileData({ ...profileData, barangay: e.target.value })}
                    required
                    autoComplete="address-level4"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="municipality" className={styles.label}>
                    Municipality
                  </label>
                  <input
                    id="municipality"
                    name="municipality"
                    type="text"
                    className={styles.input}
                    value={profileData.municipality}
                    onChange={(e) => setProfileData({ ...profileData, municipality: e.target.value })}
                    required
                    autoComplete="address-level2"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="contact" className={styles.label}>
                    Contact number <span className={styles.note}>(optional)</span>
                  </label>
                  <input
                    id="contact"
                    name="contact"
                    type="tel"
                    className={styles.input}
                    value={profileData.contact}
                    onChange={(e) => setProfileData({ ...profileData, contact: e.target.value })}
                    autoComplete="tel"
                  />
                </div>

                <div className={styles.buttonRow}>
                  <button type="submit" className={styles.primaryButton}>
                    Complete profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(false)}
                    className={styles.secondaryButton}
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Welcome, Resident!</h1>
              <p className={styles.subtitle}>
                FixItPH keeps your community responsive. Submit issues, track progress, and stay informed about every
                resolution around you.
              </p>
              <ul className={styles.list}>
                <li className={styles.listItem}>Report local issues like potholes, flooding, and broken streetlights.</li>
                <li className={styles.listItem}>Monitor the progress of each submission in real time.</li>
                <li className={styles.listItem}>See resolved cases and key updates tailored to your barangay.</li>
              </ul>
              <Link href="/user-map" className={styles.primaryButton}>
                Continue
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
