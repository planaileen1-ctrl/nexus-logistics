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

const MapComponent = ({ drivers }: { drivers: Driver[] }) => {
  const ECUADOR_CENTER: [number, number] = [-1.8312, -78.1834];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

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
        }

        const colorMap: { [key: string]: string } = {
          ON_WAY_TO_CUSTOMER: "#3388ff",
          ON_WAY_TO_PHARMACY: "#ff7800",
          IN_PROGRESS: "#ffb900",
          ASSIGNED: "#00c651",
        };

        markersLayerRef.current?.clearLayers();

        drivers.forEach((driver) => {
          if (driver.lat === undefined || driver.lng === undefined) return;

          const markerColor = colorMap[driver.status || ""] || "#666";

          L.circleMarker([driver.lat, driver.lng], {
            radius: 8,
            fillColor: markerColor,
            color: "#fff",
            weight: 2,
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
          const bounds = L.latLngBounds(driversWithLocation.map((d) => [d.lat!, d.lng!]));
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        } else {
          mapRef.current.setView(ECUADOR_CENTER, 6);
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
  }, [drivers]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "24rem", // h-96
        borderRadius: "0.5rem",
        backgroundColor: "#111827",
      }}
    />
  );
};

export default MapComponent;
