```typescript
// app/api/visits/submit/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Database } from '@/lib/database.types';

export async function POST(request: NextRequest) {
  const supabase = createClientComponentClient<Database>({ cookies });

  try {
    const { qrIdentifier, formData } = await request.json();

    if (!qrIdentifier || !formData) {
      return NextResponse.json({ error: 'Missing qrIdentifier or formData' }, { status: 400 });
    }

    // 1. Fetch QR code details
    const { data: qrCodeData, error: qrError } = await supabase
      .from('qrcodes')
      .select('id, form_id, premise_id, is_active')
      .eq('qr_identifier', qrIdentifier)
      .single();

    if (qrError || !qrCodeData) {
      console.error('Error fetching QR code or QR code not found:', qrError?.message);
      return NextResponse.json({ error: 'Invalid or expired QR code.' }, { status: 404 });
    }

    if (!qrCodeData.is_active) {
      return NextResponse.json({ error: 'This QR code is no longer active.' }, { status: 400 });
    }

    // 2. Fetch Form details to ensure it's active
    const { data: formDetails, error: formDetailsError } = await supabase
      .from('forms')
      .select('id, name, definition, is_active, premise_id') // Added definition to get field names
      .eq('id', qrCodeData.form_id)
      .single();

    if (formDetailsError || !formDetails) {
      return NextResponse.json({ error: 'Form associated with this QR code not found.' }, { status: 404 });
    }

    if (!formDetails.is_active) {
      return NextResponse.json({ error: 'This form is no longer active.' }, { status: 400 });
    }

    if (formDetails.premise_id !== qrCodeData.premise_id) {
      console.error('Mismatch in premise ID between QR code and form.');
      return NextResponse.json({ error: 'Form configuration error.' }, { status: 500 });
    }

    // Extract visitor details from formData
    // Standardize keys by converting to lowercase and replacing spaces with underscores
    const normalizedFormData: { [key: string]: any } = {};
    for (const key in formData) {
      normalizedFormData[key.toLowerCase().replace(/\s+/g, '_')] = formData[key];
    }

    const visitorEmail = normalizedFormData['email'];
    const visitorPhone = normalizedFormData['phone_number'] || normalizedFormData['phone'];
    const visitorFullName = normalizedFormData['full_name'] || normalizedFormData['name'];
    const visitorIdNumber = normalizedFormData['id_number'];


    // 3. Insert into 'visits' table
    const { data: visitData, error: insertError } = await supabase
      .from('visits')
      .insert([{
        premise_id: qrCodeData.premise_id,
        form_id: formDetails.id, 
        qrcode_id: qrCodeData.id,
        form_data: formData,
        status: 'checked_in', // Default status
        check_in_time: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting visit:', insertError);
      return NextResponse.json({ error: 'Failed to submit form.', details: insertError.message }, { status: 500 });
    }

    if (!visitData) {
      return NextResponse.json({ error: 'Failed to retrieve new visit after creation.' }, { status: 500 });
    }

    // 4. Find or Create Visitor and Link to Visit
    let visitorIdToLink: string | null = null;

    // Attempt to find by email first
    if (visitorEmail) {
      const { data: existingVisitor, error: findByEmailError } = await supabase
        .from('profiles') // Assuming 'profiles' table stores visitor information
        .select('id')
        .eq('email', visitorEmail)
        .maybeSingle();

      if (findByEmailError) {
        console.error('Error finding visitor by email:', findByEmailError.message);
      } else if (existingVisitor) {
        visitorIdToLink = existingVisitor.id;
      }
    }

    // If not found by email, and phone is provided, try to find by phone
    if (!visitorIdToLink && visitorPhone) {
        const { data: existingVisitor, error: findByPhoneError } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone_number', visitorPhone)
            .maybeSingle();
        
        if (findByPhoneError) {
            console.error('Error finding visitor by phone:', findByPhoneError.message);
        } else if (existingVisitor) {
            visitorIdToLink = existingVisitor.id;
        }
    }
    
    // If still not found, and we have enough info, create a new visitor
    if (!visitorIdToLink && (visitorFullName || visitorEmail || visitorIdNumber)) {
        // Create a new visitor profile
        const { data: newVisitor, error: createError } = await supabase
            .from('profiles')
            .insert([{ 
                id: user.id, // This should be the user ID if it's a registered user, or a new UUID for a guest
                full_name: visitorFullName, 
                phone_number: visitorPhone, // May be null if not provided
                // email: visitorEmail, // Commented out as email is likely unique and part of auth.users
                // id_number: visitorIdNumber // Assuming id_number field exists in profiles table
            }])
            .select('id')
            .single();
        
        if (createError) {
            console.error('Error creating new visitor:', createError.message);
        } else if (newVisitor) {
            visitorIdToLink = newVisitor.id;
        }
    }


    if (visitorIdToLink) {
      const { error: updateVisitError } = await supabase
        .from('visits')
        .update({ 
            visitor_id: visitorIdToLink,
            updated_at: new Date().toISOString()
        })
        .eq('id', visitData.id);

      if (updateVisitError) {
        console.error('Error linking visit to visitor:', updateVisitError.message);
        // Log this error but don't fail the overall operation as the visit is already created.
      }
    }

    return NextResponse.json({ message: 'Visit recorded successfully', visitId: visitData.id }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in /api/visits/submit:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```
