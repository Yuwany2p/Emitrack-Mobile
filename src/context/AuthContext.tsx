import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Required for expo-auth-session to work on Android
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session (restored from SecureStore automatically)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const u = session.user;
          const name =
            u.user_metadata?.full_name ??
            u.user_metadata?.name ??
            u.email?.split('@')[0] ??
            null;
          ensureProfile(u.id, name);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function ensureProfile(userId: string, name?: string | null) {
    await supabase.from('profiles').upsert(
      { id: userId, username: name ?? null, kota: 'Unknown' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  const signInWithGoogle = async () => {
    try {
      // Generate PKCE code verifier and challenge for security
      const codeVerifier = Crypto.randomUUID();
      const codeChallenge = codeVerifier; // Supabase uses plain method

      const redirectUrl = makeRedirectUri({ scheme: 'emitrack' });

      // Request OAuth URL from Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            code_challenge: codeChallenge,
            code_challenge_method: 'plain',
          },
        },
      });

      if (error) {
        showToast(error.message, 'warning');
        return;
      }

      if (!data?.url) {
        showToast('Gagal membuat URL login', 'warning');
        return;
      }

      // Open browser for Google login
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Extract the authorization code from redirect URL
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1)); // fragment
        const code = url.searchParams.get('code') ?? params.get('code');

        if (code) {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            showToast(exchangeError.message, 'warning');
          }
        } else {
          // Check if tokens are in the fragment (implicit flow)
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? '',
            });
          }
        }
      }
    } catch (err: any) {
      showToast('Login gagal: ' + (err?.message ?? 'Unknown error'), 'warning');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
