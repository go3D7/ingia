```tsx
// app/auth/complete-profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types'; // Assuming you have this file

export default function CompleteProfilePage() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login'); // Redirect if not logged in
      } else {
        setUserEmail(session.user.email);
        // Check if profile and premise already exist and redirect if so
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116: no rows found
          console.error('Error checking profile:', profileError.message);
          setError('Error checking profile.');
          return;
        }

        if (profileData) {
          const { data: premiseData, error: premiseError } = await supabase
            .from('premises')
            .select('id')
            .eq('owner_id', session.user.id)
            .maybeSingle(); 

          if (premiseError && premiseError.code !== 'PGRST116') {
            console.error('Error fetching premise:', premiseError.message);
            setError('Error checking premise information.');
            return;
          }

          if (premiseData) {
            // Both profile and premise exist, redirect to dashboard
            router.push('/dashboard'); // This will be handled by middleware to /dashboard/premise if needed
            return;
          }
        }
      }
    };
    fetchUser();
  }, [supabase, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }

    // 1. Create user_profile if it doesn't exist
    const { data: existingProfile, error: fetchProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchProfileError && fetchProfileError.code !== 'PGRST116') { 
      setError(`Error checking profile: ${fetchProfileError.message}`);
      setLoading(false);
      return;
    }

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          full_name: fullName,
          phone_number: phone,
        }]);

      if (profileError) {
        setError(`Error creating profile: ${profileError.message}`);
        setLoading(false);
        return;
      }
    }

    // 2. Create premise
    const { error: premiseError } = await supabase
      .from('premises')
      .insert([{
        business_name: businessName,
        category: category,
        phone: phone,
        email: user.email!, 
        contact_person: fullName,
        county: county,
        address: address,
        owner_id: user.id,
      }])
      .select();

    if (premiseError) {
      setError(`Error creating premise: ${premiseError.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/dashboard/premise'); // Redirect to the specific premise dashboard
    router.refresh(); 
  };

  if (userEmail === undefined) {
    return <div>Loading...</div>; // Or some other loading indicator
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-100">
      <div className="p-8 bg-white shadow-md rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Complete Your Profile</h2>
        <p className="text-center text-gray-600 mb-4">Welcome, {userEmail}! Please complete your profile.</p>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
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
          <div>
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
          <div>
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
          <div>
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
          <div>
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
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete Profile & Create Premise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
