import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, places: [] });
    }

    const cleanQuery = query.trim();
    const googleApiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 1. Try Google Places API if key is present in environment
    if (googleApiKey) {
      try {
        // First try Google Places API (New) - Text Search
        const newApiRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
          },
          body: JSON.stringify({
            textQuery: cleanQuery,
            locationBias: {
              circle: {
                center: { latitude: 21.0245, longitude: 105.8046 }, // FTU Hanoi Center
                radius: 35000.0, // 35km radius in and around Hanoi
              },
            },
            languageCode: 'vi',
          }),
        });

        if (newApiRes.ok) {
          const newApiData = await newApiRes.json();
          if (newApiData.places && Array.isArray(newApiData.places) && newApiData.places.length > 0) {
            const places = newApiData.places.map((p: any) => ({
              id: p.id,
              name: p.displayName?.text || '',
              address: p.formattedAddress || '',
              lat: p.location?.latitude,
              lng: p.location?.longitude,
            }));
            return NextResponse.json({ success: true, places, provider: 'google-places-new' });
          }
        }

        // Second fallback: Google Places API (Legacy) - Text Search
        const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          cleanQuery
        )}&location=21.0245,105.8046&radius=35000&language=vi&key=${googleApiKey}`;

        const legacyRes = await fetch(legacyUrl);
        if (legacyRes.ok) {
          const legacyData = await legacyRes.json();
          if (legacyData.results && Array.isArray(legacyData.results) && legacyData.results.length > 0) {
            const places = legacyData.results.map((r: any) => ({
              id: r.place_id,
              name: r.name,
              address: r.formatted_address,
              lat: r.geometry?.location?.lat,
              lng: r.geometry?.location?.lng,
            }));
            return NextResponse.json({ success: true, places, provider: 'google-places-legacy' });
          }
        }
      } catch (googleErr: any) {
        console.warn('Google Places API fetch error:', googleErr.message);
      }
    }

    // 2. High-res Fallback: OpenStreetMap Nominatim (works without Google billing during local dev/demo)
    try {
      const searchTerms = cleanQuery.toLowerCase().includes('hà nội') || cleanQuery.toLowerCase().includes('ha noi')
        ? cleanQuery
        : `${cleanQuery}, Hà Nội`;

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchTerms
      )}&format=json&addressdetails=1&limit=6&countrycodes=vn`;

      const osmRes = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'StudySpotFTU/1.0 (contact: admin@studyspot.ftu.edu.vn)',
          'Accept-Language': 'vi',
        },
      });

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (Array.isArray(osmData) && osmData.length > 0) {
          const places = osmData.map((item: any) => {
            const rawName = item.name || (item.display_name ? item.display_name.split(',')[0] : '');
            return {
              id: String(item.place_id),
              name: rawName.trim(),
              address: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          return NextResponse.json({
            success: true,
            places,
            provider: 'nominatim-fallback',
            googleConfigured: Boolean(googleApiKey),
          });
        }
      }
    } catch (osmErr: any) {
      console.warn('Nominatim fallback fetch notice:', osmErr.message);
    }

    return NextResponse.json({
      success: true,
      places: [],
      googleConfigured: Boolean(googleApiKey),
    });
  } catch (err: any) {
    console.error('Places search API error:', err);
    return NextResponse.json({ success: true, places: [], error: err.message });
  }
}
