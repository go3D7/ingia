```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types'; // Assuming you have this file

type Premise = Database['public']['Tables']['premises']['Row'];

export default function ManagePremisePage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [premise, setPremise] = useState<Premise | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form fields state
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');

  const fetchUserDataAndPremise = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      router.push('/login');
      return;
    }
    setUser(session.user);

    const { data: premiseData, error: premiseError } = await supabase
      .from('premises')
      .select('*')
      .eq('owner_id', session.user.id)
      .single(); 

    if (premiseError && premiseError.code !== 'PGRST116') { // PGRST116: no rows found
      console.error('Error fetching premise data:', premiseError.message);
      setError('Failed to load premise data.');
      setLoading(false);
      return;
    }
    
    if (!premiseData) {
      // This case should ideally be handled by the AuthProvider or middleware
      // but as a fallback, we can redirect or show a message.
      router.push('/auth/complete-profile');
      return;
    }

    setPremise(premiseData);
    setBusinessName(premiseData.business_name || '');
    setCategory(premiseData.category || '');
    setPhone(premiseData.phone || '');
    setContactPerson(premiseData.contact_person || '');
    setAddress(premiseData.address || '');
    setCounty(data.county || '');
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchUserDataAndPremise();
  }, [fetchUserDataAndPremise]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!user || !premise) {
      setError('User or premise data not found. Please try again.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('premises')
      .update({
        business_name: businessName,
        category: category,
        phone: phone,
        contact_person: contactPerson, // Changed from fullName to contactPerson
        address: address,
        county: county,
        updated_at: new Date().toISOString(),
      })
      .eq('id', premise.id);

    setLoading(false);
    if (updateError) {
      setError(`Error updating premise: ${updateError.message}`);
    } else {
      setMessage('Premise information updated successfully!');
      // Optionally re-fetch data to ensure UI consistency or rely on state updates
      // For simplicity, we'll assume state updates are sufficient for immediate UI feedback
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    // This case should ideally be handled by the middleware or AuthContext
    return <p className="text-center mt-10">Redirecting to login...</p>;
  }

  if (!premise && !error) {
    // This case should ideally be handled by the redirection in useEffect
    // or by AuthContext redirecting to /auth/complete-profile
    return <div className="text-center mt-10">No premise information found. Please <a href="/auth/complete-profile" className="underline">complete your profile</a> to manage your premise.</div>;
  }
  
  if (error && !premise) {
    return <div className="text-red-500 text-center mt-10">{error}</div>;
  }


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Manage Your Premise</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
      {error && !message && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
      
      {premise && (
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-white p-8 shadow-md rounded-lg">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={user.email || ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">Business Name</label>
            <input
              id="businessName"
              name="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
            <input
              id="category"
              name="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">Contact Person</label>
            <input
              id="contactPerson"
              name="contactPerson"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
            <input
              id="address"
              name="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="county" className="block text-sm font-medium text-gray-700">County</label>
            <input
              id="county"
              name="county"
              type="text"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="friendlyCode" className="block text-sm font-medium text-gray-700">Friendly Code</label>
            <input
              id="friendlyCode"
              type="text"
              value={premise.friendly_code || ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || saving}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Premise Information'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```
