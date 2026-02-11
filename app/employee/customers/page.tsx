/**
 * ⚠️ PROTECTED FILE — DO NOT MODIFY ⚠️
 *
 * Employee Customers
 * Create and manage pharmacy customers
 *
 * Fields:
 * - Customer Name
 * - Representative
 * - Email
 * - Country / State / City (lists)
 * - Physical Address
 * - Registered by (employee)
 * - Date & Time (USA)
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

/* 🌍 Country / State lists */
const COUNTRIES = {
  ECUADOR: [
    "AZUAY","BOLIVAR","CAÑAR","CARCHI","CHIMBORAZO","COTOPAXI","EL ORO",
    "ESMERALDAS","GALAPAGOS","GUAYAS","IMBABURA","LOJA","LOS RIOS","MANABI",
    "MORONA SANTIAGO","NAPO","ORELLANA","PASTAZA","PICHINCHA","SANTA ELENA",
    "SANTO DOMINGO","SUCUMBIOS","TUNGURAHUA","ZAMORA CHINCHIPE",
  ],
  "UNITED STATES": [
    "ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO",
    "CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS",
    "INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND",
    "MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA",
    "NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK",
    "NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON",
    "PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA",
    "TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON",
    "WEST VIRGINIA","WISCONSIN","WYOMING",
  ],
} as const;

type CountryKey = keyof typeof COUNTRIES;

/* 🔹 Date formatter */
function formatDate(ts: any) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("en-US");
}

type Customer = {
  id: string;
  customerName: string;
  representative: string;
  email: string;
  country: string;
  state: string;
  city: string;
  address: string;
  createdBy: string;
  createdAt: any;
};

export default function EmployeeCustomersPage() {
  const router = useRouter();

  const pharmacyId =
    typeof window !== "undefined"
      ? localStorage.getItem("PHARMACY_ID")
      : null;

  const employeeName =
    typeof window !== "undefined"
      ? localStorage.getItem("EMPLOYEE_NAME")
      : "UNKNOWN";

  const [form, setForm] = useState({
    customerName: "",
    representative: "",
    email: "",
    country: "" as CountryKey | "",
    state: "",
    city: "",
    address: "",
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* 🔐 Init */
  useEffect(() => {
    ensureAnonymousAuth();
    if (pharmacyId) {
      loadCustomers();
    }
  }, []);

  /* 📦 Load customers */
  async function loadCustomers() {
    if (!pharmacyId) return;

    const q = query(
      collection(db, "customers"),
      where("pharmacyId", "==", pharmacyId)
    );

    const snap = await getDocs(q);

    const list: Customer[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    setCustomers(list);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  /* ➕ Register customer */
  async function handleRegisterCustomer() {
    setError("");

    if (!form.customerName || !form.country || !form.state || !form.city) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "customers"), {
        ...form,
        pharmacyId,
        createdBy: employeeName,
        active: true,
        createdAt: serverTimestamp(), // USA
      });

      setForm({
        customerName: "",
        representative: "",
        email: "",
        country: "",
        state: "",
        city: "",
        address: "",
      });

      await loadCustomers();
    } catch (err) {
      console.error(err);
      setError("Failed to register customer");
    } finally {
      setLoading(false);
    }
  }

  /* 🗑️ Delete */
  async function handleDeleteCustomer(id: string) {
    if (!confirm("Delete this customer?")) return;
    await deleteDoc(doc(db, "customers", id));
    await loadCustomers();
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10 px-4">
      <div className="w-full max-w-3xl space-y-8">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">
            Customers
          </h1>
          <p className="text-sm text-white/60">
            Create and manage pharmacy customers
          </p>
        </div>

        {/* FORM */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">
            Register New Customer
          </h2>

          <input name="customerName" value={form.customerName} onChange={handleChange}
            placeholder="Customer Name *" className="w-full p-2 rounded bg-black border border-white/10" />

          <input name="representative" value={form.representative} onChange={handleChange}
            placeholder="Representative" className="w-full p-2 rounded bg-black border border-white/10" />

          <input name="email" value={form.email} onChange={handleChange}
            placeholder="Email" type="email"
            className="w-full p-2 rounded bg-black border border-white/10" />

          <select name="country" value={form.country} onChange={handleChange}
            className="w-full p-2 rounded bg-black border border-white/10">
            <option value="">Select Country *</option>
            {Object.keys(COUNTRIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {form.country && (
            <select name="state" value={form.state} onChange={handleChange}
              className="w-full p-2 rounded bg-black border border-white/10">
              <option value="">Select State *</option>
              {COUNTRIES[form.country].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <input name="city" value={form.city} onChange={handleChange}
            placeholder="City *" className="w-full p-2 rounded bg-black border border-white/10" />

          <input name="address" value={form.address} onChange={handleChange}
            placeholder="Physical Address"
            className="w-full p-2 rounded bg-black border border-white/10" />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleRegisterCustomer} disabled={loading}
            className="w-full bg-green-600 py-2 rounded font-semibold disabled:opacity-50">
            {loading ? "REGISTERING..." : "REGISTER CUSTOMER"}
          </button>
        </div>

        {/* LIST */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Registered Customers</h2>

          {customers.length === 0 && (
            <p className="text-white/50 text-sm">
              No customers registered yet.
            </p>
          )}

          <ul className="space-y-3">
            {customers.map((c) => (
              <li key={c.id}
                className="border border-white/10 rounded p-4 flex justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{c.customerName}</p>
                  <p className="text-xs text-white/60">
                    {c.city}, {c.state}, {c.country}
                  </p>
                  <p className="text-xs text-white/40">
                    Registered by {c.createdBy} — {formatDate(c.createdAt)}
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteCustomer(c.id)}
                  className="text-xs text-red-400 hover:text-red-500">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* BACK */}
        <div className="text-center">
          <button
            onClick={() => router.push("/employee/dashboard")}
            className="text-xs text-white/50 hover:text-white">
            ← Back to Employee Dashboard
          </button>
        </div>

      </div>
    </main>
  );
}
