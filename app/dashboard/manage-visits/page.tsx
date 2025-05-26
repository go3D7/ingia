```tsx
// app/dashboard/manage-visits/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient, RealtimeChannel } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types'; // Assuming you have this file
import Link from 'next/link';

type Visit = Database['public']['Tables']['visits']['Row'] & {
  profiles?: { full_name: string | null; email: string | null } | null; 
};

interface FormFieldData {
  [key: string]: any; // Allows for dynamic keys based on form definitions
}

export default function ManageVisitsPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [premiseId, setPremiseId] = useState<string | null>(null);
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [admittedVisits, setAdmittedVisits] = useState<Visit[]>([]);
  const [historicalVisits, setHistoricalVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); 
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchUserDataAndVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    // setMessage(''); // Keep message for a bit after actions

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      router.push('/login');
      return;
    }
    setUser(session.user);

    const { data: premiseData, error: premiseError } = await supabase
      .from('premises')
      .select('id')
      .eq('owner_id', session.user.id)
      .single();

    if (premiseError || !premiseData) {
      setError('Could not retrieve premise information. Please ensure your profile is complete.');
      setLoading(false);
      return;
    }
    setPremiseId(premiseData.id);

    // Fetch pending visits
    const { data: pendingData, error: pendingError } = await supabase
      .from('visits')
      .select(`
        *,
        profiles ( full_name, email )
      `) 
      .eq('premise_id', premiseData.id)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error('Error fetching pending visits:', pendingError);
      setError(prev => prev ? `${prev} Failed to load pending visits.` : 'Failed to load pending visits.');
    } else {
      setPendingVisits(pendingData || []);
    }

    // Fetch admitted visits
    const { data: admittedData, error: admittedError } = await supabase
      .from('visits')
      .select(`
        *,
        profiles ( full_name, email )
      `)
      .eq('premise_id', premiseData.id)
      .eq('status', 'approved') // Assuming 'approved' means admitted and not yet checked out
      .is('check_out_time', null) // Only fetch those not yet checked out
      .order('check_in_time', { ascending: false });

    if (admittedError) {
      console.error('Error fetching admitted visits:', admittedError);
      setError(prev => prev ? `${prev} Failed to load admitted visits.` : 'Failed to load admitted visits.');
    } else {
      setAdmittedVisits(admittedData || []);
    }

    // Fetch historical visits
    const { data: historicalData, error: historicalError } = await supabase
      .from('visits')
      .select(`
        *,
        profiles ( full_name, email )
      `)
      .eq('premise_id', premiseData.id)
      .in('status', ['checked_out', 'denied'])
      .order('updated_at', { ascending: false }); // Order by last update time for history

    if (historicalError) {
      console.error('Error fetching historical visits:', historicalError);
      setError(prev => prev ? `${prev} Failed to load historical visits.` : 'Failed to load historical visits.');
    } else {
      setHistoricalVisits(historicalData || []);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchUserDataAndVisits();
  }, [fetchUserDataAndVisits]);

  useEffect(() => {
    if (!premiseId || !user) return;

    const channel = supabase
      .channel('realtime-visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `premise_id=eq.${premiseId}` },
        (payload) => {
          console.log('Change received!', payload);
          // Re-fetch all visits to update the lists comprehensively
          fetchUserDataAndVisits();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to visits channel!');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`Subscription error: ${status}`, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, premiseId, user, fetchUserDataAndVisits]); // Added user and fetchUserDataAndVisits to dependency array

  const handleApprove = async (visitId: string) => {
    setProcessing(true);
    setError('');
    setMessage('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !premiseId) {
      setError("User or premise information is missing.");
      setProcessing(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('visits')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .eq('premise_id', premiseId);

    setProcessing(false);
    if (updateError) {
      console.error('Error approving visit:', updateError);
      setError(`Failed to approve visit: ${updateError.message}`);
    } else {
      setMessage(`Visit approved successfully.`);
      // Realtime will handle the update, but can force a refresh if needed
      // fetchUserDataAndVisits(); 
    }
  };

  const handleDeny = async (visitId: string) => {
    const reason = prompt("Please provide a reason for denying this visit request:");
    if (reason === null) return;
    if (reason.trim() === "") {
      setError("A reason for denial is required.");
      return;
    }

    setProcessing(true);
    setError('');
    setMessage('');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !premiseId) {
      setError("User or premise information is missing.");
      setProcessing(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('visits')
      .update({ status: 'denied', denial_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', visitId)
      .eq('premise_id', premiseId);

    setProcessing(false);
    if (updateError) {
      console.error('Error denying visit:', updateError);
      setError(`Failed to deny visit: ${updateError.message}`);
    } else {
      setMessage(`Visit denied. Reason: ${reason}`);
      // Realtime will handle the update
    }
  };

  const handleCheckout = async (visitId: string) => {
    setProcessing(true);
    setError('');
    setMessage('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !premiseId) {
        setError("User or premise information is missing.");
        setProcessing(false);
        return;
    }

    try {
        const response = await fetch(`/api/visits/${visitId}/checkout`, {
            method: 'POST',
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to check out visitor.');
        }
        
        setMessage(result.message || 'Visitor checked out successfully.');
        // Realtime will handle the update
    } catch (err: any) {
        console.error('Error checking out visitor:', err);
        setError(err.message || 'An unexpected error occurred during checkout.');
    } finally {
        setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading visits...</p></div>;
  }

  if (error && !pendingVisits.length && !admittedVisits.length && !historicalVisits.length && !loading) { 
    return <div className="text-red-500 text-center mt-4 p-4">{error}</div>;
  }
  
  if (!user && !loading) { 
    return <div className="text-center mt-10">Please log in to manage visits.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6 text-center">Manage Visitor Requests</h1>

      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
      {error && !message && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Pending Approval</h2>
        {pendingVisits.length === 0 ? (
          <p>No pending visitor requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose of Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Check-in Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingVisits.map((visit) => {
                  const visitFormData = visit.form_data as FormFieldData || {};
                  const visitorName = visit.profiles?.full_name || visitFormData['Full Name'] || visitFormData['name'] || 'N/A';
                  const visitorEmail = visit.profiles?.email || visitFormData['Email'] || visitFormData['email'] || 'N/A';
                  const purposeOfVisit = visitFormData['Purpose'] || visitFormData['Purpose of Visit'] || 'N/A';

                  return (
                    <tr key={visit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{visitorName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitorEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purposeOfVisit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(visit.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleApprove(visit.id)}
                          disabled={processing}
                          className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(visit.id)}
                          disabled={processing}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Currently Admitted</h2>
        {admittedVisits.length === 0 ? (
          <p>No visitors currently in premise.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose of Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Check-in Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admittedVisits.map((visit) => {
                  const visitFormData = visit.form_data as FormFieldData || {};
                  const visitorName = visit.profiles?.full_name || visitFormData['Full Name'] || visitFormData['name'] || 'N/A';
                  const visitorEmail = visit.profiles?.email || visitFormData['Email'] || visitFormData['email'] || 'N/A';
                  const purposeOfVisit = visitFormData['Purpose'] || visitFormData['Purpose of Visit'] || 'N/A';

                  return (
                    <tr key={visit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{visitorName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitorEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purposeOfVisit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(visit.check_in_time!).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCheckout(visit.id)}
                          disabled={processing}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        >
                          Check Out
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Visitor History</h2>
        {historicalVisits.length === 0 ? (
          <p>No past visitor records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose of Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Check-in Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Check-out Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reason for Denial</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historicalVisits.map((visit) => {
                  const visitFormData = visit.form_data as FormFieldData || {};
                  const visitorName = visit.profiles?.full_name || visitFormData['Full Name'] || visitFormData['name'] || 'N/A';
                  const visitorEmail = visit.profiles?.email || visitFormData['Email'] || visitFormData['email'] || 'N/A';
                  const purposeOfVisit = visitFormData['Purpose'] || visitFormData['Purpose of Visit'] || 'N/A';

                  return (
                    <tr key={visit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{visitorName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{visitorEmail}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purposeOfVisit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(visit.check_in_time!).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visit.check_out_time ? new Date(visit.check_out_time).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visit.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visit.status === 'denied' ? visit.denial_reason : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```
