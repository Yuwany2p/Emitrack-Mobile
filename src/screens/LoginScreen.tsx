import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Svg, { Path } from 'react-native-svg';

const { height: windowHeight } = Dimensions.get('window');

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
      {/* Top Half: White Background with Logo */}
      <View style={styles.topSection}>
        <Image
          source={require('../../assets/EmiTrackLogo2.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* Bottom Half: Green Background with Login Content */}
      <View style={styles.bottomSection}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15594B',
  },
  topSection: {
    height: windowHeight * 0.45,
    backgroundColor: 'white',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: '95%',
    height: 160,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#15594B',
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 40,
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
    fontWeight: '700',
    color: '#374151',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 24,
    lineHeight: 18,
  },
});
