"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ProfilePage.module.css";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import AdminLoader from "@/components/AdminLoader";

interface Badge {
  name: string;
  icon: string;
  earnedAt: string;
  _id?: string;
}

interface ProfileData {
  _id: string;
  fName: string;
  lName: string;
  email: string;
  barangay?: string;
  municipality?: string;
  contact?: string;
  contactVerified?: boolean;
  profilePicture?: {
    url?: string;
    public_id?: string;
  };
  reputation?: {
    points: number;
    level: string;
    badges: Badge[];
    totalReports: number;
    verifiedReports: number;
    resolvedReports: number;
    helpfulVotes: number;
  };
}

const normalizeProfilePicture = (incoming: unknown): ProfileData["profilePicture"] => {
  if (!incoming) {
    return { url: "", public_id: "" };
  }

  if (typeof incoming === "string") {
    return { url: incoming, public_id: "" };
  }

  if (typeof incoming === "object") {
    const source = incoming as { url?: string; secure_url?: string; public_id?: string; publicId?: string };
    const url = source.url || source.secure_url || "";
    const publicId = source.public_id || source.publicId || "";
    return { url, public_id: publicId };
  }

  return { url: "", public_id: "" };
};

const normalizeReputation = (incoming: any): NonNullable<ProfileData["reputation"]> => {
  const fallback = {
    points: 0,
    level: "Newcomer",
    badges: [] as Badge[],
    totalReports: 0,
    verifiedReports: 0,
    resolvedReports: 0,
    helpfulVotes: 0,
  };

  if (!incoming || typeof incoming !== "object") {
    return fallback;
  }

  const safeBadges: Badge[] = Array.isArray(incoming.badges)
    ? incoming.badges.map((badge: any) => ({
        name: badge?.name || "Badge",
        icon: badge?.icon || "🏅",
        earnedAt: badge?.earnedAt || "",
        _id: badge?._id || badge?.id,
      }))
    : [];

  return {
    points: Number(incoming.points ?? fallback.points),
    level: incoming.level || fallback.level,
    badges: safeBadges,
    totalReports: Number(incoming.totalReports ?? fallback.totalReports),
    verifiedReports: Number(incoming.verifiedReports ?? fallback.verifiedReports),
    resolvedReports: Number(incoming.resolvedReports ?? fallback.resolvedReports),
    helpfulVotes: Number(incoming.helpfulVotes ?? fallback.helpfulVotes),
  };
};

