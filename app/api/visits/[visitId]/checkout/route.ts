```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Database } from '@/lib/database.types';

export async function POST(
  request: NextRequest,
  { params }: { params: { visitId: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { visitId } = params;

  if (!visitId) {
    return NextResponse.json({ error: 'Visit ID is required' }, { status: 400 });
  }

  try {
    // 1. Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Fetch the visit record to ensure it exists and belongs to the user's premise
    const { data: visit, error: fetchError } = await supabase
      .from('visits')
      .select(`
        id,
        premise_id,
        status,
        premises (
          owner_id
        )
      `)
      .eq('id', visitId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // PostgREST error for "exactly one row expected"
        return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      }
      console.error('Error fetching visit:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch visit details' }, { status: 500 });
    }

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Type assertion for premise data
    const premiseData = visit.premises as { owner_id: string | null };

    // 3. Verify ownership
    if (!premiseData || premiseData.owner_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this premise.' }, { status: 403 });
    }

    // 4. Check if the visit is already checked out or not approved
    if (visit.status === 'checked_out') {
      return NextResponse.json({ error: 'Visitor already checked out.' }, { status: 400 });
    }
    if (visit.status !== 'approved') {
      return NextResponse.json({ error: 'Visitor not approved yet.' }, { status: 400 });
    }

    // 5. Update visit status to 'checked_out' and set check_out_time
    const { data: updatedVisit, error: updateError } = await supabase
      .from('visits')
      .update({ 
        status: 'checked_out', 
        check_out_time: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', visitId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating visit status to checked_out:', updateError);
      return NextResponse.json({ error: 'Failed to check out visitor.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Visitor checked out successfully', visit: updatedVisit });

  } catch (error) {
    console.error('Unexpected error in /api/visits/[visitId]/checkout:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```
