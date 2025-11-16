"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import AdminLoader from "@/components/AdminLoader";
import styles from "./admin-profile.module.css";
import AdminNavbar from "@/components/AdminNavbar";
import { useRouter } from "next/navigation";

interface ProfileData {
  barangayName: string;
  officialEmail: string;
  password: string;
  barangayAddress: string;
  municipality: string;
  officialContact: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>({
    barangayName: "",
    officialEmail: "",
    password: "",
    barangayAddress: "",
    municipality: "",
    officialContact: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
      }
    }, [router]);

  // Fetch admin profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          window.location.href = "/login";
          return;
        }

        const res = await fetch(`${API}/admin/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setProfile({
            barangayName: data.barangayName || "",
            officialEmail: data.officialEmail || "",
            password: "", // Don't populate password field
            barangayAddress: data.barangayAddress || "",
            municipality: data.municipality || "",
            officialContact: data.officialContact || "",
          });
        } else if (res.status === 401 || res.status === 403) {
          toast.error("Session expired. Please log in again.");
          localStorage.removeItem("token");
          window.location.href = "/login";
        } else {
          toast.error("Failed to load profile");
        }
      } catch (error) {
        console.error("Fetch profile error:", error);
        toast.error("An error occurred while loading your profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [API]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");

      // Prepare update data (only send fields that are not empty)
      const updateData: any = {
        barangayName: profile.barangayName,
        barangayAddress: profile.barangayAddress,
        municipality: profile.municipality,
        officialContact: profile.officialContact,
      };

      // Only include password if it was changed
      if (profile.password) {
        updateData.password = profile.password;
      }

      const res = await fetch(`${API}/admin/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Profile updated successfully!");
        setIsEditing(false);

        // Clear password field after save
        setProfile((prev) => ({ ...prev, password: "" }));
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Save profile error:", error);
      toast.error("An error occurred while saving your profile");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    toast.success("Logged out successfully");
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className={styles.adminReportsRoot}>
        <AdminNavbar active="profile" />
        <div className={styles.reportsPage}>
          <main className={styles.mainContainer}>
            <div className={styles.contentCard}>
              <AdminLoader message="Loading profile..." fullHeight />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminReportsRoot}>
      <AdminNavbar active="profile" />

      <div className={styles.reportsPage}>
        <main id="profile-page" className={styles.mainContainer}>
          <div className={styles.contentCard}>

            <div className={styles.profileContainer}>
              <div className={styles.profileHeader}>
                <div className={styles.profileAvatar}>
                  <img
                    src="/images/sample_avatar.png"
                    alt={profile.barangayName}
                    className={styles.profileAvatarImg}
                    width={96}
                    height={96}
                  />
                </div>
                <div className={styles.profileName}>
                  <h2 className={styles.profileFullName}>{profile.barangayName}</h2>
                  <p className={styles.profileEmail}>{profile.officialEmail}</p>
                </div>
              </div>

              {/*
                Using a more flexible approach to render profile fields.
                This allows easier modifications and additions in the future.
              */}
              <div className={styles.profileFields}>
                <div className={styles.profileField}>
                  <label htmlFor="barangayName" className={styles.fieldLabel}>Barangay Name</label>
                  <input
                    id="barangayName"
                    name="barangayName"
                    type="text"
                    value={profile.barangayName}
                    disabled={!isEditing}
                    onChange={handleChange}
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.profileField}>
                  <label htmlFor="officialEmail" className={styles.fieldLabel}>Email</label>
                  <input
                    id="officialEmail"
                    name="officialEmail"
                    type="email"
                    value={profile.officialEmail}
                    disabled
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.profileField}>
                  <label htmlFor="password" className={styles.fieldLabel}>Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={profile.password}
                    disabled={!isEditing}
                    onChange={handleChange}
                    placeholder="**********"
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.profileField}>
                  <label htmlFor="barangayAddress" className={styles.fieldLabel}>Barangay Address</label>
                  <input
                    id="barangayAddress"
                    name="barangayAddress"
                    type="text"
                    value={profile.barangayAddress}
                    disabled={!isEditing}
                    onChange={handleChange}
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.profileField}>
                  <label htmlFor="municipality" className={styles.fieldLabel}>Municipality</label>
                  <input
                    id="municipality"
                    name="municipality"
                    type="text"
                    value={profile.municipality}
                    disabled={!isEditing}
                    onChange={handleChange}
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.profileField}>
                  <label htmlFor="officialContact" className={styles.fieldLabel}>Contact Number</label>
                  <input
                    id="officialContact"
                    name="officialContact"
                    type="tel"
                    value={profile.officialContact}
                    disabled={!isEditing}
                    onChange={handleChange}
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className={styles.profileActions}>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={styles.editBtn}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setProfile((prev) => ({ ...prev, password: "" }));
                      }}
                      className={styles.editBtn}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className={styles.saveBtn}
                    >
                      Save
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className={styles.logoutBtnProminent}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showLogoutModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className={styles.modal}>
            <h3 id="logout-title" className={styles.modalTitle}>Confirm Log Out</h3>
            <p className={styles.modalBody}>Are you sure you want to log out? You will need to sign in again to access the admin dashboard.</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
