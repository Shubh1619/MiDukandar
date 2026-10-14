import type { Metadata } from "next";
import RecoveryClient from "@/components/recovery/RecoveryClient";

export const metadata: Metadata = {
  title: "Terminal Authorization Recovery",
};

export default function RecoveryPage() {
  return <RecoveryClient />;
}