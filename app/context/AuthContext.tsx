```tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation'; // Corrected import

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClientComponentClient();
  const router = useRouter(); // useRouter should be called within the component body
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        // Check if profile and premise exist for the new user
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116: no rows found
          console.error('Error checking profile:', profileError.message);
          // Handle error, perhaps redirect to an error page
          return;
        }

        if (!profileData) {
          // New user or profile not completed, redirect to complete profile page
          router.push('/auth/complete-profile');
          return;
        }

        // Check if the user has a premise
        const { data: premise, error: premiseError } = await supabase
          .from('premises')
          .select('id')
          .eq('owner_id', session.user.id)
          .maybeSingle(); 

        if (premiseError && premiseError.code !== 'PGRST116') {
          console.error('Error checking premise:', premiseError.message);
          // Handle error
          return;
        }

        if (!premise) {
          // User has a profile but no premise, redirect to complete profile page
          router.push('/auth/complete-profile');
        } else {
          // User has profile and premise, redirect to dashboard
          router.push('/dashboard'); 
        }
      } else if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]); // Added router to dependencies

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```
