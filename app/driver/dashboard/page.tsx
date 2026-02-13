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
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  getDoc,
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
import { sendAppEmail } from "@/lib/emailClient";
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
  customerId?: string;
  pumpNumbers: string[];
  customerName: string;
  customerCity?: string;
  customerAddress?: string;
  customerState?: string;
  customerCountry?: string;
  customerPreviousPumps?: string[];
  returnReminderNote?: string;
  previousPumpsStatus?: { pumpNumber: string; returned: boolean; reason?: string }[];
  previousPumpsReturnToPharmacy?: {
    pumpNumber: string;
    returnedToPharmacy: boolean;
  }[];
  status: string;
  driverId?: string;
  driverName?: string;
  createdAt: any;
  statusUpdatedAt?: any;
  assignedAt?: any;
  startedAt?: any;
  arrivedAt?: any;
  arrivedAtISO?: string;
  deliveredAt?: any;
  deliveredAtISO?: string;
  legalPdfUrl?: string;
  driverLatitude?: number;
  driverLongitude?: number;
};

async function getDriverCurrentLocation(
  options?: { timeoutMs?: number; maximumAge?: number }
): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  const timeoutMs = options?.timeoutMs ?? 8000;
  const maximumAge = options?.maximumAge ?? 0;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge,
      });
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

