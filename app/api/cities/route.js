function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon})["place"~"city|town"];
      way(around:${radius},${lat},${lon})["place"~"city|town"];
      relation(around:${radius},${lat},${lon})["place"~"city|town"];
    );
    out center;
  `;
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
    const tmp = [];
    const seen = new Set();

    const cLat = Number(lat), cLon = Number(lon);

    for (const e of elements) {
      const tags = e.tags || {};
      const name = tags.name;
      const place = tags.place; // city | town
      const latNum = e.lat ?? e.center?.lat;
      const lonNum = e.lon ?? e.center?.lon;
      if (!name || latNum == null || lonNum == null) continue;
      if (seen.has(name)) continue;
      seen.add(name);

      const ilat = Number(latNum), ilon = Number(lonNum);
      const dx = (ilon - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (ilat - cLat) * 110540;
      const distance = Math.sqrt(dx * dx + dy * dy);

      tmp.push({
        id: `${e.type}/${e.id}`,
        name,
        place,
        lat: ilat,
        lon: ilon,
        distance,
      });
    }

    // Prioritize cities over towns
    tmp.sort((a, b) =>
      (a.place === "city" && b.place !== "city" ? -1 : b.place === "city" && a.place !== "city" ? 1 : 0) ||
      a.distance - b.distance
    );

    const miles = radius / 1609.344;
    const limited = tmp.slice(0, maxResultsForRadius(miles));

    return new Response(JSON.stringify(limited), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
