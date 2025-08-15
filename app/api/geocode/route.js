export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        // Please customize to your app name/email per Nominatim usage policy
        "User-Agent": "LocateMyCity/1.0 (contact@example.com)",
        Referer: "https://your-app.example", // optional but recommended
      },
      // Cache briefly to be nice to the free service
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Geocoding service error" }), { status: 502 });
    }

    const data = await res.json();
    const first = data?.[0];
    if (!first) {
      return new Response(JSON.stringify({ error: "No results" }), { status: 404 });
    }

    return new Response(
      JSON.stringify({
        lat: first.lat,
        lon: first.lon,
        display_name: first.display_name,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