async function getClientIpWithTimeout(timeoutMs = 1200): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return "";
    const data = await res.json();
    return (data?.ip as string) || "";
  } catch {
    return "";
  }
}

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
  const router = useRouter();

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
  const [returnTasks, setReturnTasks] = useState<
    { orderId: string; customerName: string; pumps: string[] }[]
  >([]);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [driverSignature, setDriverSignature] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState("");
  const [driverPickupSignature, setDriverPickupSignature] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [previousPumpsStatus, setPreviousPumpsStatus] = useState<
    Record<string, { returned: boolean; reason: string }>
  >({});

  const [loading, setLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [acceptInfo, setAcceptInfo] = useState("");

  useEffect(() => {
    (async () => {
      await ensureAnonymousAuth();
      if (driverId) loadConnectedPharmacies();
    })();
  }, []);

  useEffect(() => {
    if (!showDeliveryModal || !selectedOrder) return;

    const previous = selectedOrder.customerPreviousPumps || [];
    const initial: Record<string, { returned: boolean; reason: string }> = {};

    previous.forEach((num) => {
      initial[String(num)] = { returned: true, reason: "" };
    });

    setPreviousPumpsStatus(initial);
  }, [showDeliveryModal, selectedOrder]);

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

      const tasks = all
        .filter((o) => o.driverId === driverId)
        .map((o) => {
          const pending = (o.previousPumpsReturnToPharmacy || [])
            .filter((entry) => !entry.returnedToPharmacy)
            .map((entry) => String(entry.pumpNumber));

          return {
            orderId: o.id,
            customerName: o.customerName,
            pumps: pending,
          };
        })
        .filter((entry) => entry.pumps.length > 0);

      setAvailableOrders(available);
      setActiveOrders(active);
      setReturnTasks(tasks);
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
    const liveLocation = await getDriverCurrentLocation();

    await updateDoc(doc(db, "orders", id), {
      status: "ASSIGNED",
      driverId,
      driverName,
      assignedAt: serverTimestamp(),
      statusUpdatedAt: serverTimestamp(),
      ...(liveLocation
        ? {
            driverLatitude: liveLocation.lat,
            driverLongitude: liveLocation.lng,
          }
        : {}),
    });
    loadOrders();

    // Actualizar estado de bombas y registrar movimiento (PICKED_UP -> IN_TRANSIT)
    const order =
      availableOrders.find((o) => o.id === id) ||
      activeOrders.find((o) => o.id === id);

    if (order) {
      if (order.returnReminderNote) {
        setAcceptInfo(order.returnReminderNote);
        setTimeout(() => setAcceptInfo(""), 7000);
      } else if (order.customerPreviousPumps && order.customerPreviousPumps.length > 0) {
        setAcceptInfo(
          `Reminder: this customer already has pumps ${order.customerPreviousPumps.join(", ")}. Please request them.`
        );
        setTimeout(() => setAcceptInfo(""), 7000);
      }

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
    const liveLocation = await getDriverCurrentLocation();

    await updateDoc(doc(db, "orders", id), {
      status: "ON_WAY_TO_PHARMACY",
      statusUpdatedAt: serverTimestamp(),
      ...(liveLocation
        ? {
            driverLatitude: liveLocation.lat,
            driverLongitude: liveLocation.lng,
          }
        : {}),
    });
    loadOrders();
  }

  async function handleArrivedAtCustomer(order: Order) {
    setSelectedOrder(order);
    setShowDeliveryModal(true);

    const liveLocation = await getDriverCurrentLocation();
    const arrivedAtISO = new Date().toISOString();

    try {
      await updateDoc(doc(db, "orders", order.id), {
        arrivedAt: serverTimestamp(),
        arrivedAtISO,
        statusUpdatedAt: serverTimestamp(),
        ...(liveLocation
          ? {
              driverLatitude: liveLocation.lat,
              driverLongitude: liveLocation.lng,
            }
          : {}),
      });

      setDeliveryInfo(
        `Arrival registered: ${new Date(arrivedAtISO).toLocaleString("en-US")}`
      );
      setTimeout(() => setDeliveryInfo(""), 6000);
    } catch (err) {
      console.warn("Failed to register arrival at customer:", err);
    }
  }

  async function handleCompleteDelivery() {
    if (!selectedOrder) return;

    const order = selectedOrder;

    setDeliveryError("");
    setDeliveryInfo("");

    if (!receiverName.trim()) {
      setDeliveryError("Employee name is required.");
      return;
    }

    if (!signature || !driverSignature) {
      setDeliveryError("Both customer and driver signatures are required.");
      return;
    }

    const previousPumpsList = selectedOrder.customerPreviousPumps || [];
    const previousPumpsStatusList = previousPumpsList.map((num) => {
      const key = String(num);
      const status = previousPumpsStatus[key];

      return {
        pumpNumber: key,
        returned: status?.returned ?? true,
        reason: (status?.reason || "").trim(),
      };
    });

    const notReturnedList = previousPumpsStatusList.filter(
      (entry) => !entry.returned
    );

    const previousPumpsReturnToPharmacy = previousPumpsStatusList
      .filter((entry) => entry.returned)
      .map((entry) => ({
        pumpNumber: entry.pumpNumber,
        returnedToPharmacy: false,
      }));

    if (previousPumpsStatusList.length > 0) {
      const missingReason = previousPumpsStatusList.find(
        (entry) => !entry.returned && !entry.reason
      );

      if (missingReason) {
        setDeliveryError("Please provide a reason for each pump not returned.");
        return;
      }
    }

    setDeliveryLoading(true);
    setShowDeliveryModal(false);
    setDeliveryInfo("Saving delivery...");
    let completed = false;

    try {
      const locationPromise = getDriverCurrentLocation({
        timeoutMs: 1500,
        maximumAge: 30000,
      });
      const ipPromise = getClientIpWithTimeout(1200);

      const deliveredAtISO = new Date().toISOString();

      const [signatureUrl, driverSignatureUrl, signatureHash, driverSignatureHash] =
        await Promise.all([
          uploadSignatureToStorage(`${order.id}-customer`, signature),
          uploadSignatureToStorage(`${order.id}-driver`, driverSignature),
          generateSHA256Hash(signature),
          generateSHA256Hash(driverSignature),
        ]);

      const [location, ip] = await Promise.all([locationPromise, ipPromise]);

      const allReturned =
        previousPumpsStatusList.length > 0 &&
        previousPumpsStatusList.every((entry) => entry.returned);
      const previousPumpsReturned = previousPumpsStatusList.length === 0
        ? null
        : allReturned;

      const deliveryLocationData = location
        ? {
            deliveredLatitude: location.lat,
            deliveredLongitude: location.lng,
          }
        : {};

      const baseDeliveryData = {
        orderId: order.id,
        pharmacyId: order.pharmacyId,
        pharmacyName: order.pharmacyName,
        pumpNumbers: order.pumpNumbers,
        customerName: order.customerName,
        customerAddress: order.customerAddress,
        receivedByName: receiverName.trim(),
        previousPumps: previousPumpsList,
        previousPumpsReturned,
        previousPumpsStatus: previousPumpsStatusList,
        previousPumpsReturnToPharmacy,
        driverId,
        driverName,
        signatureUrl,
        signatureHash,
        driverSignatureUrl,
        driverSignatureHash,
        deliveredAtISO,
        deliveredFromIP: ip,
        ...deliveryLocationData,
      };

      const [deliverySignatureRef] = await Promise.all([
        addDoc(collection(db, "deliverySignatures"), {
          ...baseDeliveryData,
          deliveredAt: serverTimestamp(),
          legalPdfUrl: "",
        }),
        updateDoc(doc(db, "orders", order.id), {
          ...baseDeliveryData,
          deliveredAt: serverTimestamp(),
          legalPdfUrl: "",
          status: "DELIVERED",
          statusUpdatedAt: serverTimestamp(),
        }),
      ]);

      completed = true;
      loadOrders();

      void (async () => {
        let legalPdfUrl = "";

        try {
          const pdfBlob = await generateDeliveryPDF({
            orderId: order.id,
            customerName: order.customerName,
            driverName: driverName || "",
            pumpNumbers: order.pumpNumbers,
            deliveredAt: deliveredAtISO,
            ip,
            lat: location?.lat ?? 0,
            lng: location?.lng ?? 0,
            signatureUrl,
            driverSignatureUrl,
          });

          const pdfRef = storageRef(storage, `delivery_pdfs/${order.id}.pdf`);
          await uploadBytes(pdfRef, pdfBlob);
          legalPdfUrl = await getDownloadURL(pdfRef);

          await Promise.all([
            updateDoc(doc(db, "orders", order.id), { legalPdfUrl }),
            updateDoc(doc(db, "deliverySignatures", deliverySignatureRef.id), {
              legalPdfUrl,
            }),
          ]);
        } catch (err) {
          console.error("Failed to generate or upload PDF:", err);
        }

        if (notReturnedList.length > 0 && order.customerId) {
          try {
            const customerSnap = await getDoc(doc(db, "customers", order.customerId));
            const customerEmail = customerSnap.data()?.email as string | undefined;

            if (customerEmail) {
              const sentAt = new Date().toLocaleString("en-US");
              const reasonsHtml = notReturnedList
                .map(
                  (entry) =>
                    `<li>Pump #${entry.pumpNumber}: ${entry.reason || "No reason provided"}</li>`
                )
                .join("");

              await sendAppEmail({
                to: customerEmail,
                subject: "Pumps Not Returned",
                html: `
                  <p>Hello ${order.customerName},</p>
                  <p>We did not receive the following pumps during the last delivery:</p>
                  <ul>${reasonsHtml}</ul>
                  <p><strong>Recorded:</strong> ${sentAt}</p>
                  <p>Please return these pumps on the next delivery.</p>
                `,
                text: `Pumps not returned: ${notReturnedList
                  .map((entry) => `${entry.pumpNumber} (${entry.reason || "No reason"})`)
                  .join(", ")}. Recorded: ${sentAt}. Please return these pumps on the next delivery.`,
              });
            }
          } catch (err) {
            console.warn("Customer email send failed:", err);
          }
        }

        await Promise.all(
          order.pumpNumbers.map(async (pumpNumber) => {
            const q = query(
              collection(db, "pumps"),
              where("pumpNumber", "==", pumpNumber),
              where("pharmacyId", "==", order.pharmacyId)
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
                pharmacyId: order.pharmacyId,
                orderId: order.id,
                action: "DELIVERED",
                performedById: driverId!,
                performedByName: driverName!,
                role: "DRIVER",
              });
            }
          })
        );
      })();
    } catch (err) {
      console.error("handleCompleteDelivery error:", err);
      setShowDeliveryModal(true);
      setDeliveryInfo("");
      setDeliveryError("Failed to confirm delivery. Please try again.");
    } finally {
      setDeliveryLoading(false);
    }

    if (completed) {
      setShowDeliveryModal(false);
      setSelectedOrder(null);
      setSignature(null);
      setDriverSignature("");
      setReceiverName("");
      setPreviousPumpsStatus({});
      setDeliveryInfo(
        `Delivery registered successfully at ${new Date().toLocaleString("en-US")}.`
      );
      setTimeout(() => setDeliveryInfo(""), 6000);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white flex justify-center py-10">
      <div className="w-full max-w-xl space-y-8">
        <h1 className="text-2xl font-bold text-center">Driver Dashboard</h1>

        {deliveryInfo && (
          <p className="text-green-400 text-sm text-center">
            {deliveryInfo}
          </p>
        )}

        {acceptInfo && (
          <p className="text-yellow-300 text-sm text-center">
            {acceptInfo}
          </p>
        )}

        {/* NEW ORDERS */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-4">New Orders</h2>
          {availableOrders.length === 0 && (
            <p className="text-xs text-white/60">No new orders available.</p>
          )}
          {availableOrders.length > 0 && (
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
          )}
        </div>

        {/* RETURN TASKS */}
        <div className="bg-black/40 border border-amber-500/30 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-amber-400">Return Tasks</h2>
          {returnTasks.length === 0 && (
            <p className="text-xs text-white/60">No pending returns.</p>
          )}
          {returnTasks.length > 0 && (
            <ul className="space-y-3">
              {returnTasks.map((task) => (
                <li
                  key={`${task.orderId}-${task.customerName}`}
                  className="border border-amber-500/30 rounded p-4 space-y-1"
                >
                  <p className="text-sm font-semibold">{task.customerName}</p>
                  <p className="text-xs text-white/60">
                    Pumps to return: {task.pumps.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

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

        {/* DELIVERY PDF BACKUPS */}
        <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-cyan-300">Delivery PDF Backups</h2>
          <p className="text-xs text-white/60">
            Open legal delivery PDFs and share by email from a dedicated page.
          </p>
          <button
            type="button"
            onClick={() => router.push("/driver/delivery-pdfs")}
            className="w-full bg-cyan-600 py-2 rounded"
          >
            OPEN PDF BACKUPS
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
                    {o.arrivedAtISO && (
                      <p className="text-xs text-white/60">
                        Arrival: {new Date(o.arrivedAtISO).toLocaleString("en-US")}
                      </p>
                    )}
                    <button
                      onClick={() => handleArrivedAtCustomer(o)}
                      className="w-full bg-green-600 py-2 rounded"
                    >
                      ARRIVED AT CUSTOMER
                    </button>
                  </>
                )}

                {o.customerPreviousPumps && o.customerPreviousPumps.length > 0 && (
                  <p className="text-xs text-yellow-300">
                    Reminder: customer already has pumps {o.customerPreviousPumps.join(", ")}. Please request them.
                  </p>
                )}

                {o.returnReminderNote && (
                  <p className="text-xs text-yellow-300">
                    Reminder: {o.returnReminderNote}
                  </p>
                )}
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
                  // 🔑 CLOSE UI FIRST (CRITICAL)
                  setShowPickupModal(false);
                  setEmployeeSignature("");
                  setDriverPickupSignature("");

                  try {
                    const liveLocation = await getDriverCurrentLocation();

                    await addDoc(collection(db, "pickupSignatures"), {
                      orderId: selectedOrder.id,
                      pharmacyId: selectedOrder.pharmacyId,
                      employeeSignature,
                      driverSignature: driverPickupSignature,
                      createdAt: serverTimestamp(),
                    });

                    await updateDoc(
                      doc(db, "orders", selectedOrder.id),
                      {
                        status: "ON_WAY_TO_CUSTOMER",
                        statusUpdatedAt: serverTimestamp(),
                        ...(liveLocation
                          ? {
                              driverLatitude: liveLocation.lat,
                              driverLongitude: liveLocation.lng,
                            }
                          : {}),
                      }
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-4">
            <div className="bg-[#020617] p-6 rounded-xl space-y-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <p className="font-semibold">
                Customer: {selectedOrder.customerName}
              </p>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Receiver Name</label>
                <input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Name of the person receiving"
                  className="w-full p-2 rounded bg-black border border-white/10"
                />
              </div>

              <DeliverySignature
                title="Customer Signature"
                mode="auto"
                onSave={(dataUrl) => {
                  setSignature(dataUrl);
                }}
              />
              <DeliverySignature
                title="Driver Signature"
                mode="auto"
                onSave={(dataUrl) => setDriverSignature(dataUrl)}
              />

              {selectedOrder.customerPreviousPumps &&
                selectedOrder.customerPreviousPumps.length > 0 && (
                  <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold">Previous Pumps To Return</p>
                    <div className="space-y-3">
                      {selectedOrder.customerPreviousPumps.map((num) => {
                        const key = String(num);
                        const status = previousPumpsStatus[key] || {
                          returned: true,
                          reason: "",
                        };

                        return (
                          <div
                            key={key}
                            className="border border-white/10 rounded p-3 space-y-2"
                          >
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={status.returned}
                                onChange={(e) =>
                                  setPreviousPumpsStatus((prev) => ({
                                    ...prev,
                                    [key]: {
                                      returned: e.target.checked,
                                      reason: e.target.checked
                                        ? ""
                                        : prev[key]?.reason || "",
                                    },
                                  }))
                                }
                              />
                              Customer returned pump #{key}
                              {!status.returned && (
                                <span className="ml-2 rounded bg-red-500/20 text-red-300 px-2 py-0.5 text-[10px]">
                                  Not returned
                                </span>
                              )}
                            </label>

                            {!status.returned && (
                              <textarea
                                value={status.reason}
                                onChange={(e) =>
                                  setPreviousPumpsStatus((prev) => ({
                                    ...prev,
                                    [key]: {
                                      returned: false,
                                      reason: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Reason for not returning this pump"
                                className="w-full p-2 rounded bg-black border border-white/10 text-xs"
                                rows={3}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {deliveryError && (
                <p className="text-red-400 text-sm">{deliveryError}</p>
              )}

              <button
                onClick={handleCompleteDelivery}
                disabled={deliveryLoading || !signature || !driverSignature}
                className="w-full bg-green-600 py-2 rounded disabled:opacity-50"
              >
                {deliveryLoading ? "SAVING..." : "CONFIRM DELIVERY"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
