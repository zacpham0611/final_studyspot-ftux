import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId') || searchParams.get('place_id');

  if (!placeId) {
    return NextResponse.json({ success: false, message: 'placeId is required' }, { status: 400 });
  }

  const reviews = store.getReviewsForPlace(placeId);
  return NextResponse.json({ reviews, count: reviews.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = store.addReview(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
