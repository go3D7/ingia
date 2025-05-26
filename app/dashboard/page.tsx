```tsx
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
// Assuming you have this file. If not, you might need to create it or adjust the import.
// import { Database } from '@/lib/database.types'; 

// If Database types are not set up yet, you can use a generic SupabaseClient
// import { SupabaseClient } from '@supabase/supabase-js';
// const supabase = createClientComponentClient<Database>(); // Use this if Database types are set up
const supabase = createClientComponentClient(); // Use this if Database types are not set up


export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUserAndProfile = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push('/login'); // Redirect if not authenticated
        return;
      }
      setUser(session.user);

      // Check if the user has a profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle(); // Use maybeSingle to handle no profile gracefully

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116: no rows found, which is okay here
        console.error('Error checking profile:', profileError.message);
        setLoading(false);
        // Optionally, display an error message to the user or redirect to an error page
        return;
      }

      if (!profileData) {
        router.push('/auth/complete-profile');
        return;
      }

      // Check if the user has a premise
      const { data: premiseData, error: premiseError } = await supabase
        .from('premises')
        .select('id')
        .eq('owner_id', session.user.id)
        .maybeSingle(); 

      if (premiseError && premiseError.code !== 'PGRST116') {
        console.error('Error fetching premise:', premiseError.message);
        setLoading(false);
        // Optionally, display an error message to the user
        return;
      }

      if (!premiseData) {
        router.push('/auth/complete-profile');
      } else {
        router.push('/dashboard/premise');
      }
    };

    checkUserAndProfile();
  }, [supabase, router]); // Removed isLoading from dependencies as it's managed internally now

  // Display loading state while checks are in progress
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // This content will likely not be shown for long due to redirects, 
  // but it's good practice to have a fallback or a brief message.
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Your Dashboard</h1>
      <p>Redirecting you shortly...</p>
    </div>
  );
}
```
