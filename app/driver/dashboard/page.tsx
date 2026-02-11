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
} from "firebase/firestore";
import { db, ensureAnonymousAuth } from "@/lib/firebase";

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
  const [connectedPharmacies, setConnectedPharmacies] = useState<Pharmacy[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [customerSignature, setCustomerSignature] = useState("");
  const [driverSignature, setDriverSignature] = useState("");
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

  async function loadOrders(pharmacies?: Pharmacy[]) {
    const pharmacyIds =
      pharmacies?.map((p) => p.pharmacyId) ||
      connectedPharmacies.map((p) => p.pharmacyId);

    const snap = await getDocs(collection(db, "orders"));
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    setAvailableOrders(
      all.filter(
        (o) => o.status === "PENDING" && pharmacyIds.includes(o.pharmacyId)
      )
    );

    setActiveOrders(
      all.filter(
        (o) =>
          o.driverId === driverId &&
          [
            "ASSIGNED",
            "IN_PROGRESS",
            "ON_WAY_TO_PHARMACY",
            "ON_WAY_TO_CUSTOMER",
          ].includes(o.status)
      )
    );
  }

  async function handleAddPharmacy() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "pharmacies"),
        where("pin", "==", pharmacyPin),
        where("active", "==", true)
      );
      const snap = await getDocs(q);
      const p = snap.docs[0];
      await addDoc(collection(db, "drivers", driverId!, "pharmacies"), {
        pharmacyId: p.id,
        ...p.data(),
        connectedAt: serverTimestamp(),
      });
      setPharmacyPin("");
      loadConnectedPharmacies();
    } finally {
      setLoading(false);
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
  }

  async function handleOnWayToPharmacy(id: string) {
    await updateDoc(doc(db, "orders", id), {
      status: "ON_WAY_TO_PHARMACY",
    });
    loadOrders();
  }

  async function handleCompleteDelivery() {
    if (!selectedOrder) return;

    await addDoc(collection(db, "deliverySignatures"), {
      orderId: selectedOrder.id,
      pharmacyId: selectedOrder.pharmacyId,
      pharmacyName: selectedOrder.pharmacyName,
      pumpNumbers: selectedOrder.pumpNumbers,
      customerName: selectedOrder.customerName,
      customerAddress: selectedOrder.customerAddress,
      driverId,
      driverName,
      customerSignature,
      driverSignature,
      deliveredAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "orders", selectedOrder.id), {
      status: "DELIVERED",
      deliveredAt: serverTimestamp(),
    });

    setShowDeliveryModal(false);
    setSelectedOrder(null);
    setCustomerSignature("");
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
                <p>Cliente: {o.customerName}</p>

                {o.status === "ASSIGNED" && (
                  <button
                    onClick={() => handleOnWayToPharmacy(o.id)}
                    className="w-full bg-yellow-600 py-2 rounded"
                  >
                    EN CAMINO A RECOGER A LA FARMACIA
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
                    LLEGUÉ A LA FARMACIA
                  </button>
                )}

                {o.status === "ON_WAY_TO_CUSTOMER" && (
                  <>
                    <p className="text-xs text-green-400">
                      🚚 En camino a entregar el pedido
                    </p>
                    <button
                      onClick={() => {
                        setSelectedOrder(o);
                        setShowDeliveryModal(true);
                      }}
                      className="w-full bg-green-600 py-2 rounded"
                    >
                      LLEGUÉ AL CLIENTE
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
                <p className="text-sm">Cliente: {o.customerName}</p>

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
                  ⚠️ Pedido médico – detalles completos al recoger
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
                Farmacia: {selectedOrder.pharmacyName}
              </p>
              <p>Pumps: {selectedOrder.pumpNumbers.join(", ")}</p>
              <p>Dirección: {selectedOrder.customerAddress}</p>

              <SignatureCanvas
                label="Firma Empleado Farmacia"
                onChange={setEmployeeSignature}
              />
              <SignatureCanvas
                label="Firma Conductor"
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
                    alert("Error al confirmar el retiro.");
                  }
                }}
                className="w-full bg-green-600 py-2 rounded disabled:opacity-50"
              >
                EN CAMINO A DEJAR EL PEDIDO
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

              <SignatureCanvas
                label="Firma Cliente"
                onChange={setCustomerSignature}
              />
              <SignatureCanvas
                label="Firma Conductor"
                onChange={setDriverSignature}
              />

              <button
                onClick={handleCompleteDelivery}
                disabled={!customerSignature || !driverSignature}
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
