"use client";

import { useEffect, useRef } from "react";

/**
 * Leaflet Map Component (Pure Leaflet, no external dependencies)
 * Renders drivers on an interactive map with circle markers
 */

declare global {
  interface Window {
    L: any;
  }
}

type Driver = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  status?: string;
};

const MapComponent = ({
  drivers,
  selectedDriverId,
  selectedDriverPath,
}: {
  drivers: Driver[];
  selectedDriverId?: string | null;
  selectedDriverPath?: Array<[number, number]>;
}) => {
  const ECUADOR_CENTER: [number, number] = [-1.8312, -78.1834];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const hasUserInteractedRef = useRef(false);
  const hasAutoCenteredRef = useRef(false);
  const lastFocusedDriverIdRef = useRef<string | null>(null);

  function handleRecenterMap() {
    if (!mapRef.current || !window.L) return;

    const L = window.L;
    const driversWithLocation = drivers.filter(
      (d) => d.lat !== undefined && d.lng !== undefined
    );

    if (driversWithLocation.length > 0) {
      const bounds = L.latLngBounds(driversWithLocation.map((d) => [d.lat!, d.lng!]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      hasAutoCenteredRef.current = true;
      return;
    }

    mapRef.current.setView(ECUADOR_CENTER, 6);
    hasAutoCenteredRef.current = false;
  }

  async function ensureLeaflet() {
    if (typeof window === "undefined") return null;

    const styleId = "leaflet-css";
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    if (window.L) return window.L;

    await new Promise<void>((resolve, reject) => {
      const scriptId = "leaflet-js";
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Leaflet"));
      document.body.appendChild(script);
    });

    return window.L;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const L = await ensureLeaflet();
        if (!L || cancelled || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current).setView(ECUADOR_CENTER, 6);

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
          }).addTo(mapRef.current);

          markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
          pathLayerRef.current = L.layerGroup().addTo(mapRef.current);

          mapRef.current.on("dragstart zoomstart", () => {
            hasUserInteractedRef.current = true;
          });
        }

        const colorMap: { [key: string]: string } = {
          ON_WAY_TO_CUSTOMER: "#3388ff",
          ON_WAY_TO_PHARMACY: "#ff7800",
          IN_PROGRESS: "#ffb900",
          ASSIGNED: "#00c651",
        };

        markersLayerRef.current?.clearLayers();
        pathLayerRef.current?.clearLayers();

        if (selectedDriverPath && selectedDriverPath.length > 1) {
          L.polyline(selectedDriverPath, {
            color: "#34d399",
            weight: 4,
            opacity: 0.85,
          }).addTo(pathLayerRef.current);

          const start = selectedDriverPath[0];
          const end = selectedDriverPath[selectedDriverPath.length - 1];

          L.circleMarker(start, {
            radius: 5,
            fillColor: "#22c55e",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 1,
          })
            .bindPopup("Trajectory start")
            .addTo(pathLayerRef.current);

          L.circleMarker(end, {
            radius: 6,
            fillColor: "#10b981",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 1,
          })
            .bindPopup("Current/last point")
            .addTo(pathLayerRef.current);
        }

        drivers.forEach((driver) => {
          if (driver.lat === undefined || driver.lng === undefined) return;

          const markerColor = colorMap[driver.status || ""] || "#666";
          const isSelected = selectedDriverId === driver.id;

          L.circleMarker([driver.lat, driver.lng], {
            radius: isSelected ? 10 : 8,
            fillColor: markerColor,
            color: isSelected ? "#34d399" : "#fff",
            weight: isSelected ? 3 : 2,
            opacity: 1,
            fillOpacity: 0.85,
          })
            .bindPopup(
              `<div style="text-align:center;font-size:12px">
                <strong>${driver.name}</strong>
                <br/>
                <small>${driver.status || "Active"}</small>
              </div>`
            )
            .addTo(markersLayerRef.current);
        });

        const driversWithLocation = drivers.filter(
          (d) => d.lat !== undefined && d.lng !== undefined
        );

        if (driversWithLocation.length > 0) {
          const shouldAutoCenter =
            !hasAutoCenteredRef.current || !hasUserInteractedRef.current;

          if (shouldAutoCenter) {
            const bounds = L.latLngBounds(driversWithLocation.map((d) => [d.lat!, d.lng!]));
            mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
            hasAutoCenteredRef.current = true;
          }
        } else {
          if (!hasUserInteractedRef.current) {
            mapRef.current.setView(ECUADOR_CENTER, 6);
          }
        }

        if (
          selectedDriverId &&
          selectedDriverId !== lastFocusedDriverIdRef.current
        ) {
          const selectedDriver = drivers.find(
            (d) => d.id === selectedDriverId && d.lat !== undefined && d.lng !== undefined
          );

          if (selectedDriver) {
            const currentZoom = mapRef.current.getZoom?.() || 12;
            mapRef.current.setView(
              [selectedDriver.lat!, selectedDriver.lng!],
              Math.max(currentZoom, 13)
            );
            lastFocusedDriverIdRef.current = selectedDriverId;
          }
        }

        setTimeout(() => {
          mapRef.current?.invalidateSize();
        }, 0);
      } catch (error) {
        console.error("Map initialization error:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drivers, selectedDriverId, selectedDriverPath]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
      pathLayerRef.current = null;
      hasUserInteractedRef.current = false;
      hasAutoCenteredRef.current = false;
      lastFocusedDriverIdRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleRecenterMap}
        className="absolute right-3 top-3 z-[1000] rounded-md border border-white/20 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Recenter Map
      </button>

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "24rem", // h-96
          borderRadius: "0.5rem",
          backgroundColor: "#111827",
        }}
      />
    </div>
  );
};

export default MapComponent;
