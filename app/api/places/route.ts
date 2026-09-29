import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const categoryId = searchParams.get('category') ? Number(searchParams.get('category')) : undefined;

  const places = store.filterPlaces({
    query,
    categoryId,
  });

  return NextResponse.json({ places, count: places.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newPlace = store.proposePlace(body);
    return NextResponse.json({ success: true, place: newPlace }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
