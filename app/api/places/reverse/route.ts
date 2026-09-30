import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng') || searchParams.get('lon');

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: 'Thiếu tham số tọa độ lat và lng' },
        { status: 400 }
      );
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      return NextResponse.json(
        { success: false, error: 'Tọa độ không hợp lệ' },
        { status: 400 }
      );
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
      numLat
    )}&lon=${encodeURIComponent(numLng)}&format=json&addressdetails=1`;

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
          error: 'Hệ thống bản đồ đang tạm bận (Quá giới hạn truy vấn). Vui lòng thử lại sau vài giây!',
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Máy chủ bản đồ OpenStreetMap trả về mã lỗi ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data || data.error) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error || 'Không tìm thấy thông tin địa chỉ tại tọa độ này',
        },
        { status: 404 }
      );
    }

    const rawName =
      data.name ||
      data.address?.amenity ||
      data.address?.cafe ||
      data.address?.shop ||
      data.address?.building ||
      data.address?.leisure ||
      '';

    const address = data.display_name || '';

    return NextResponse.json({
      success: true,
      data: {
        name: rawName ? rawName.trim() : '',
        address: address ? address.trim() : '',
        lat: parseFloat(data.lat || lat),
        lng: parseFloat(data.lon || lng),
      },
    });
  } catch (err: any) {
    console.error('Nominatim reverse geocode error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi kết nối đến dịch vụ giải mã tọa độ OpenStreetMap.',
      },
      { status: 500 }
    );
  }
}
