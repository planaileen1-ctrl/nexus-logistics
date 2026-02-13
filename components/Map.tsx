"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Driver = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  status?: string;
};

const greenIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGYwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2stbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMGMwIDctOSAxMysxMCAxMyAwIDAgMC0xMCA3LTI0IDAtMTAgMS03LTEwLTExLTQgMi02IDMtOCAwLTMtMi01LTQtNi04eiIgZmlsbD0iIzAwZjAwMCIvPjwvc3ZnPg==",
  iconSize: [28, 32],
  iconAnchor: [14, 32],
});

const redIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZjAwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtMTAgMTMgMCAwIDAtMTAgNy0yNCAwLTEwIDEtNy0xMC0xMS00IDItNiAzLTggMC0zLTItNS00LTYtOHoiIGZpbGw9IiNmZjAwMDAiLz48L3N2Zz4=",
  iconSize: [28, 32],
  iconAnchor: [14, 32],
});

const blueIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAwZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtMTAgMTMgMCAwIDAtMTAgNy0yNCAwLTEwIDEtNy0xMC0xMS00IDItNiAzLTggMC0zLTItNS00LTYtOHoiIGZpbGw9IiMwMDAwZmYiLz48L3N2Zz4=",
  iconSize: [28, 32],
  iconAnchor: [14, 32],
});

const getIconByStatus = (status?: string) => {
  switch (status) {
    case "ON_WAY_TO_CUSTOMER":
      return blueIcon;
    case "ON_WAY_TO_PHARMACY":
      return redIcon;
    default:
      return greenIcon;
  }
};

export default function Map({ drivers }: { drivers: Driver[] }) {
  useEffect(() => {
    if (typeof window === "undefined" || drivers.length === 0) return;

    const map = L.map("map").setView([40.7128, -74.006], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const markers: L.Marker[] = [];

    drivers.forEach((driver) => {
      if (driver.lat !== undefined && driver.lng !== undefined) {
        const marker = L.marker([driver.lat, driver.lng], {
          icon: getIconByStatus(driver.status),
        })
          .bindPopup(
            `<div class="text-sm">
              <p class="font-bold">${driver.name}</p>
              <p class="text-xs text-gray-600">${driver.status || "Active"}</p>
            </div>`
          )
          .addTo(map);
        markers.push(marker);
      }
    });

    if (markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      map.remove();
    };
  }, [drivers]);

  return <div id="map" className="w-full h-96 rounded-lg" />;
}
