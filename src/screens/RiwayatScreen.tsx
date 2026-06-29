import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bike, Car, Bus, Navigation, Leaf, Map } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LABEL_BBM, MODA_UMUM_LABEL } from '../lib/emisi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';


type Trip = {
  id: string;
  jenis: string;
  bbm: string;
  jarak_km: number;
  emisi_kg: number;
  emisi_dihemat: number;
  poin_didapat: number;
  created_at: string;
};

type FilterJenis = 'semua' | 'kendaraan' | 'umum';

function getIcon(jenis: string) {
  if (jenis === 'motor') return <Bike color="#6B7280" size={20} />;
  if (jenis === 'mobil') return <Car color="#6B7280" size={20} />;
  return <Bus color="#1D9E75" size={20} />;
}

function getLabel(jenis: string) {
  if (jenis === 'motor') return 'Motor Pribadi';
  if (jenis === 'mobil') return 'Mobil Pribadi';
  return 'Trans. Umum';
}

function getBbmLabel(trip: Trip) {
  return LABEL_BBM[trip.bbm] ?? MODA_UMUM_LABEL[trip.bbm] ?? trip.bbm;
}

export default function RiwayatScreen({ navigation }: any) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterJenis>('semua');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Animated Header Setup
  const HEADER_HEIGHT = 90;
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const diffClamp = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  useEffect(() => {
    if (user) {
      fetchTrips();
    }
  }, [user]);

  const fetchTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trips:', error);
    } else {
      setTrips(data as Trip[]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return trips.filter(t => {
      if (filter === 'kendaraan') return t.jenis === 'motor' || t.jenis === 'mobil';
      if (filter === 'umum') return t.jenis === 'transportasi_umum';
      return true;
    });
  }, [trips, filter]);

  const totalJarak = filtered.reduce((s, t) => s + t.jarak_km, 0);
  const totalEmisi = filtered.reduce((s, t) => s + t.emisi_kg, 0);
  const totalDihemat = filtered.reduce((s, t) => s + t.emisi_dihemat, 0);

  return (
    <View style={styles.container}>
      <Animated.View style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 30,
        height: HEADER_HEIGHT,
        opacity: headerOpacity
      }}>
        <View style={{ flex: 1, paddingHorizontal: 16, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backBtn}>← Kembali</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.topbarTitle}>Riwayat Perjalanan</Text>
              <Text style={styles.topbarSub}>Total {trips.length} trip tercatat</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + HEADER_HEIGHT - 25, paddingBottom: 100 + insets.bottom, minHeight: Dimensions.get('window').height + HEADER_HEIGHT }}
      >

        {/* Filter */}
        <View style={styles.filterRow}>
          {([
            { val: 'semua', label: 'Semua' },
            { val: 'kendaraan', label: 'Kendaraan' },
            { val: 'umum', label: 'Trans. Umum' },
          ] as { val: FilterJenis; label: string }[]).map(f => (
            <TouchableOpacity key={f.val} style={[styles.filterBtn, filter === f.val && styles.filterBtnActive]} onPress={() => setFilter(f.val)}>
              <Text style={[styles.filterText, filter === f.val && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Trip', val: `${filtered.length}`, color: '#374151' },
            { label: 'Jarak', val: `${totalJarak.toFixed(1)} km`, color: '#D97706' },
            { label: 'Emisi', val: `${totalEmisi.toFixed(2)} kg`, color: '#EF4444' },
            { label: 'Dihemat', val: `${totalDihemat.toFixed(2)} kg`, color: '#1D9E75' },
          ].map((s, i) => (
            <View key={i} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{s.label}</Text>
              <Text style={[styles.summaryValue, { color: s.color }]}>{s.val}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1D9E75" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Map color="#D1D5DB" size={48} />
            <Text style={styles.emptyTitle}>Belum ada perjalanan</Text>
            <Text style={styles.emptySub}>Mulai catat perjalananmu untuk melihat dampak emisi</Text>
          </View>
        ) : (
          /* Trip list */
          filtered.map(trip => (
            <View key={trip.id} style={styles.tripRow}>
              <View style={styles.tripIconWrap}>{getIcon(trip.jenis)}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>{getLabel(trip.jenis)} — {getBbmLabel(trip)}</Text>
                <Text style={styles.tripTime}>{trip.jarak_km} km · {new Date(trip.created_at).toLocaleDateString('id-ID')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.badge, { backgroundColor: trip.jenis === 'transportasi_umum' ? '#E1F5EE' : '#FEF2F2' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: trip.jenis === 'transportasi_umum' ? '#065F46' : '#DC2626' }}>
                    {trip.emisi_kg.toFixed(3)} kg CO₂
                  </Text>
                </View>
                {trip.emisi_dihemat > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#E1F5EE' }]}>
                    <Leaf color="#1D9E75" size={10} />
                    <Text style={{ fontSize: 10, fontWeight: '500', color: '#1D9E75' }}>
                      Hemat {trip.emisi_dihemat.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: '#D97706' }}>+{trip.poin_didapat} poin</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </Animated.ScrollView>

      {/* Dynamic Status Bar Overlay with translateY for native driver support */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -(HEADER_HEIGHT),
          left: 0,
          right: 0,
          height: insets.top + (HEADER_HEIGHT * 1.6),
          zIndex: 20,
          transform: [{
            translateY: diffClamp.interpolate({
              inputRange: [0, HEADER_HEIGHT],
              outputRange: [0, -((HEADER_HEIGHT * 0.6) - 15)],
              extrapolate: 'clamp',
            })
          }],
        }}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.7, 0.9, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  backBtn: { fontSize: 13, color: '#1D9E75', fontWeight: 'bold' },
  topbarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  topbarSub: { fontSize: 13, color: '#6B7280' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#1D9E75' },
  filterText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filterTextActive: { color: 'white' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  summaryLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '600' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  tripIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  tripTitle: { fontSize: 13, fontWeight: '500', color: '#374151' },
  tripTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#4B5563', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
