```tsx
// app/dashboard/forms/[formId]/visits/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types'; // Assuming you have this file
import Link from 'next/link';

type Visit = Database['public']['Tables']['visits']['Row'] & {
  profiles?: { full_name: string | null, email: string | null } | null; // For joined data
};
type Form = Database['public']['Tables']['forms']['Row'];

export default function FormVisitsPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const params = useParams();
  const formId = params.formId as string;

  const [visits, setVisits] = useState<Visit[]>([]);
  const [formName, setFormName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const fetchUserDataAndForms = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      router.push('/login');
      return;
    }
    setUser(session.user);

    // Fetch form details to verify ownership and get form name
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('name, premise_id, owner_id') // Ensure owner_id is selected for direct check
      .eq('id', formId)
      .single();

    if (formError || !formData) {
      setError('Form not found.');
      setLoading(false);
      return;
    }

    // Verify ownership
    if (formData.owner_id !== session.user.id) {
      setError('You do not have permission to view visits for this form.');
      setLoading(false);
      return;
    }
    
    setFormName(formData.name);

    // Fetch visits for this form
    const { data: visitsData, error: visitsError } = await supabase
      .from('visits')
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .eq('form_id', formId)
      .order('check_in_time', { ascending: false });

    if (visitsError) {
      console.error('Error fetching visits:', visitsError);
      setError('Failed to load visits.');
    } else {
      setVisits(visitsData || []);
    }
    setLoading(false);
  }, [supabase, formId, router]);

  useEffect(() => {
    fetchUserDataAndForms();
  }, [fetchUserDataAndForms]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading visits...</p></div>;
  }

  if (error) {
    return <div className="text-red-500 text-center mt-4">{error}</div>;
  }

  if (!user) {
    // This case should ideally be handled by the middleware redirecting to login
    return <div className="text-center mt-10">Please log in to view your forms.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Link href="/dashboard/forms" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
        &larr; Back to Forms
      </Link>
      <h1 className="text-2xl font-bold mb-6">Visits for {formName || 'Form'}</h1>
      
      {visits.length === 0 ? (
        <p>No visits recorded for this form yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visits.map((visit) => (
                <tr key={visit.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {visit.profiles?.full_name || visit.form_data?.full_name || visit.form_data?.Name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {visit.profiles?.email || visit.form_data?.email || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(visit.check_in_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {visit.status || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Link href={`/dashboard/visits/${visit.id}`} legacyBehavior>
                      <a className="text-indigo-600 hover:text-indigo-900">View Details</a>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```
