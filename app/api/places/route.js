function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:30];
    (
      // Only major tourist attractions with Wikipedia/Wikidata references
      node(around:${radius},${lat},${lon})[tourism=attraction][name][wikipedia];
      way(around:${radius},${lat},${lon})[tourism=attraction][name][wikipedia];
      relation(around:${radius},${lat},${lon})[tourism=attraction][name][wikipedia];
      
      node(around:${radius},${lat},${lon})[tourism=attraction][name][wikidata];
      way(around:${radius},${lat},${lon})[tourism=attraction][name][wikidata];
      relation(around:${radius},${lat},${lon})[tourism=attraction][name][wikidata];
      
      // Major landmarks (man-made and natural)
      node(around:${radius},${lat},${lon})[historic=monument][name];
      way(around:${radius},${lat},${lon})[historic=monument][name];
      relation(around:${radius},${lat},${lon})[historic=monument][name];
      
      node(around:${radius},${lat},${lon})[natural=peak][name];
      way(around:${radius},${lat},${lon})[natural=peak][name];
      relation(around:${radius},${lat},${lon})[natural=peak][name];
      
      // Only 4+ star hotels
      node(around:${radius},${lat},${lon})[tourism=hotel][name][stars>=4];
      way(around:${radius},${lat},${lon})[tourism=hotel][name][stars>=4];
      relation(around:${radius},${lat},${lon})[tourism=hotel][name][stars>=4];
      
      // Large shopping malls
      node(around:${radius},${lat},${lon})[shop=mall][name][building_size=large];
      way(around:${radius},${lat},${lon})[shop=mall][name][building_size=large];
      relation(around:${radius},${lat},${lon})[shop=mall][name][building_size=large];
    );
    out center;
    out count;
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
