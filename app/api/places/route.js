// Fetch only popular nearby places from Overpass (OpenStreetMap)
function buildOverpassQuery(lat, lon, radius) {
  // radius in meters
  return `
    [out:json][timeout:25][limit:100];
    (
      // Major tourist attractions (must have name)
      node(around:${radius},${lat},${lon})[tourism~"attraction|museum|aquarium|zoo|theme_park|viewpoint|gallery"][name];
      way(around:${radius},${lat},${lon})[tourism~"attraction|museum|aquarium|zoo|theme_park|viewpoint|gallery"][name];
      relation(around:${radius},${lat},${lon})[tourism~"attraction|museum|aquarium|zoo|theme_park|viewpoint|gallery"][name];

      // Historic landmarks (castles, monuments, etc.)
      node(around:${radius},${lat},${lon})[historic~"monument|castle|memorial|archaeological_site"][name];
      way(around:${radius},${lat},${lon})[historic~"monument|castle|memorial|archaeological_site"][name];
      relation(around:${radius},${lat},${lon})[historic~"monument|castle|memorial|archaeological_site"][name];

      // Major leisure facilities
      node(around:${radius},${lat},${lon})[leisure~"park|stadium|garden|nature_reserve|golf_course"][name];
      way(around:${radius},${lat},${lon})[leisure~"park|stadium|garden|nature_reserve|golf_course"][name];
      relation(around:${radius},${lat},${lon})[leisure~"park|stadium|garden|nature_reserve|golf_course"][name];

      // Places with Wikipedia/Wikidata entries (indicates notability)
      node(around:${radius},${lat},${lon})[wikipedia][name];
      way(around:${radius},${lat},${lon})[wikipedia][name];
      relation(around:${radius},${lat},${lon})[wikipedia][name];
      
      node(around:${radius},${lat},${lon})[wikidata][name];
      way(around:${radius},${lat},${lon})[wikidata][name];
      relation(around:${radius},${lat},${lon})[wikidata][name];
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
    
    // First pass - basic filtering and shaping
    let items = elements.map((e) => {
      const tags = e.tags || {};
      const latNum = e.lat ?? e.center?.lat;
      const lonNum = e.lon ?? e.center?.lon;
      if (latNum == null || lonNum == null) return null;

      const name = tags.name || "Unnamed Place";
      const type = tags.amenity || tags.tourism || tags.leisure || tags.historic || "";
      
      return {
        id: `${e.type}/${e.id}`,
        name,
        type,
        lat: Number(latNum),
        lon: Number(lonNum),
        tags, // Keep all tags for secondary filtering
        address: tags["addr:full"] || tags["addr:street"] || null,
      };
    }).filter(Boolean);

    // Secondary filtering - ensure popularity
    items = items.filter(item => {
      // Keep if it has Wikipedia/Wikidata reference
      if (item.tags.wikipedia || item.tags.wikidata) return true;
      
      // Keep specific high-value types
      const highValueTypes = [
        'attraction', 'museum', 'aquarium', 'zoo', 'theme_park', 
        'viewpoint', 'gallery', 'monument', 'castle', 'memorial',
        'archaeological_site', 'park', 'stadium', 'garden', 
        'nature_reserve', 'golf_course'
      ];
      return highValueTypes.some(t => item.type.includes(t));
    });

    // Remove duplicates (same name and nearby location)
    const uniqueItems = [];
    const seen = new Set();
    
    items.forEach(item => {
      const key = `${item.name.toLowerCase()}|${item.lat.toFixed(3)}|${item.lon.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    });

    // Sort by distance from center
    const cLat = Number(lat),
          cLon = Number(lon);
    for (const it of uniqueItems) {
      const dx = (it.lon - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (it.lat - cLat) * 110540;
      it.distance = Math.sqrt(dx * dx + dy * dy);
    }
    uniqueItems.sort((a, b) => a.distance - b.distance);

    return new Response(JSON.stringify(uniqueItems), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}