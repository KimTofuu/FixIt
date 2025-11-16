"use client";

import Image from "next/image";
import styles from "./AdminLoader.module.css";

type AdminLoaderProps = {
  message?: string;
  fullHeight?: boolean;
  compact?: boolean;
  className?: string;
};

const AdminLoader = ({ message, fullHeight = false, compact = false, className }: AdminLoaderProps) => {
  const containerClass = [styles.loaderRoot, fullHeight ? styles.fullHeight : "", className ?? ""].filter(Boolean).join(" ");
  const spinnerClass = [styles.spinner, compact ? styles.spinnerCompact : ""].filter(Boolean).join(" ");
  const logoClass = [styles.logo, compact ? styles.logoCompact : ""].filter(Boolean).join(" ");

  return (
    <div className={containerClass} role="status" aria-live="polite">
      <div className={spinnerClass}>
        <Image
          src="/images/Fix-it_logo_3.png"
          alt="FixIt logo"
          width={compact ? 44 : 64}
          height={compact ? 44 : 64}
          className={logoClass}
          priority
        />
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
};

export default AdminLoader;
