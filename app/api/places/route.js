// Fetch nearby "places" (amenities/tourism/leisure) from Overpass (OpenStreetMap)
function buildOverpassQuery(lat, lon, radius) {
  // radius in meters
  return `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon})[amenity];
      way(around:${radius},${lat},${lon})[amenity];
      relation(around:${radius},${lat},${lon})[amenity];

      node(around:${radius},${lat},${lon})[tourism];
      way(around:${radius},${lat},${lon})[tourism];
      relation(around:${radius},${lat},${lon})[tourism];

      node(around:${radius},${lat},${lon})[leisure];
      way(around:${radius},${lat},${lon})[leisure];
      relation(around:${radius},${lat},${lon})[leisure];
    );
    out center;
  `;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius");

  if (!lat || !lon || !radius) {
    return new Response(JSON.stringify({ error: "Missing lat/lon/radius" }), { status: 400 });
  }

  const q = buildOverpassQuery(lat, lon, radius);

  async function callOverpass(endpoint) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
      // Cache a little to reduce load; adjust to your needs
      next: { revalidate: 60 },
    });
    if (!r.ok) throw new Error(`Overpass error ${r.status}`);
    return r.json();
  }

  try {
    // primary + fallback mirrors
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter",
    ];

    let json;
    let lastErr;
    for (const ep of endpoints) {
      try {
        json = await callOverpass(ep);
        if (json) break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!json) throw lastErr || new Error("Overpass failed");

    const elements = json.elements || [];
    // Shape into UI-friendly objects
    const items = elements
      .map((e) => {
        const tags = e.tags || {};
        const latNum = e.lat ?? e.center?.lat;
        const lonNum = e.lon ?? e.center?.lon;
        if (latNum == null || lonNum == null) return null;

        const name =
          tags.name ||
          tags["addr:housename"] ||
          tags["amenity"] ||
          tags["tourism"] ||
          tags["leisure"] ||
          "Place";

        const type = tags.amenity || tags.tourism || tags.leisure || "";
        return {
          id: `${e.type}/${e.id}`,
          name,
          type,
          lat: Number(latNum),
          lon: Number(lonNum),
          address: tags["addr:full"] || tags["addr:street"] || null,
        };
      })
      .filter(Boolean);

    // Optional: sort by rough distance from center
    const cLat = Number(lat),
      cLon = Number(lon);
    for (const it of items) {
      // very rough planar distance (ok for sorting)
      const dx = (it.lon - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (it.lat - cLat) * 110540;
      it.distance = Math.sqrt(dx * dx + dy * dy);
    }
    items.sort((a, b) => a.distance - b.distance);

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
