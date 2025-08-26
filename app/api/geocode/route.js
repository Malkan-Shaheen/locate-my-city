export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 });
  }

  // Add addressdetails=1 to get detailed address information including country code
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(
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

    // Extract country code from address details
    const address = first.address || {};
    let countryCode = null;
    
    // Try different possible fields for country code
    if (address.country_code) {
      countryCode = address.country_code.toUpperCase(); // Usually 2-letter code like "PK", "IN", etc.
    } else if (address.iso3166_1_alpha_2) {
      countryCode = address.iso3166_1_alpha_2.toUpperCase();
    } else if (address.iso3166_1_alpha_3) {
      // Convert 3-letter code to 2-letter code if needed (you might need a mapping)
      countryCode = address.iso3166_1_alpha_3.toUpperCase();
      // For common cases, you could add a mapping here
      const codeMap = {
        'PAK': 'PK', // Pakistan
        'IND': 'IN', // India
        'USA': 'US', // United States
        'GBR': 'GB', // United Kingdom
        'CAN': 'CA', // Canada
        'AUS': 'AU', // Australia
        'DEU': 'DE', // Germany
        'FRA': 'FR', // France
        // Add more mappings as needed
      };
      countryCode = codeMap[countryCode] || countryCode;
    }

    return new Response(
      JSON.stringify({
        lat: first.lat,
        lon: first.lon,
        display_name: first.display_name,
        country_code: countryCode,
        address: address // Include full address for debugging if needed
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}