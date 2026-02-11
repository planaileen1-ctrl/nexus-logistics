/**
 * ⚠️ PROTECTED FILE — DRIVER DASHBOARD
 *
 * This file ONLY ADDS new functionality.
 * DOES NOT REMOVE OR BREAK ANY EXISTING LOGIC.
 *
 * Last verified: 2026-02-09
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";
import { logPumpMovement } from "@/lib/pumpLogger";
import DeliverySignature from "@/components/DeliverySignature";
import { uploadSignatureToStorage } from "@/lib/uploadSignature";
import { generateSHA256Hash } from "@/lib/hashSignature";
import { generateDeliveryPDF } from "@/lib/generateDeliveryPDF";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/* ---------- Types ---------- */
type Pharmacy = {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  city: string;
  state: string;
  country: string;
};

type Order = {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  pumpNumbers: string[];
  customerName: string;
  customerCity?: string;
  customerAddress?: string;
  customerState?: string;
  customerCountry?: string;
  status: string;
  driverId?: string;
  driverName?: string;
  createdAt: any;
  assignedAt?: any;
  startedAt?: any;
};

/* ---------- Signature Canvas ---------- */
function SignatureCanvas({
  label,
  onChange,
}: {
  label: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#fff";
    }
  }, []);

  const pos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
      y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top,
    };
  };

  const start = (e: any) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: any) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, 320, 120);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-white/70">{label}</p>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="border border-white/20 rounded bg-black"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button
        type="button"
        onClick={clear}
        className="text-xs text-white/60 underline"
      >
        Clear
      </button>
    </div>
  );
}

