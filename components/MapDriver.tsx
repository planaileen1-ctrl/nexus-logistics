"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    // Load Leaflet CSS dynamically if not already loaded
    const styleId = "leaflet-css";
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS dynamically if not already loaded
    const scriptId = "leaflet-js";
    if (!window.L && !document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => {
        initializeMap();
      };
      document.body.appendChild(script);
    } else if (window.L) {
      initializeMap();
    }

    function initializeMap() {
      const L = window.L;
      const mapContainer = document.getElementById("map-container") as any;
      
      if (!mapContainer) return;

      // Remove existing map if present
      if (mapContainer._leaflet_map) {
        mapContainer._leaflet_map.remove();
      }

      // Create new map centered on USA
      const map = L.map("map-container").setView([39.8283, -98.5795], 4);

      // Add OpenStreetMap tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Add circle markers for each driver
      drivers.forEach((driver) => {
        if (driver.lat !== undefined && driver.lng !== undefined) {
          const colorMap: { [key: string]: string } = {
            ON_WAY_TO_CUSTOMER: "#3388ff",      // Blue
            ON_WAY_TO_PHARMACY: "#ff7800",       // Orange
            IN_PROGRESS: "#ffb900",              // Yellow
            ASSIGNED: "#00c651",                 // Green
          };
          
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
            .addTo(map);
        }
      });

      // Fit bounds if drivers have locations
      const driversWithLocation = drivers.filter(
        (d) => d.lat !== undefined && d.lng !== undefined
      );

      if (driversWithLocation.length > 0) {
        const bounds = L.latLngBounds(
          driversWithLocation.map((d) => [d.lat!, d.lng!])
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [drivers]);

  return (
    <div
      id="map-container"
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
