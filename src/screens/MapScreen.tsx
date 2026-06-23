import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Play, Square, Save, X, Bike, Car, Train, Bus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { hitungJarakKumulatif } from '../lib/gps';
import { hitungEmisi, RATA_RATA_NASIONAL, BBM_OPTIONS } from '../lib/emisi';
import { showToast } from '../components/Toast';
import { getLevelByPoin } from '../lib/level';

export default function MapScreen({ navigation }: any) {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [path, setPath] = useState<{latitude: number, longitude: number}[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);

  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [jenis, setJenis] = useState('motor');
  const [bbm, setBbm] = useState('ron92');
  const [isSaving, setIsSaving] = useState(false);
  
  const mapRef = useRef<MapView>(null);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin ditolak', 'Akses lokasi dibutuhkan untuk tracking.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();

    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }
    };
  }, []);

  // Distance calculated from path using gps.ts

  const startNavigation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    setPath([]);
    setDistanceKm(0);
    setIsNavigating(true);

    watchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        setLocation(loc);
        setPath(prevPath => {
          const newPath = [...prevPath, { latitude: loc.coords.latitude, longitude: loc.coords.longitude }];
          setDistanceKm(hitungJarakKumulatif(newPath));
          return newPath;
        });
      }
    );
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
    
    if (distanceKm > 0.1) {
      setShowSaveModal(true);
    } else {
      showToast('Jarak terlalu pendek untuk disimpan.', 'info');
      setPath([]);
      setDistanceKm(0);
    }
  };

  const saveTrip = async () => {
    if (!user) return;
    setIsSaving(true);

    const isPrivate = ['motor', 'mobil'].includes(jenis);
    const emisiHarian = isPrivate ? hitungEmisi(jenis, bbm, distanceKm) : distanceKm * (jenis === 'krl' ? 0.001 : 0.038);
    const poinModa = jenis === 'motor' || jenis === 'mobil' ? 10 : jenis === 'sepeda' ? 80 : 50;

    let emisiDihemat = 0;
    let dbJenis = jenis;
    let dbBbm = bbm;

    if (isPrivate) {
      emisiDihemat = Math.max(0, Number((RATA_RATA_NASIONAL - emisiHarian).toFixed(3)));
    } else {
      const emisiMotorBaseline = hitungEmisi('motor', 'ron92', distanceKm);
      emisiDihemat = Number((emisiMotorBaseline - emisiHarian).toFixed(3));
      dbJenis = 'transportasi_umum';
      dbBbm = jenis;
    }

    const { error } = await supabase.from('trips').insert({
      user_id: user.id,
      jenis: dbJenis,
      bbm: dbBbm,
      jarak_km: Number(distanceKm.toFixed(2)),
      emisi_kg: Number(emisiHarian.toFixed(3)),
      emisi_dihemat: emisiDihemat,
      poin_didapat: poinModa,
    });

    if (error) {
      showToast(error.message, 'warning');
      setIsSaving(false);
      return;
    }

    // Update Profile Stats
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      await supabase.from('profiles').update({
        total_poin: profile.total_poin + poinModa,
        total_hemat: profile.total_hemat + emisiDihemat,
      }).eq('id', user.id);
    }

    showToast(`Tersimpan! +${poinModa} poin`, 'success');
    setIsSaving(false);
    setShowSaveModal(false);
    setPath([]);
    setDistanceKm(0);
    navigation.navigate('Dashboard');
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView 
        ref={mapRef}
        style={styles.map} 
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : undefined}
      >
        {path.length > 0 && (
          <Polyline coordinates={path} strokeColor="#1D9E75" strokeWidth={5} />
        )}
      </MapView>

      {/* Floating Panel / Bottom Sheet */}
      <View style={styles.bottomPanel}>
        <View style={styles.headerPanel}>
          <Text style={styles.title}>EmiTrack Live</Text>
          <Text style={styles.subtitle}>
            {isNavigating ? 'Sedang melacak rute Anda...' : 'Siap memulai perjalanan ramah lingkungan?'}
          </Text>
        </View>

        {isNavigating && (
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Jarak</Text>
              <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={[styles.statValue, {color: '#1D9E75'}]}>Aktif</Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, isNavigating ? styles.buttonStop : styles.buttonStart]} 
          onPress={isNavigating ? stopNavigation : startNavigation}
        >
          {isNavigating ? <Square color="white" size={20} /> : <Play color="white" size={20} fill="white" />}
          <Text style={styles.buttonText}>
            {isNavigating ? 'Akhiri Perjalanan' : 'Mulai Navigasi'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Save Modal */}
      <Modal visible={showSaveModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Simpan Perjalanan</Text>
              <TouchableOpacity onPress={() => setShowSaveModal(false)}>
                <X color="#9CA3AF" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalStats}>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatLabel}>Jarak Ditempuh</Text>
                <Text style={styles.modalStatValue}>{distanceKm.toFixed(2)} km</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Kendaraan yang digunakan</Text>
            <View style={styles.kendaraanRow}>
              {[
                { id: 'motor', icon: Bike, label: 'Motor' },
                { id: 'mobil', icon: Car, label: 'Mobil' },
                { id: 'transjakarta', icon: Bus, label: 'Bus' },
              ].map(k => {
                const Icon = k.icon;
                return (
                  <TouchableOpacity 
                    key={k.id} 
                    style={[styles.kendaraanBtn, jenis === k.id && styles.kendaraanBtnActive]}
                    onPress={() => setJenis(k.id)}
                  >
                    <Icon color={jenis === k.id ? '#1D9E75' : '#6B7280'} size={20} />
                    <Text style={[styles.kendaraanText, jenis === k.id && { color: '#1D9E75' }]}>{k.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {['motor', 'mobil'].includes(jenis) && (
              <>
                <Text style={styles.inputLabel}>Bahan Bakar</Text>
                <View style={styles.bbmRow}>
                  {BBM_OPTIONS[jenis as 'motor'|'mobil'].slice(0, 4).map(b => (
                    <TouchableOpacity 
                      key={b} 
                      style={[styles.bbmBtn, bbm === b && styles.bbmBtnActive]}
                      onPress={() => setBbm(b)}
                    >
                      <Text style={[styles.bbmText, bbm === b && { color: 'white' }]}>{b.replace('ron', 'RON ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity 
              style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
              onPress={saveTrip}
              disabled={isSaving}
            >
              <Save color="white" size={20} />
              <Text style={styles.saveBtnText}>{isSaving ? 'Menyimpan...' : 'Simpan Perjalanan'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  headerPanel: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  buttonStart: {
    backgroundColor: '#1D9E75',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalStats: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D9E75',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  kendaraanRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kendaraanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  kendaraanBtnActive: {
    backgroundColor: '#E1F5EE',
    borderColor: '#1D9E75',
  },
  kendaraanText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  bbmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  bbmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  bbmBtnActive: {
    backgroundColor: '#1D9E75',
  },
  bbmText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  saveBtn: {
    backgroundColor: '#1D9E75',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
