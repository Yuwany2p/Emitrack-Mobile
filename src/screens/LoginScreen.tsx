import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Leaf, Trophy } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          {/* <Leaf color="white" size={36} strokeWidth={2} />/ */}
        </View>
        <Text style={styles.appName}>EmiTrack</Text>
        <Text style={styles.tagline}>Jejak Emisi, Aksi Nyata</Text>

        <View style={styles.badge}>
          <Trophy color="#FAC775" size={12} strokeWidth={2} />
          <Text style={styles.badgeText}>NIC 2026</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Masuk ke EmiTrack</Text>
        <Text style={styles.subtitle}>Mulai lacak jejak karbon kamu hari ini</Text>

        {/* Google Sign In Button */}
        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#374151" size="small" />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <Path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <Path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <Path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </Svg>
          )}
          <Text style={styles.googleBtnText}>
            {loading ? 'Memproses...' : 'Masuk dengan Google'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Dengan masuk, kamu menyetujui penggunaan data{'\n'}untuk tujuan lingkungan
        </Text>
      </View>

      {/* Bottom Features */}
      <View style={styles.features}>
        {['Mendukung SDG 11', 'Data aman', 'Gratis selamanya'].map((text) => (
          <View key={text} style={styles.featureItem}>
            <View style={styles.featureCheck}>
              <Text style={styles.featureCheckText}>✓</Text>
            </View>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15594B',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 14,
    color: '#9FE1CB',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(250,199,117,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250,199,117,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FAC775',
    letterSpacing: 0.5,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
    textAlign: 'center',
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  googleBtnDisabled: {
    opacity: 0.7,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 20,
    lineHeight: 17,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(29,158,117,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCheckText: {
    fontSize: 8,
    color: '#1D9E75',
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
});
