function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      // Major amenities
      node(around:${radius},${lat},${lon})[amenity~"university|college|hospital|stadium|theatre|museum|library"];
      way(around:${radius},${lat},${lon})[amenity~"university|college|hospital|stadium|theatre|museum|library"];
      relation(around:${radius},${lat},${lon})[amenity~"university|college|hospital|stadium|theatre|museum|library"];
      
      // Important tourist attractions
      node(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      way(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      relation(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      
      // Major leisure facilities
      node(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      way(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      relation(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      
      // Landmarks and historic sites
      node(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
      way(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
      relation(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
    );
    out center;
  `;
}

function scorePlace(type) {
  if (/university|college/.test(type)) return 5;
  if (/hospital/.test(type)) return 5;
  if (/stadium|theatre|museum/.test(type)) return 4;
  if (/park|nature_reserve/.test(type)) return 3;
  return 1;
}

function maxResultsForRadius(miles) {
  if (miles <= 10) return 7;
  if (miles <= 20) return 12;
  if (miles <= 50) return 20;
  if (miles <= 100) return 30;
  if (miles <= 200) return 40;
  if (miles <= 500) return 50;
  return 50;
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
      next: { revalidate: 60 },
    });
    if (!r.ok) throw new Error(`Overpass error ${r.status}`);
    return r.json();
  }

  try {
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

    const cLat = Number(lat), cLon = Number(lon);
    for (const it of items) {
      const dx = (it.lon - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (it.lat - cLat) * 110540;
      it.distance = Math.sqrt(dx * dx + dy * dy);
    }

    items.sort((a, b) =>
      scorePlace(b.type) - scorePlace(a.type) || a.distance - b.distance
    );

    const miles = radius / 1609.344;
    const limited = items.slice(0, maxResultsForRadius(miles));

    return new Response(JSON.stringify(limited), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
