```tsx
// app/dashboard/forms/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types'; // Assuming you have this file

type Form = Database['public']['Tables']['forms']['Row'];

export default function FormsPage() {
  const supabase = createClientComponentClient<Database>();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Should be handled by middleware, but as a fallback
        // router.push('/login'); // Assuming useRouter is imported if needed
        return;
      }

      // First, get the user's premise_id
      const { data: premiseData, error: premiseError } = await supabase
        .from('premises')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (premiseError || !premiseData) {
        setError('Could not load premise information. Please ensure your profile is complete.');
        setLoading(false);
        return;
      }

      const { data, error: formsError } = await supabase
        .from('forms')
        .select('*')
        .eq('premise_id', premiseData.id)
        .order('created_at', { ascending: false });

      if (formsError) {
        console.error('Error fetching forms:', formsError);
        setError('Failed to load forms.');
      } else {
        setForms(data || []);
      }
      setLoading(false);
    };

    fetchForms();
  }, [supabase]);

  if (loading) {
    return <div className="container mx-auto p-4 text-center">Loading forms...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Forms</h1>
        <Link href="/dashboard/forms/new" legacyBehavior>
          <a className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create New Form
          </a>
        </Link>
      </div>

      {forms.length === 0 ? (
        <p>No forms created yet. Click "Create New Form" to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div key={form.id} className="bg-white shadow-md rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">{form.name}</h2>
              <p className="text-gray-600 mb-1">Status: {form.is_active ? 'Active' : 'Inactive'}</p>
              <p className="text-gray-600 text-sm">Created: {new Date(form.created_at).toLocaleDateString()}</p>
              <Link href={`/dashboard/forms/${form.id}/edit`} legacyBehavior>
                <a className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded text-sm">
                  Edit Form
                </a>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