/* ---------- Component ---------- */
export default function DriverDashboardPage() {
  const driverId =
    typeof window !== "undefined"
      ? localStorage.getItem("DRIVER_ID")
      : null;

  const driverName =
    typeof window !== "undefined"
      ? localStorage.getItem("DRIVER_NAME")
      : "UNKNOWN";

  const [pharmacyPin, setPharmacyPin] = useState("");
  const [addPharmacyError, setAddPharmacyError] = useState("");
  const [addPharmacyInfo, setAddPharmacyInfo] = useState("");
  const [connectedPharmacies, setConnectedPharmacies] = useState<Pharmacy[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [driverSignature, setDriverSignature] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState("");
  const [driverPickupSignature, setDriverPickupSignature] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();
      if (driverId) loadConnectedPharmacies();
    })();
  }, []);

  async function loadConnectedPharmacies() {
    const snap = await getDocs(
      collection(db, "drivers", driverId!, "pharmacies")
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setConnectedPharmacies(list);
    loadOrders(list);
  }

  // Subscribe to orders in real-time and log updates for debugging
  function loadOrders(pharmacies?: Pharmacy[]) {
    const pharmacyIds =
      pharmacies?.map((p) => p.pharmacyId) ||
      connectedPharmacies.map((p) => p.pharmacyId);

    // Listen to all orders and filter client-side (simpler and reliable)
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      const available = all.filter(
        (o) => o.status === "PENDING" && pharmacyIds.includes(o.pharmacyId)
      );

      const active = all.filter(
        (o) =>
          o.driverId === driverId &&
          [
            "ASSIGNED",
            "IN_PROGRESS",
            "ON_WAY_TO_PHARMACY",
            "ON_WAY_TO_CUSTOMER",
          ].includes(o.status)
      );

      setAvailableOrders(available);
      setActiveOrders(active);
    });

    return unsub;
  }

  // Ensure we re-subscribe if connected pharmacies change
  useEffect(() => {
    let unsub: any = null;
    if (connectedPharmacies.length > 0 && driverId) {
      unsub = loadOrders(connectedPharmacies);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [connectedPharmacies, driverId]);

  async function handleAddPharmacy() {
    setAddPharmacyError("");
    setAddPharmacyInfo("");
    if (!driverId) {
      setAddPharmacyError("Driver ID missing — login required.");
      return;
    }

    if (!pharmacyPin || pharmacyPin.trim().length === 0) {
      setAddPharmacyError("Enter a valid PIN.");
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "pharmacies"),
        where("pin", "==", pharmacyPin),
        where("active", "==", true)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setAddPharmacyError("Invalid PIN or pharmacy not active.");
        return;
      }

      const p = snap.docs[0];

      // Check duplicate
      const dupQ = query(
        collection(db, "drivers", driverId!, "pharmacies"),
        where("pharmacyId", "==", p.id)
      );
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) {
        setAddPharmacyInfo("Already connected to that pharmacy.");
        setPharmacyPin("");
        loadConnectedPharmacies();
        return;
      }

      await addDoc(collection(db, "drivers", driverId!, "pharmacies"), {
        pharmacyId: p.id,
        ...p.data(),
        connectedAt: serverTimestamp(),
      });

      setAddPharmacyInfo("Successfully connected to pharmacy.");
      setPharmacyPin("");
      loadConnectedPharmacies();
    } catch (err) {
      console.error("handleAddPharmacy error:", err);
      setAddPharmacyError("Error connecting to pharmacy.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setAddPharmacyInfo("");
        setAddPharmacyError("");
      }, 6000);
    }
  }

  async function handleAcceptOrder(id: string) {
    await updateDoc(doc(db, "orders", id), {
      status: "ASSIGNED",
      driverId,
      driverName,
      assignedAt: serverTimestamp(),
    });
    loadOrders();

    // Actualizar estado de bombas y registrar movimiento (PICKED_UP -> IN_TRANSIT)
    const order =
      availableOrders.find((o) => o.id === id) ||
      activeOrders.find((o) => o.id === id);

    if (order) {
      for (const pumpNumber of order.pumpNumbers) {
        const q = query(
          collection(db, "pumps"),
          where("pumpNumber", "==", pumpNumber),
          where("pharmacyId", "==", order.pharmacyId)
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
          const pumpDoc = snap.docs[0];

          await updateDoc(doc(db, "pumps", pumpDoc.id), {
            status: "IN_TRANSIT",
          });

          await logPumpMovement({
            pumpId: pumpDoc.id,
            pumpNumber,
            pharmacyId: order.pharmacyId,
            orderId: order.id,
            action: "PICKED_UP",
            performedById: driverId!,
            performedByName: driverName!,
            role: "DRIVER",
          });
        }
      }
    }
  }

  async function handleOnWayToPharmacy(id: string) {
    await updateDoc(doc(db, "orders", id), {
      status: "ON_WAY_TO_PHARMACY",
    });
    loadOrders();
  }

  async function handleCompleteDelivery() {
    if (!selectedOrder) return;

    if (!signature || !driverSignature) {
      alert("Both customer and driver signatures are required before delivery.");
      return;
    }

    // Obtener geolocalización (cliente)
    let location: { lat: number; lng: number };
    try {
      location = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => reject(new Error("Location required"))
        );
      });
    } catch (err) {
      alert("Location access is required for delivery.");
      return;
    }

    // Obtener IP cliente
    let ip = "";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      ip = data.ip;
    } catch (err) {
      console.warn("Failed to obtain client IP:", err);
    }

    const deliveredAtISO = new Date().toISOString();

    // 1️⃣ Subir imagenes a Storage (customer + driver)
    const signatureUrl = await uploadSignatureToStorage(
      `${selectedOrder.id}-customer`,
      signature
    );

    const driverSignatureUrl = await uploadSignatureToStorage(
      `${selectedOrder.id}-driver`,
      driverSignature
    );

    // 2️⃣ Generar hashes
    const signatureHash = await generateSHA256Hash(signature);
    const driverSignatureHash = await generateSHA256Hash(driverSignature);

    // 3️⃣ Generar PDF legal
    let legalPdfUrl = "";
    try {
      const pdfBlob = await generateDeliveryPDF({
        orderId: selectedOrder.id,
        customerName: selectedOrder.customerName,
        driverName: driverName || "",
        pumpNumbers: selectedOrder.pumpNumbers,
        deliveredAt: deliveredAtISO,
        ip,
        lat: location.lat,
        lng: location.lng,
        signatureUrl,
        driverSignatureUrl,
      });

      const pdfRef = storageRef(storage, `delivery_pdfs/${selectedOrder.id}.pdf`);
      await uploadBytes(pdfRef, pdfBlob);
      legalPdfUrl = await getDownloadURL(pdfRef);
    } catch (err) {
      console.error("Failed to generate or upload PDF:", err);
    }

    // 4️⃣ Guardar en collection de firmas (solo URL + hash + meta)
    await addDoc(collection(db, "deliverySignatures"), {
      orderId: selectedOrder.id,
      pharmacyId: selectedOrder.pharmacyId,
      pharmacyName: selectedOrder.pharmacyName,
      pumpNumbers: selectedOrder.pumpNumbers,
      customerName: selectedOrder.customerName,
      customerAddress: selectedOrder.customerAddress,
      driverId,
      driverName,
      signatureUrl,
      signatureHash,
      driverSignatureUrl,
      driverSignatureHash,
      deliveredAt: serverTimestamp(),
      deliveredAtISO,
      deliveredFromIP: ip,
      deliveredLatitude: location.lat,
      deliveredLongitude: location.lng,
      legalPdfUrl,
    });

    // 5️⃣ Guardar solo URL + hash + meta en la orden (NO base64)
    await updateDoc(doc(db, "orders", selectedOrder.id), {
      signatureUrl,
      signatureHash,
      driverSignatureUrl,
      driverSignatureHash,
      deliveredAt: serverTimestamp(),
      deliveredAtISO,
      deliveredFromIP: ip,
      deliveredLatitude: location.lat,
      deliveredLongitude: location.lng,
      legalPdfUrl,
      status: "DELIVERED",
    });

    // Actualizar estado de bombas y registrar movimiento (DELIVERED)
    for (const pumpNumber of selectedOrder!.pumpNumbers) {
      const q = query(
        collection(db, "pumps"),
        where("pumpNumber", "==", pumpNumber),
        where("pharmacyId", "==", selectedOrder!.pharmacyId)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const pumpDoc = snap.docs[0];

        await updateDoc(doc(db, "pumps", pumpDoc.id), {
          status: "DELIVERED",
        });

        await logPumpMovement({
          pumpId: pumpDoc.id,
          pumpNumber,
          pharmacyId: selectedOrder!.pharmacyId,
          orderId: selectedOrder!.id,
          action: "DELIVERED",
          performedById: driverId!,
          performedByName: driverName!,
          role: "DRIVER",
        });
      }
    }

    setShowDeliveryModal(false);
    setSelectedOrder(null);
    setSignature(null);
    setDriverSignature("");
    loadOrders();
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10">
      <div className="w-full max-w-xl space-y-8">
        <h1 className="text-2xl font-bold text-center">Driver Dashboard</h1>

        {/* CONNECT PHARMACY */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 space-y-4">
          <input
            value={pharmacyPin}
            onChange={(e) => setPharmacyPin(e.target.value)}
            placeholder="Enter 4-digit Pharmacy PIN"
            maxLength={4}
            className="w-full p-2 rounded bg-black border border-white/10"
          />
          <button
            onClick={handleAddPharmacy}
            disabled={loading}
            className="w-full bg-indigo-600 py-2 rounded"
          >
            CONNECT PHARMACY
          </button>
          {addPharmacyError && (
            <p className="text-red-400 text-sm">{addPharmacyError}</p>
          )}
          {addPharmacyInfo && (
            <p className="text-green-400 text-sm">{addPharmacyInfo}</p>
          )}

          {connectedPharmacies.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-white/60">Connected Pharmacies:</p>
              <ul className="text-sm space-y-1 mt-1">
                {connectedPharmacies.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.pharmacyName || p.pharmacyId}</span>
                    <span className="text-xs text-white/50">{p.city || ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ACTIVE ORDERS */}
        <div className="bg-black/40 border border-green-500/30 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-green-400">
            My Active Orders
          </h2>
          <ul className="space-y-3">
            {activeOrders.map((o) => (
              <li
                key={o.id}
                className="border border-green-500/30 rounded p-4 space-y-2"
              >
                <p className="font-semibold">{o.pharmacyName}</p>
                <p>Customer: {o.customerName}</p>

                {o.status === "ASSIGNED" && (
                  <button
                    onClick={() => handleOnWayToPharmacy(o.id)}
                    className="w-full bg-yellow-600 py-2 rounded"
                  >
                    ON THE WAY TO PHARMACY
                  </button>
                )}

                {o.status === "ON_WAY_TO_PHARMACY" && (
                  <button
                    onClick={() => {
                      setSelectedOrder(o);
                      setShowPickupModal(true);
                    }}
                    className="w-full bg-indigo-600 py-2 rounded"
                  >
                    ARRIVED AT PHARMACY
                  </button>
                )}

                {o.status === "ON_WAY_TO_CUSTOMER" && (
                  <>
                    <p className="text-xs text-green-400">
                      🚚 On the way to deliver
                    </p>
                    <button
                      onClick={() => {
                        setSelectedOrder(o);
                        setShowDeliveryModal(true);
                      }}
                      className="w-full bg-green-600 py-2 rounded"
                    >
                      ARRIVED AT CUSTOMER
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* AVAILABLE ORDERS */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Available Orders</h2>
          <ul className="space-y-3">
            {availableOrders.map((o) => (
              <li
                key={o.id}
                className="border border-white/10 rounded p-4 space-y-2"
              >
                <p className="font-semibold">{o.pharmacyName}</p>
                <p className="text-sm">Customer: {o.customerName}</p>

                {o.customerCity && (
                  <p className="text-xs text-white/60">
                    📍 {o.customerCity}, {o.customerCountry}
                  </p>
                )}

                {o.customerAddress && (
                  <p className="text-xs text-white/50">
                    🏠 {o.customerAddress}
                  </p>
                )}

                <p className="text-xs text-yellow-400">
                  ⚠️ Medical order – complete details available for pickup
                </p>

                <button
                  onClick={() => handleAcceptOrder(o.id)}
                  className="w-full bg-green-600 py-2 rounded"
                >
                  ACCEPT ORDER
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* PICKUP MODAL */}
        {showPickupModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
            <div className="bg-[#020617] p-6 rounded-xl space-y-4 w-full max-w-md">
              <p className="font-semibold">
                Pharmacy: {selectedOrder.pharmacyName}
              </p>
              <p>Pumps: {selectedOrder.pumpNumbers.join(", ")}</p>
              <p>Address: {selectedOrder.customerAddress}</p>

              <SignatureCanvas
                label="Pharmacy Staff Signature"
                onChange={setEmployeeSignature}
              />
              <SignatureCanvas
                label="Driver Signature"
                onChange={setDriverPickupSignature}
              />

              <button
                disabled={!employeeSignature || !driverPickupSignature}
                onClick={async () => {
                  // 🔑 CERRAR UI PRIMERO (CLAVE)
                  setShowPickupModal(false);
                  setEmployeeSignature("");
                  setDriverPickupSignature("");

                  try {
                    await addDoc(collection(db, "pickupSignatures"), {
                      orderId: selectedOrder.id,
                      pharmacyId: selectedOrder.pharmacyId,
                      employeeSignature,
                      driverSignature: driverPickupSignature,
                      createdAt: serverTimestamp(),
                    });

                    await updateDoc(
                      doc(db, "orders", selectedOrder.id),
                      { status: "ON_WAY_TO_CUSTOMER" }
                    );

                    loadOrders();
                  } catch (err) {
                    console.error("Pickup failed:", err);
                    alert("Error confirming pickup.");
                  }
                }}
                className="w-full bg-green-600 py-2 rounded disabled:opacity-50"
              >
                ON THE WAY TO DELIVER
              </button>
            </div>
          </div>
        )}

        {/* DELIVERY MODAL */}
        {showDeliveryModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
            <div className="bg-[#020617] p-6 rounded-xl space-y-4 w-full max-w-md">
              <p className="font-semibold">
                Cliente: {selectedOrder.customerName}
              </p>

              <DeliverySignature
                title="Customer Signature"
                onSave={(dataUrl) => {
                  setSignature(dataUrl);
                }}
              />
              {signature && (
                <div className="pt-2">
                  <p className="text-xs text-white/60">Preview:</p>
                  <img
                    src={signature}
                    alt="Signature preview"
                    className="w-full h-24 object-contain border border-white/10 rounded mt-1"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => setSignature(null)}
                      className="text-xs px-3 py-1 bg-gray-700 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <DeliverySignature
                title="Driver Signature"
                onSave={(dataUrl) => setDriverSignature(dataUrl)}
              />

              <button
                onClick={handleCompleteDelivery}
                disabled={!signature || !driverSignature}
                className="w-full bg-green-600 py-2 rounded disabled:opacity-50"
              >
                CONFIRM DELIVERY
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
