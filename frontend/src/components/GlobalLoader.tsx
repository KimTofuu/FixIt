"use client";

import AdminLoader from "@/components/AdminLoader";
import { useLoader } from "@/context/LoaderContext";
import styles from "./GlobalLoader.module.css";

const GlobalLoader = () => {
  const { isLoading } = useLoader();

  if (!isLoading) {
    return null;
  }

  return (
    <div className={styles.backdrop}>
      <AdminLoader message="Loading..." />
    </div>
  );
};

export default GlobalLoader;