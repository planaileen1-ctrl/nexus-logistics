"use client";

import EmployeeEkitPage from "@/app/employee/e-kit/page";
import PharmacyAdminFrame from "@/components/PharmacyAdminFrame";

export default function PharmacyEkitPage() {
  return (
    <PharmacyAdminFrame title="E-KIT" subtitle="Full admin access">
      <EmployeeEkitPage />
    </PharmacyAdminFrame>
  );
}
