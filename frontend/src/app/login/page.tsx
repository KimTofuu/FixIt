"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./LoginPage.module.css";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

async function loginUser(formData: {
  email: string;
  password: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  
  const data = await res.json();
  return { status: res.status, data };
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const router = useRouter();
  const [isResident, setIsResident] = useState(true);
  const [showResidentPassword, setShowResidentPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });

      const data = await res.json();

      console.log("📡 Admin login response:", data);

      if (res.ok) {
        toast.success(data.message);
        
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "admin");
        localStorage.setItem("userId", data.admin.id);
        localStorage.setItem("adminEmail", data.admin.email);
        localStorage.setItem("barangayName", data.admin.barangayName);
        
        console.log("✅ Saved to localStorage:");
        console.log("  Token:", localStorage.getItem("token") ? "saved" : "missing");
        console.log("  Role:", localStorage.getItem("role"));
        console.log("  UserId:", localStorage.getItem("userId"));
        
        router.push("/admin-dashboard");
      } else {
        toast.error(data.message || "Admin login failed");
      }
    } catch (error) {
      toast.error("An error occurred during admin login.");
      console.error("Admin login error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { status, data: result } = await loginUser(form);
      
      console.log("📡 User login response:", result);
      
      // ✅ Check if user is suspended
      if (status === 403 && result.suspended) {
        const suspendedAt = result.suspendedAt 
          ? new Date(result.suspendedAt).toLocaleDateString() 
          : 'recently';
        
        toast.error(
          `🚫 Account Suspended: ${result.suspensionReason || 'Your account has been suspended'}`,
          {
            autoClose: 6000,
            style: {
              background: '#dc3545',
              color: 'white',
              fontWeight: 'bold'
            }
          }
        );
        
        // Show additional info toast
        setTimeout(() => {
          toast.info(
            `Suspended on: ${suspendedAt}. Contact support for more information.`,
            {
              autoClose: 5000
            }
          );
        }, 500);
        
        return;
      }
      
      if (result.token) {
        localStorage.setItem("token", result.token);
        localStorage.setItem("role", result.role || "user");
        localStorage.setItem("userId", result.userId);
        
        console.log("✅ Saved to localStorage:");
        console.log("  Token:", localStorage.getItem("token") ? "saved" : "missing");
        console.log("  Role:", localStorage.getItem("role"));
        console.log("  UserId:", localStorage.getItem("userId"));
        
        toast.success("Login successful! Redirecting...");
        setTimeout(() => router.push("/user-feed"), 1000);
      } else {
        toast.error(result.message || "Login failed");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
      console.error("Login error:", error);
    }
  };

  const toggleForm = () => setIsResident(!isResident);

  const redirectToGoogle = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  useEffect(() => {
    document.body.classList.add("login-page-bg");
    
    const el = document.querySelector(`.${styles.container}`);
    if (el) el.classList.add(styles.enter);
    return () => {
      document.body.classList.remove("login-page-bg");
      if (el) el.classList.remove(styles.enter);
    };
  }, []);

  useEffect(() => {
    const error = searchParams.get('error');
    const details = searchParams.get('details');
    const reason = searchParams.get('reason');
    const date = searchParams.get('date');
    
    console.log('=== Login Page URL Params ===');
    console.log('Error:', error);
    console.log('Details:', details);
    console.log('Reason:', reason);
    console.log('Date:', date);
    
    if (error) {
      // ✅ Handle suspended user from Google login
      if (error === 'suspended') {
        const suspensionReason = reason ? decodeURIComponent(reason) : 'Your account has been suspended';
        const suspensionDate = date ? decodeURIComponent(date) : 'recently';
        
        console.log('🚫 Showing suspension notification');
        console.log('Reason:', suspensionReason);
        console.log('Date:', suspensionDate);
        
        toast.error(
          `🚫 Account Suspended: ${suspensionReason}`,
          {
            autoClose: 8000,
            style: {
              color: 'black',
              fontWeight: 'bold',
              fontSize: '16px'
            }
          }
        );
        
        setTimeout(() => {
          toast.warning(
            `Your account was suspended on ${suspensionDate}. Please contact support for assistance.`,
            {
              autoClose: 6000,
              style: {
                fontSize: '15px'
              }
            }
          );
        }, 800);
        
        window.history.replaceState({}, '', '/login');
        return;
      }
      
      const errorMessages: Record<string, string> = {
        'auth_failed': 'Google authentication failed. Please try again.',
        'no_code': 'Authorization code not received from Google.',
        'no_email': 'Email not provided by Google account.',
        'no_user': 'User account not found.',
        'token_failed': 'Failed to generate authentication token.',
      };
      
      const message = errorMessages[error] || 'An error occurred during login.';
      console.log('Showing error toast:', message);
      toast.error(details ? `${message} (${details})` : message);
      
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <Link href="/" aria-label="Back to home">
            <Image
              src="/images/Fix-it_logo_3.png"
              alt="Fixit Logo"
              className={styles.logo}
              width={160}
              height={40}
            />
          </Link>
          <h1> LOGIN </h1>
        </nav>
      </header>
      <div className={styles.login}>
        <div className={`${styles.loginContainer} ${styles.container}`}>
        <div className={styles.loginLeft}>
        </div>
        <div className={styles.loginRight}>
          <h1 id="form-title" className={styles.formTitle}>
            {isResident ? "Resident Login" : "Admin Login"}
          </h1>

          <div
            className={styles.toggle}
            onClick={toggleForm}
            role="button"
            tabIndex={0}
            aria-pressed={!isResident}
          >
            {isResident ? "Switch to Admin Login" : "Switch to Resident Login"}
          </div>

          <form
            autoComplete="off"
            id="resident-form"
            className={`${styles.form} ${isResident ? styles.active : ""}`}
            onSubmit={handleSubmit}
          >
            <label className={styles.floatingLabel}>
              <input
                type="email"
                name="email"
                placeholder=" "
                value={form.email}
                onChange={handleChange}
                required
                className={styles.input}
              />
              <span className={styles.labelText}>Resident Email</span>
            </label>

            <div className={styles.passwordWrapper}>
              <label className={styles.floatingLabel} style={{ flex: 1 }}>
                <input
                  type={showResidentPassword ? "text" : "password"}
                  name="password"
                  placeholder=" "
                  value={form.password}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
                <span className={styles.labelText}>Password</span>
              </label>

              <button
                type="button"
                className={styles.eyeIcon}
                onClick={() => setShowResidentPassword(!showResidentPassword)}
                aria-label="toggle resident password visibility"
              >
                {showResidentPassword ? "👁️" : "🙈"}
              </button>
            </div>

            <div className={styles.forgotRow}>
              <Link href="/user-forgotpassword" className={styles.forgotBtn} aria-label="Forgot resident password">
                Forgot password?
              </Link>
            </div>

            <button className={styles.loginBtn} type="submit">
              Log in
            </button>

            <div className={styles.socialRow}>
              <button
                type="button"
                className={styles.googleBtn}
                onClick={redirectToGoogle}
                aria-label="Continue with Google"
              >
                <span className={styles.googleIcon} aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
                    <path d="M21.6 12.23c0-.68-.06-1.34-.18-1.97H12v3.73h5.48c-.24 1.33-.94 2.46-2 3.22v2.66h3.23c1.88-1.73 2.97-4.28 2.97-7.64z" fill="#4285F4"/>
                    <path d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.23-2.66c-.9.6-2.06.96-3.39.96-2.6 0-4.8-1.76-5.59-4.14H2.98v2.6C4.64 19.9 8.04 22 12 22z" fill="#34A853"/>
                    <path d="M6.41 13.74A6.972 6.972 0 0 1 6 12c0-.62.1-1.22.29-1.75V7.65H2.98A9.998 9.998 0 0 0 1 12c0 1.63.39 3.17 1.07 4.55l4.34-2.81z" fill="#FBBC05"/>
                    <path d="M12 6.5c1.47 0 2.8.5 3.85 1.49L19.06 5c-1.66-1.18-3.9-1.84-7.06-1.84-3.96 0-7.36 2.1-9.02 5.14l4.34 2.81C7.2 8.26 9.4 6.5 12 6.5z" fill="#EA4335"/>
                  </svg>
                </span>
                <span className={styles.googleText}>Continue with Google</span>
              </button>
            </div>
          </form>

          <form
            autoComplete="off"
            id="admin-form"
            className={`${styles.form} ${!isResident ? styles.active : ""}`}
            onSubmit={handleAdminSubmit}
          >
            <label className={styles.floatingLabel}>
              <input
                type="email"
                name="email"
                placeholder=" "
                required
                className={styles.input}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              <span className={styles.labelText}>Admin Email</span>
            </label>

            <div className={styles.passwordWrapper}>
              <label className={styles.floatingLabel} style={{ flex: 1 }}>
                <input
                  type={showAdminPassword ? "text" : "password"}
                  name="password"
                  placeholder=" "
                  required
                  className={styles.input}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <span className={styles.labelText}>Password</span>
              </label>

              <button
                type="button"
                className={styles.eyeIcon}
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                aria-label="toggle admin password visibility"
              >
                {showAdminPassword ? "👁️" : "🙈"}
              </button>
            </div>

            <div className={styles.forgotRow}>
              <Link href="/admin-forgotpassword" className={styles.forgotBtn} aria-label="Forgot admin password">
                Forgot password?
              </Link>
            </div>

            <button className={styles.loginBtn} type="submit">
              Log in
            </button>
          </form>
        </div>
        </div>
      </div>
    </>
  );
}