const normalizeProfileData = (data: any): ProfileData => ({
  _id: data?._id || data?.id || "",
  fName: data?.fName || "",
  lName: data?.lName || "",
  email: data?.email || "",
  barangay: data?.barangay || "",
  municipality: data?.municipality || "",
  contact: data?.contact || "",
  contactVerified: Boolean(data?.contactVerified),
  profilePicture: normalizeProfilePicture(data?.profilePicture),
  reputation: normalizeReputation(data?.reputation),
});

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'reputation'>('profile');
  const pathname = usePathname();

  // Change password modal state
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // SMS verification state
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsOtp, setSmsOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Profile picture state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Badge detail modal state
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);

  const defaultProfilePic = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchProfile = useCallback(async () => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API}/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        console.warn("Failed to load profile:", res.status);
        return;
      }
      const data = await res.json();
      setProfile(normalizeProfileData(data));
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, [API]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    void fetchProfile();
  }, [router, fetchProfile]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(target)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    setProfile((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;
      const res = await fetch(`${API}/users/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Update failed");
        return;
      }
      const updated = await res.json();
      setProfile(normalizeProfileData(updated));
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      console.error("Save profile error:", err);
      toast.error("Network error");
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingPicture(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append('profilePicture', file);

      const res = await fetch(`${API}/users/me/profile-picture`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Upload failed');
        return;
      }

      toast.success('Profile picture updated!');

      // Refresh profile
      const profileRes = await fetch(`${API}/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (profileRes.ok) {
        const updatedProfile = await profileRes.json();
        setProfile(normalizeProfileData(updatedProfile));
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete profile picture
  const handleDeleteProfilePicture = async () => {
    if (!profile?.profilePicture?.url) return;

    if (!confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/users/me/profile-picture`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Delete failed');
        return;
      }

      toast.success('Profile picture deleted');

      // Refresh profile
      const profileRes = await fetch(`${API}/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (profileRes.ok) {
        const updatedProfile = await profileRes.json();
        setProfile(normalizeProfileData(updatedProfile));
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    }
  };

  const performLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Please fill all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;
      const res = await fetch(`${API}/users/change-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Password change failed");
        setChangingPassword(false);
        return;
      }

      toast.success("Password changed");
      setShowChangePassModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change password error:", err);
      toast.error("Network error");
    } finally {
      setChangingPassword(false);
    }
  };

  // Request SMS OTP
  const handleRequestSmsOtp = async () => {
    if (!profile?.contact) {
      toast.error("Please enter your contact number first");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch(`${API}/users/request-sms-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profile.contact }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to send OTP");
        return;
      }

      toast.success("OTP sent to your phone");
      setShowSmsModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify SMS OTP
  const handleVerifySmsOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!smsOtp || smsOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setVerifyingOtp(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/users/verify-sms-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          phone: profile?.contact,
          otp: smsOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Verification failed");
        return;
      }

      toast.success("Phone number verified!");
      setShowSmsModal(false);
      setSmsOtp("");

      // Refresh profile
      const profileRes = await fetch(`${API}/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (profileRes.ok) {
        const updatedProfile = await profileRes.json();
        setProfile(normalizeProfileData(updatedProfile));
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Get level color
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

  // Get level icon (Emoji)
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

  // Calculate progress to next level
  const getProgressToNextLevel = () => {
    const points = profile?.reputation?.points || 0;
    if (points >= 1000) return 100;
    if (points >= 500) return ((points - 500) / 500) * 100;
    if (points >= 200) return ((points - 200) / 300) * 100;
    if (points >= 50) return ((points - 50) / 150) * 100;
    return (points / 50) * 100;
  };

  const getNextLevelPoints = () => {
    const points = profile?.reputation?.points || 0;
    if (points >= 1000) return null;
    if (points >= 500) return 1000;
    if (points >= 200) return 500;
    if (points >= 50) return 200;
    return 50;
  };

  // Add this badge configuration
  const badgeConfig: Record<string, { icon: string; color: string; description: string; requirement: string }> = {
    'First Report': { 
      icon: '🌟', 
      color: '#fbbf24', 
      description: 'Created your first report',
      requirement: 'Submit 1 report'
    },
    'Reporter': { 
      icon: '📝', 
      color: '#60a5fa', 
      description: 'Submitted 5 reports',
      requirement: 'Submit 5 reports'
    },
    'Active Reporter': { 
      icon: '📋', 
      color: '#3b82f6', 
      description: 'Submitted 10 reports',
      requirement: 'Submit 10 reports'
    },
    'Super Reporter': { 
      icon: '⭐', 
      color: '#8b5cf6', 
      description: 'Submitted 25 reports',
      requirement: 'Submit 25 reports'
    },
    'Report Legend': { 
      icon: '🏆', 
      color: '#f59e0b', 
      description: 'Submitted 50 reports',
      requirement: 'Submit 50 reports'
    },
    'Verified Contributor': { 
      icon: '✅', 
      color: '#10b981', 
      description: 'Had 5 reports verified by admins',
      requirement: 'Get 5 reports verified'
    },
    'Trusted Source': { 
      icon: '🌟', 
      color: '#14b8a6', 
      description: 'Had 10 reports verified by admins',
      requirement: 'Get 10 reports verified'
    },
    'Problem Solver': { 
      icon: '🔧', 
      color: '#06b6d4', 
      description: 'Had 5 reports resolved',
      requirement: 'Get 5 reports resolved'
    },
    'Community Hero': { 
      icon: '🦸', 
      color: '#8b5cf6', 
      description: 'Had 10 reports resolved',
      requirement: 'Get 10 reports resolved'
    },
    'Impact Maker': { 
      icon: '💫', 
      color: '#a855f7', 
      description: 'Had 25 reports resolved',
      requirement: 'Get 25 reports resolved'
    },
    'Helpful Citizen': { 
      icon: '👍', 
      color: '#22c55e', 
      description: 'Received 10 helpful votes',
      requirement: 'Receive 10 helpful votes'
    },
    'Top Contributor': { 
      icon: '🌟', 
      color: '#eab308', 
      description: 'Received 25 helpful votes',
      requirement: 'Receive 25 helpful votes'
    },
    'Community Champion': { 
      icon: '👑', 
      color: '#ef4444', 
      description: 'Received 50 helpful votes',
      requirement: 'Receive 50 helpful votes'
    },
  };

  // ✅ Handle badge click
  const handleBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowBadgeModal(true);
  };

  if (!profile) {
    return (
      <div className={styles.loadingState}>
        <AdminLoader fullHeight message="Loading profile..." />
      </div>
    );
  }

  const profilePicUrl = profile?.profilePicture?.url || defaultProfilePic;

  return (
    <div className={styles.page}>
      <Head>
        <title>FixIt PH - User Profile</title>
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = defaultProfilePic;
                  }}
                />
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className={styles.container}>
        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 'profile' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'reputation' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('reputation')}
          >
            🏆 Reputation
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <section className={styles.card}>
            <div className={styles.headerRow}>
              <div className={styles.avatarWrap} style={{ position: 'relative' }}>
                <Image
                  src={profilePicUrl}
                  alt="avatar"
                  width={88}
                  height={88}
                  className={styles.largeAvatar}
                />

                {/* Kebab menu: trigger + menu */}
                <div className={styles.avatarMenuWrap} ref={avatarMenuRef}>
                  <button
                    type="button"
                    className={styles.avatarMenuButton}
                    aria-haspopup="true"
                    aria-expanded={showAvatarMenu}
                    onClick={() => setShowAvatarMenu((v) => !v)}
                    title="Profile actions"
                  >
                    <span className={styles.kebabDots} aria-hidden="true">⋮</span>
                  </button>
                  {showAvatarMenu && (
                    <div className={styles.avatarMenu} role="menu">
                      <button
                        className={styles.avatarMenuItem}
                        role="menuitem"
                        disabled={uploadingPicture}
                        onClick={() => {
                          setShowAvatarMenu(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <i className="fa-solid fa-camera" aria-hidden="true"></i>
                        {uploadingPicture ? 'Uploading…' : 'Upload picture'}
                      </button>
                      {profile?.profilePicture?.url && (
                        <button
                          className={`${styles.avatarMenuItem} ${styles.avatarMenuItemDanger}`}
                          role="menuitem"
                          onClick={() => {
                            setShowAvatarMenu(false);
                            handleDeleteProfilePicture();
                          }}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true"></i>
                          Delete picture
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className={styles.identity}>
                <h2 className={styles.name}>{profile.fName} {profile.lName}</h2>
                <p className={styles.email}>{profile.email}</p>
                
                {/* Quick reputation tag (text + icon) */}
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  marginTop: '8px',
                  padding: '0px 2px',
                  color: getLevelColor(profile.reputation?.level || 'Newcomer'),
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {getLevelIcon(profile.reputation?.level || 'Newcomer')}
                  </span>
                  <span>{profile.reputation?.level || 'Newcomer'}</span>
                  <span>•</span>
                  <span>{profile.reputation?.points || 0} pts</span>
                </div>
              </div>

              <div className={styles.headerActions}>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={`btn btnSecondary ${styles.primary}`}
                  >
                    Edit
                  </button>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`btn btnPrimary ${styles.primaryDark}`}
                  >
                    Save
                  </button>
                )}
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input
                  name="fName"
                  type="text"
                  value={profile.fName}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input
                  name="lName"
                  type="text"
                  value={profile.lName}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Email</label>
                <input
                  name="email"
                  type="email"
                  value={profile.email}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Barangay</label>
                <input
                  name="barangay"
                  type="text"
                  value={profile.barangay || ""}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Municipality</label>
                <input
                  name="municipality"
                  type="text"
                  value={profile.municipality || ""}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Contact Number</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    name="contact"
                    type="tel"
                    value={profile.contact || ""}
                    disabled={!isEditing}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
                    style={{ flex: 1 }}
                  />
                  {profile.contactVerified ? (
                    <span style={{ color: "#22c55e", fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap", display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestSmsOtp}
                      disabled={sendingOtp || !profile.contact}
                      className={styles.verifyBtn}
                    >
                      {sendingOtp ? "Sending..." : "Verify"}
                    </button>
                  )}
                </div>
              </div>
      </div>
            <div className={styles.actionsRow}>
              <button
                type="button"
                onClick={() => setShowChangePassModal(true)}
                className={`btn btnSecondary ${styles.linkButton}`}
              >
                Change Password
              </button>

              <div className={styles.rightActions}>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className={`btn btnDestructive ${styles.danger}`}
                >
                  Log Out
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Reputation Tab */}
        {activeTab === 'reputation' && (
          <section className={styles.card}>
            <div className={styles.reputationHeader}>
                <div className={styles.levelCard}>
                <div className={styles.levelIcon}>
                  {getLevelIcon(profile.reputation?.level || 'Newcomer')}
                </div>
                <div>
                  <h3 className={styles.levelTitle}>{profile.reputation?.level || 'Newcomer'}</h3>
                  <p className={styles.levelSubtitle}>{profile.reputation?.points || 0} Reputation Points</p>
                </div>
              </div>

              {/* Progress to next level */}
              {getNextLevelPoints() && (
                <div className={styles.progressSection}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>Progress to next level</span>
                    <span className={styles.progressValue}>
                      {profile.reputation?.points || 0} / {getNextLevelPoints()}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{ 
                        width: `${getProgressToNextLevel()}%`,
                        backgroundColor: getLevelColor(profile.reputation?.level || 'Newcomer')
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>📊</div>
                <div className={styles.statValue}>{profile.reputation?.totalReports || 0}</div>
                <div className={styles.statLabel}>Total Reports</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>✅</div>
                <div className={styles.statValue}>{profile.reputation?.verifiedReports || 0}</div>
                <div className={styles.statLabel}>Verified Reports</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>🔧</div>
                <div className={styles.statValue}>{profile.reputation?.resolvedReports || 0}</div>
                <div className={styles.statLabel}>Resolved Reports</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>💡</div>
                <div className={styles.statValue}>{profile.reputation?.helpfulVotes || 0}</div>
                <div className={styles.statLabel}>Helpful Votes</div>
              </div>
            </div>

            {/* Badges Section */}
            <div className={styles.badgesSection}>
              <h3 className={styles.sectionTitle}>🏅 Achievements</h3>
              <div className={styles.badgeGrid}>
                {profile?.reputation?.badges && profile.reputation.badges.length > 0 ? (
                  profile.reputation.badges
                    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
                    .map((badge, index) => {
                      const fallbackConfig = badgeConfig[badge.name] || { 
                        icon: '🏅', 
                        color: '#94a3b8', 
                        description: badge.name,
                        requirement: 'Unknown'
                      };

                      return (
                        <div 
                          key={badge._id || index} 
                          className={styles.badgeItem}
                          style={{ 
                            backgroundColor: `${fallbackConfig.color}15`,
                            borderLeft: `4px solid ${fallbackConfig.color}`,
                            cursor: 'pointer' // ✅ Show it's clickable
                          }}
                          onClick={() => handleBadgeClick(badge)} // ✅ Add click handler
                          title="Click to view details"
                        >
                          <span className={styles.badgeIcon}>{badge.icon || fallbackConfig.icon}</span>
                          <div className={styles.badgeInfo}>
                            <span className={styles.badgeName}>{badge.name}</span>
                            <span className={styles.badgeDate}>
                              {new Date(badge.earnedAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className={styles.noBadges}>
                    No achievements yet. Start reporting to earn badges!
                  </p>
                )}
              </div>
            </div>

            {/* How to Earn Points */}
            <div className={styles.earnPointsSection}>
              <h3 className={styles.sectionTitle}>💎 How to Earn Points</h3>
              <div className={styles.earnList}>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+10</span>
                  <span className={styles.earnDesc}>Create a report</span>
                </div>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+20</span>
                  <span className={styles.earnDesc}>First report bonus</span>
                </div>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+50</span>
                  <span className={styles.earnDesc}>Report gets verified</span>
                </div>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+100</span>
                  <span className={styles.earnDesc}>Report gets resolved</span>
                </div>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+150</span>
                  <span className={styles.earnDesc}>Urgent report resolved</span>
                </div>
                <div className={styles.earnItem}>
                  <span className={styles.earnPoints}>+5</span>
                  <span className={styles.earnDesc}>Receive helpful vote</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Confirm log out</h3>
            <p className={styles.modalText}>Are you sure you want to log out? You will be returned to the login screen.</p>

            <div className={styles.modalActions}>
              <button
                onClick={() => setShowLogoutModal(false)}
                className={styles.modalCancel}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  performLogout();
                }}
                className={styles.modalConfirm}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePassModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Change password</h3>
            <p className={styles.modalText}>Enter your current password and a new password.</p>

            <form onSubmit={handleChangePassword} style={{ marginTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.input}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.modalActions} style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassModal(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className={styles.modalCancel}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className={styles.modalConfirm}
                >
                  {changingPassword ? "Changing..." : "Change password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMS VERIFICATION MODAL */}
      {showSmsModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Verify Phone Number</h3>
            <p className={styles.modalText}>
              Enter the 6-digit code sent to {profile.contact}
            </p>

            <form onSubmit={handleVerifySmsOtp}>
              <input
                type="text"
                value={smsOtp}
                onChange={(e) =>
                  setSmsOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                maxLength={6}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "20px",
                  textAlign: "center",
                  letterSpacing: "0.5em",
                  border: "2px solid #e5e7eb",
                  borderRadius: "8px",
                  marginTop: "16px",
                  fontWeight: 500,
                }}
                autoFocus
              />

              <div className={styles.modalActions} style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsModal(false);
                    setSmsOtp("");
                  }}
                  className={`btn btnSecondary ${styles.modalCancel}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp || smsOtp.length !== 6}
                  className={`btn btnPrimary ${styles.modalConfirm}`}
                  style={{
                    opacity: smsOtp.length === 6 ? 1 : 0.5,
                    cursor: smsOtp.length === 6 ? "pointer" : "not-allowed",
                  }}
                >
                  {verifyingOtp ? "Verifying..." : "Verify"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleRequestSmsOtp}
                disabled={sendingOtp}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  padding: "8px",
                  background: "none",
                  border: "none",
                  color: "#3b82f6",
                  cursor: "pointer",
                  fontSize: "14px",
                  textDecoration: "underline",
                }}
              >
                {sendingOtp ? "Resending..." : "Resend Code"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ BADGE DETAIL MODAL */}
      {showBadgeModal && selectedBadge && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal} style={{ maxWidth: '500px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '12px' }}>
                {selectedBadge.icon || badgeConfig[selectedBadge.name]?.icon || '🏅'}
              </div>
              <h3 className={styles.modalTitle} style={{ marginBottom: '4px' }}>
                {selectedBadge.name}
              </h3>
              <p style={{ 
                color: '#6b7280', 
                fontSize: '14px',
                margin: '0'
              }}>
                Earned on {new Date(selectedBadge.earnedAt).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div style={{
              backgroundColor: '#f9fafb',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Description
              </h4>
              <p style={{ 
                color: '#1f2937', 
                fontSize: '16px',
                margin: '0',
                lineHeight: '1.6'
              }}>
                {badgeConfig[selectedBadge.name]?.description || 'Achievement earned!'}
              </p>
            </div>

            <div style={{
              backgroundColor: `${badgeConfig[selectedBadge.name]?.color || '#94a3b8'}15`,
              padding: '20px',
              borderRadius: '8px',
              borderLeft: `4px solid ${badgeConfig[selectedBadge.name]?.color || '#94a3b8'}`,
              marginBottom: '24px'
            }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Requirement
              </h4>
              <p style={{ 
                color: '#1f2937', 
                fontSize: '16px',
                margin: '0',
                fontWeight: '500'
              }}>
                {badgeConfig[selectedBadge.name]?.requirement || 'Complete specific actions'}
              </p>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setShowBadgeModal(false);
                  setSelectedBadge(null);
                }}
                className={styles.modalConfirm}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
