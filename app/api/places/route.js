// Only fetch significant/touristic places that are likely to be popular
function buildOverpassQuery(lat, lon, radius) {
  // radius in meters
  return `
    [out:json][timeout:25];
    (
      // High-traffic amenities
      node(around:${radius},${lat},${lon})[amenity=restaurant][name];
      node(around:${radius},${lat},${lon})[amenity=cafe][name];
      node(around:${radius},${lat},${lon})[amenity=bar][name];
      node(around:${radius},${lat},${lon})[amenity=pub][name];
      node(around:${radius},${lat},${lon})[amenity=nightclub][name];
      
      // Tourist attractions
      node(around:${radius},${lat},${lon})[tourism=attraction][name];
      node(around:${radius},${lat},${lon})[tourism=museum][name];
      node(around:${radius},${lat},${lon})[tourism=zoo][name];
      node(around:${radius},${lat},${lon})[tourism=aquarium][name];
      node(around:${radius},${lat},${lon})[tourism=theme_park][name];
      node(around:${radius},${lat},${lon})[tourism=viewpoint][name];
      
      // Significant landmarks
      node(around:${radius},${lat},${lon})[historic=monument][name];
      node(around:${radius},${lat},${lon})[historic=castle][name];
      node(around:${radius},${lat},${lon})[historic=church][name];
      
      // Popular leisure spots
      node(around:${radius},${lat},${lon})[leisure=park][name];
      node(around:${radius},${lat},${lon})[leisure=beach][name];
      node(around:${radius},${lat},${lon})[leisure=marina][name];
      
      // Shopping areas
      node(around:${radius},${lat},${lon})[shop=mall][name];
      node(around:${radius},${lat},${lon})[shop=department_store][name];
      
      // Also include ways and relations for these important types
      way(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|aquarium|theme_park"][name];
      relation(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|aquarium|theme_park"][name];
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
    
    // Calculate popularity score based on OSM tags
    const calculatePopularityScore = (tags) => {
      let score = 0;
      
      // Base points for having a name
      if (tags.name) score += 10;
      
      // Points for specific popular types
      if (tags.tourism === 'attraction') score += 20;
      if (tags.tourism === 'museum') score += 30;
      if (tags.tourism === 'zoo' || tags.tourism === 'aquarium') score += 25;
      if (tags.amenity === 'restaurant') score += 15;
      if (tags.leisure === 'park') score += 10;
      
      // Additional points for known brands or chains
      if (tags.brand) score += 5;
      if (tags['name:en']) score += 5; // International name suggests popularity
      
      // Points for capacity indicators
      if (tags.capacity) score += parseInt(tags.capacity) / 100;
      if (tags['building:levels']) score += parseInt(tags['building:levels']) * 2;
      
      return score;
    };

    const items = elements
      .map((e) => {
        const tags = e.tags || {};
        const latNum = e.lat ?? e.center?.lat;
        const lonNum = e.lon ?? e.center?.lon;
        if (latNum == null || lonNum == null) return null;

        // Skip if no name (less likely to be popular)
        if (!tags.name) return null;

        const type = tags.amenity || tags.tourism || tags.leisure || tags.historic || tags.shop || 'attraction';
        
        return {
          id: `${e.type}/${e.id}`,
          name: tags.name,
          type,
          lat: Number(latNum),
          lon: Number(lonNum),
          address: tags["addr:full"] || tags["addr:street"] || null,
          popularity: calculatePopularityScore(tags),
          tags // Include all tags for additional filtering if needed
        };
      })
      .filter(Boolean)
      // Filter to only include places with minimum popularity
      .filter(item => item.popularity >= 15);

    // Calculate distance and sort by popularity then distance
    const cLat = Number(lat),
      cLon = Number(lon);
    for (const it of items) {
      const dx = (it.lon - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (it.lat - cLat) * 110540;
      it.distance = Math.sqrt(dx * dx + dy * dy);
    }
    
    // Sort by popularity (descending) then by distance (ascending)
    items.sort((a, b) => {
      if (b.popularity !== a.popularity) {
        return b.popularity - a.popularity;
      }
      return a.distance - b.distance;
    });

    // Limit to top 50 results to avoid overwhelming the client
    const topResults = items.slice(0, 50);

    return new Response(JSON.stringify(topResults), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}