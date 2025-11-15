"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./RegisterPage.module.css";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fName: "",
    lName: "",
    email: "",
    password: "",
    confirmPassword: "",
    barangay: "",
    municipality: "",
    contact: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [otp, setOtp] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [registering, setRegistering] = useState(false);

  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const conditions = [
    { key: "length", text: "At least 8 characters", valid: form.password.length >= 8 },
    { key: "uppercase", text: "At least one uppercase letter", valid: /[A-Z]/.test(form.password) },
    { key: "number", text: "At least one number", valid: /\d/.test(form.password) },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === "confirmPassword") setPasswordError("");
  };

  const handleConfirmBlur = () => {
    if (form.confirmPassword && form.confirmPassword !== form.password) {
      setPasswordError("Password and Confirm Password do not match");
    } else {
      setPasswordError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password match
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Validate password conditions
    const allConditionsMet = conditions.every((c) => c.valid);
    if (!allConditionsMet) {
      toast.error("Password does not meet all requirements");
      return;
    }

    try {
      setRegistering(true);

      // ✅ Request Email OTP
      const otpRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/request-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const otpData = await otpRes.json();

      if (!otpRes.ok) {
        toast.error(otpData.message || "Failed to send OTP");
        return;
      }

      // Show OTP modal
      toast.success("OTP sent to your email. Please check your inbox.");
      setShowOtpModal(true);

    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const verifyOtpAndRegister = async () => {
    try {
      setVerifyingOtp(true);

      // ✅ Verify Email OTP
      const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        toast.error(verifyData.message || "Invalid OTP");
        if (verifyData.attemptsRemaining !== undefined) {
          toast.warn(`${verifyData.attemptsRemaining} attempts remaining`);
        }
        return;
      }

      toast.success("Email verified!");

      // ✅ Proceed with registration
      const registerRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        toast.error(registerData.message || "Registration failed");
        return;
      }

      toast.success("Registration successful! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);

    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ✅ Optional: Add resend OTP function
  const resendOtp = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/request-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to resend OTP");
        return;
      }

      toast.success("New OTP sent to your email");
      setOtp(""); // Clear previous OTP input

    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error("Failed to resend OTP");
    }
  };

  useEffect(() => {
    document.body.classList.add("register-page-bg");
    return () => {
      document.body.classList.remove("register-page-bg");
    };
  }, []);

  const redirectToGoogle = () => {
    // This will redirect to your backend which handles Google OAuth
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

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
          <h1>REGISTER</h1>
        </nav>
      </header>

      <main className={styles.register}>
        <div className={`${styles.registerContainer} ${styles.enter}`}>
          <div className={styles.registerLeft} aria-hidden="true" />

          <div className={styles.registerRight}>
            <form onSubmit={handleSubmit} autoComplete="off" className={styles.form} noValidate>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.floatingLabel}>
                    <input name="fName" type="text" placeholder=" " value={form.fName} onChange={handleChange} required className={styles.input} />
                    <span className={styles.labelText}>First Name</span>
                  </label>
                </div>
                <div className={styles.field}>
                  <label className={styles.floatingLabel}>
                    <input name="lName" type="text" placeholder=" " value={form.lName} onChange={handleChange} required className={styles.input} />
                    <span className={styles.labelText}>Last Name</span>
                  </label>
                </div>
              </div>

              <label className={styles.floatingLabel}>
                <input
                  name="email"
                  type="email"
                  placeholder=" "
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
                <span className={styles.labelText}>Email</span>
              </label>

              <div className={styles.passwordWrapper}>
                <label className={styles.floatingLabel} style={{ flex: 1 }}>
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder=" "
                    value={form.password}
                    onFocus={() => setShowConditions(true)}
                    onBlur={() => setTimeout(() => setShowConditions(false), 200)}
                    onChange={handleChange}
                    required
                    className={styles.input}
                  />
                  <span className={styles.labelText}>Password</span>
                </label>

                <button type="button" className={styles.eyeIcon} onClick={() => setShowPassword(!showPassword)} aria-label="toggle password visibility">
                  {showPassword ? "👁️" : "🙈"}
                </button>

                {showConditions && (
                  <div className={styles.passwordConditions}>
                    {conditions.map((c) => (
                      <div key={c.key} className={styles.conditionCard}>
                        <span className={c.valid ? styles.okDot : styles.badDot} />
                        {c.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.passwordWrapper}>
                <label className={styles.floatingLabel} style={{ flex: 1 }}>
                  <input
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder=" "
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleConfirmBlur}
                    required
                    className={styles.input}
                  />
                  <span className={styles.labelText}>Confirm Password</span>
                </label>
                <button type="button" className={styles.eyeIcon} onClick={() => setShowConfirm(!showConfirm)} aria-label="toggle confirm visibility">
                  {showConfirm ? "👁️" : "🙈"}
                </button>
              </div>

              {passwordError && <p className={styles.errorText}>{passwordError}</p>}

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.floatingLabel}>
                    <input name="barangay" type="text" placeholder=" " value={form.barangay} onChange={handleChange} required className={styles.input} />
                    <span className={styles.labelText}>Barangay</span>
                  </label>
                </div>
                <div className={styles.field}>
                  <label className={styles.floatingLabel}>
                    <input name="municipality" type="text" placeholder=" " value={form.municipality} onChange={handleChange} required className={styles.input} />
                    <span className={styles.labelText}>Municipality</span>
                  </label>
                </div>
              </div>

              <label className={styles.floatingLabel}>
                <input type="tel" id="contact" name="contact" placeholder=" " pattern="[0-9]{10,15}" value={form.contact} onChange={handleChange} required className={styles.input} />
                <span className={styles.labelText}>Contact number</span>
              </label>

              <div className={styles.privacyRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="privacy"
                    checked={privacyChecked}
                    onChange={(e) => setPrivacyChecked(e.target.checked)}
                    required
                    className={styles.checkbox}
                    aria-required="true"
                  />
                  <span className={styles.checkboxText}>
                    I agree to the{" "}
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => setShowPrivacyModal(true)}
                      aria-haspopup="dialog"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>
              </div>

              <button
                className={styles.registerBtn}
                type="submit"
                disabled={registering || !privacyChecked}
                aria-disabled={registering || !privacyChecked}
              >
                {registering ? "Sending OTP..." : "Register"}
              </button>
            </form>

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
                    <path d="M6.41 13.74A6.972 6.972 0 0 1 6 12c0-.62.10-1.22.29-1.75V7.65H2.98A9.998 9.998 0 0 0 1 12c0 1.63.39 3.17 1.07 4.55l4.34-2.81z" fill="#FBBC05"/>
                    <path d="M12 6.5c1.47 0 2.8.50 3.85 1.49L19.06 5c-1.66-1.18-3.9-1.84-7.06-1.84-3.96 0-7.36 2.10-9.02 5.14l4.34 2.81C7.20 8.26 9.40 6.50 12 6.50z" fill="#EA4335"/>
                  </svg>
                </span>
                <span className={styles.googleText}>Continue with Google</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {showPrivacyModal && (
        <div className={styles.policyModalOverlay}>
          <div className={styles.policyModal} role="dialog" aria-modal="true" aria-label="Privacy Policy">
            <div className={styles.policyHeader}>
              <h2>Privacy Policy</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setShowPrivacyModal(false)} aria-label="Close privacy policy">✕</button>
            </div>
            <div className={styles.policyContent}>
              <p>
                FixItPH collects and processes the personal information you provide during registration so we can create and manage your account, verify your identity, and deliver our service in your community.
              </p>
              <p>
                The specific data we collect at sign-up includes: <strong>first and last name</strong>, <strong>email address</strong>, <strong>password</strong>, <strong>barangay</strong>, <strong>municipality</strong>, and <strong>contact number</strong>. The password you enter is used only to authenticate and is stored securely using industry-standard hashing on our servers.
              </p>
              <p>
                We use your information to: create and secure your account, send one-time verification codes (OTP) to confirm email ownership, communicate important account messages, and provide location-aware features tied to your barangay and municipality.
              </p>
              <p>
                We may share personal data with third-party service providers who perform services on our behalf (such as email delivery and authentication). We require those providers to protect your data and use it only as needed to provide their services.
              </p>
              <p>
                We retain information only as long as necessary for account management, legal obligations, or to provide the service. You can request access, correction, or deletion of your personal data by contacting our support team; certain requests may be limited by legal or operational requirements.
              </p>
              <p>
                We implement reasonable administrative and technical safeguards to protect your data. However, no system is completely risk-free. If a data incident affects your account we will notify you as required by applicable law and take steps to remediate the issue.
              </p>
              <p>
                By checking the box and registering you consent to this collection and processing as described. For full details including retention periods, your rights, and contact information for privacy inquiries, please visit our website privacy center or contact support.
              </p>
            </div>
            <div className={styles.policyActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowPrivacyModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showOtpModal && (
        <div className={styles.otpModalOverlay}>
          <div className={styles.otpModal} role="dialog" aria-modal="true">
            <h2>Verify Your Email</h2>
            <p>We've sent a 6-digit code to <b>{form.email}</b></p>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              className={styles.input}
              autoFocus
            />
            <div className={styles.otpModalButtons}>
              <button onClick={verifyOtpAndRegister} disabled={verifyingOtp || otp.length !== 6} className={styles.primaryBtn}>
                {verifyingOtp ? "Verifying..." : "Verify & Register"}
              </button>
              <button onClick={() => setShowOtpModal(false)} className={styles.secondaryBtn} disabled={verifyingOtp}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
