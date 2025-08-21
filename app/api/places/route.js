function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      // Major amenities
      node(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      way(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      relation(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      
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

// ---- UPDATED scoring function ----
function scorePlace(tags) {
  if (tags.wikipedia || tags.wikidata) return 5; // globally notable
  if (tags.tourism === "attraction" || tags.historic) return 4; // tourist/historic spots
  if (tags.amenity === "theatre" || tags.amenity === "stadium" || tags.amenity === "museum") return 3;
  if (tags.leisure === "park" || tags.leisure === "nature_reserve") return 2;
  return 1; // default
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

// ---- helper for chunking large radii ----
async function callOverpassQuery(q) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        next: { revalidate: 60 },
      });
      if (r.ok) return r.json();
    } catch (e) {
      console.error("Overpass failed at", ep, e);
    }
  }
  throw new Error("All Overpass endpoints failed");
}

async function callOverpassWithChunking(lat, lon, radius, qBuilder) {
  // if radius ≤ 300km, single query
  if (radius <= 300000) {
    const q = qBuilder(lat, lon, radius);
    return callOverpassQuery(q);
  }

  // otherwise split into 250km steps
  const step = 250000;
  let start = 0;
  const all = [];
  while (start < radius) {
    const end = Math.min(start + step, radius);
    const q = qBuilder(lat, lon, end);
    try {
      const json = await callOverpassQuery(q);
      if (json?.elements) all.push(...json.elements);
    } catch (e) {
      console.warn(`Chunk ${start}-${end} failed`, e);
    }
    start = end;
  }
  return { elements: all };
}

// ---- main handler ----
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius");

  if (!lat || !lon || !radius) {
    return new Response(JSON.stringify({ error: "Missing lat/lon/radius" }), { status: 400 });
  }

  try {
    const json = await callOverpassWithChunking(lat, lon, radius, buildOverpassQuery);
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

        return {
          id: `${e.type}/${e.id}`,
          name,
          tags, // keep tags for scoring
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

    // ---- UPDATED sort ----
    items.sort((a, b) =>
      scorePlace(b.tags) - scorePlace(a.tags) || a.distance - b.distance
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
