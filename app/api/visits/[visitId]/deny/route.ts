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

    // 2. Fetch the visit record and the associated premise's owner_id
    const { data: visit, error: fetchError } = await supabase
      .from('visits')
      .select(`
        id,
        premise_id,
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
      return NextResponse.json({ error: 'Forbidden: You do not own this premise or form.' }, { status: 403 });
    }

    // 4. Update visit status to 'denied'
    const { data: updatedVisit, error: updateError } = await supabase
      .from('visits')
      .update({ status: 'denied', updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating visit status:', updateError);
      return NextResponse.json({ error: 'Failed to update visit status.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Visitor denied successfully', visit: updatedVisit });

  } catch (error) {
    console.error('Unexpected error in /api/visits/[visitId]/deny:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```
