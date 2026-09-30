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

    // Call OpenStreetMap Nominatim as the sole search provider (Server-side)
    const searchTerms = cleanQuery.toLowerCase().includes('hà nội') || cleanQuery.toLowerCase().includes('ha noi')
      ? cleanQuery
      : `${cleanQuery}, Hà Nội`;

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      searchTerms
    )}&format=json&addressdetails=1&limit=8&countrycodes=vn`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'StudySpotFTU/1.0 (Educational Project; contact: admin@studyspot.ftu.edu.vn)',
        'Accept-Language': 'vi,en;q=0.9',
      },
      next: { revalidate: 3600 },
    });

    if (response.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'Hệ thống tìm kiếm địa điểm đang tạm bận (Quá giới hạn truy vấn). Vui lòng thử lại sau vài giây!',
          places: [],
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Máy chủ bản đồ trả về mã lỗi ${response.status}`,
          places: [],
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({
        success: true,
        places: [],
        message: 'Không tìm thấy địa điểm phù hợp',
      });
    }

    const places = data.map((item: any) => {
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
      provider: 'nominatim',
    });
  } catch (err: any) {
    console.error('Nominatim search API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi kết nối đến dịch vụ tìm kiếm địa điểm OpenStreetMap.',
        places: [],
      },
      { status: 500 }
    );
  }
}
