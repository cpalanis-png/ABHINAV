const fmt = (lat: number, lng: number) =>
  `Coordinates: ${Math.abs(lat).toFixed(5)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(5)}°${lng >= 0 ? "E" : "W"}`;

export default async (req: Request) => {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { "User-Agent": "SMART-SHIELD-App/5.0 (smart-shield-5-0-1.netlify.app)", "Accept-Language": "en" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (geoRes.ok) {
      const data = await geoRes.json();
      const a = data.address || {};
      const road = a.road || a.pedestrian || a.suburb || "";
      const city = a.city || a.town || a.village || a.county || "";
      const state = a.state || a.region || "";
      const country = a.country || "";
      return Response.json({
        address: data.display_name || [road, city, state, country].filter(Boolean).join(", ") || fmt(lat, lng),
        city,
        state,
        country,
        rawDetails: a,
        source: "OpenStreetMap Nominatim",
      });
    }
  } catch {
    // fall through to coordinate fallback
  }

  return Response.json({ address: fmt(lat, lng), city: "", state: "", country: "", source: "Coordinate Fallback" });
};

export const config = { path: "/api/geocoding/reverse" };
