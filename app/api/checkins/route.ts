import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/data/store';

export async function POST(request: NextRequest) {
  try {
    const { placeId, level, note } = await request.json();
    if (!placeId || !level) {
      return NextResponse.json({ success: false, message: 'Thiếu placeId hoặc level' }, { status: 400 });
    }

    const result = store.addCheckin(placeId, level, note);
    if (!result.success) {
      return NextResponse.json(result, { status: 429 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
