import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Alert, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bike, Car, Train, Bus, Check, Calculator, Leaf, Coins, Trophy, BarChart2, Droplets, TreePine, Plane, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { hitungEmisi, RATA_RATA_NASIONAL, BBM_OPTIONS, LABEL_BBM, CONTOH_MEREK, KONSUMSI } from '../lib/emisi';
import { getLevelByPoin } from '../lib/level';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const TRANSPORTASI = [
  { value: 'motor', label: 'Motor', icon: Bike, poin: 10, isPrivate: true },
  { value: 'mobil', label: 'Mobil', icon: Car, poin: 10, isPrivate: true },
  { value: 'sepeda', label: 'Sepeda', icon: Bike, poin: 80, isPrivate: false, emisiPerKm: 0 },
  { value: 'krl', label: 'Kereta', icon: Train, poin: 40, isPrivate: false, emisiPerKm: 0.001 },
  { value: 'transjakarta', label: 'Bus', icon: Bus, poin: 50, isPrivate: false, emisiPerKm: 0.038 },
];

const HARGA_BBM_DEFAULT: Record<string, number> = {
  ron90: 10000,
  ron92: 13000,
  ron95: 15000,
  ron98: 16500,
  diesel48: 6800,
  diesel51: 14500,
  diesel53: 15500,
  listrik: 2500,
};

export default function KalkulatorScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'hitung' | 'proyeksi'>('hitung');
  const [jenis, setJenis] = useState('');
  const [bbm, setBbm] = useState('');
  const [jarakText, setJarakText] = useState('');
  const [jarakHarian, setJarakHarian] = useState('');
  const [hariPerMinggu, setHariPerMinggu] = useState('');
  const [showResultHitung, setShowResultHitung] = useState(false);
  const [showResultProyeksi, setShowResultProyeksi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const autoFill = route?.params?.autoFill;
  const autoModa = route?.params?.autoModa;
  const autoJarak = route?.params?.autoJarak;
  const tripContext = route?.params?.tripContext;

  React.useEffect(() => {
    if (autoFill && autoModa && autoJarak) {
      setJenis(autoModa);
      setJarakText(String(autoJarak));
      setActiveTab('hitung');
      setShowResultHitung(true);
    }
  }, [autoFill, autoModa, autoJarak]);

  // Animated Header Setup
  const HEADER_HEIGHT = 90;
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const diffClamp = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const jarak = Number(jarakText) || 0;
  const selectedModa = TRANSPORTASI.find(t => t.value === jenis);

  const emisiHarian = selectedModa?.isPrivate
    ? hitungEmisi(jenis, bbm, jarak)
    : Number((jarak * (selectedModa?.emisiPerKm ?? 0)).toFixed(3));

  const emisiBulanan = Number((emisiHarian * 22).toFixed(1));
  const emisiTahunan = Number((emisiHarian * 264).toFixed(0));
  const vsRataRata = Number(((emisiHarian / RATA_RATA_NASIONAL) * 100).toFixed(0));

  const hariMggNum = Number(hariPerMinggu) || 5;
  const jarakHarianNum = Number(jarakHarian) || 20;
  const hariSetahun = Math.round((hariMggNum / 7) * 365);
  const emisiHariProyeksi = hitungEmisi(jenis, bbm, jarakHarianNum);
  const emisiTahunProyeksi = Number((emisiHariProyeksi * hariSetahun).toFixed(1));

  const konsumsiKey = `${jenis}_${bbm}`;
  const konsumsiPerKm = KONSUMSI[konsumsiKey as keyof typeof KONSUMSI] ?? 0.1;
  const konsumsiLiterTahun = Number((jarakHarianNum * konsumsiPerKm * hariSetahun).toFixed(0));
  const biayaBbmTahun = konsumsiLiterTahun * (HARGA_BBM_DEFAULT[bbm] ?? 13000);

  const pohon = Math.round(emisiTahunProyeksi / 21);
  const airLiter = Math.round(emisiTahunProyeksi / 0.5);
  const jamTerbang = Number((emisiTahunProyeksi / 90).toFixed(1));

  const saveAutoTrip = async () => {
    if (!user || !jenis) return;
    if (selectedModa?.isPrivate && !bbm) {
      showToast('Mohon pilih bahan bakar kendaraan Anda', 'warning');
      return;
    }
    
    setIsSaving(true);
    const dbBbm = selectedModa?.isPrivate ? bbm : (jenis === 'sepeda' ? 'sepeda' : (jenis === 'krl' ? 'krl' : 'transjakarta'));
    
    // Recalculate emission if private vehicle to account for the chosen BBM, else use base
    const finalEmisi = selectedModa?.isPrivate ? Number(emisiHarian.toFixed(3)) : tripContext?.emisiBase;
    const finalHemat = tripContext?.hematBase || 0;
    const finalPoin = tripContext?.poinBase || 0;
    
    const { error } = await supabase.from('trips').insert({
      user_id: user.id,
      jenis: jenis,
      bbm: dbBbm,
      jarak_km: Number(autoJarak),
      emisi_kg: finalEmisi,
      emisi_dihemat: finalHemat,
      poin_didapat: finalPoin,
    });

    if (error) {
      showToast('Gagal menyimpan: ' + error.message, 'warning');
      setIsSaving(false);
      return;
    }

    // Update Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      await supabase.from('profiles').update({
        total_poin: (profile.total_poin || 0) + finalPoin,
        total_hemat: Number(((profile.total_hemat || 0) + finalHemat).toFixed(2)),
      }).eq('id', user.id);
    }

    showToast(`Perjalanan Hijau Disimpan! +${finalPoin} Poin`, 'success', 3000, 'top');
    setIsSaving(false);

    // Redirect back to Map with triggerShare
    navigation.navigate('Peta', {
      triggerShare: true,
      savedTripData: {
        jarak: Number(autoJarak),
        emisiHemat: finalHemat,
        poin: finalPoin,
        jenis: jenis,
        bbm: dbBbm,
        modaLengkap: selectedModa?.label,
        date: tripContext?.date || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Animated Header */}
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <ArrowLeft color="#1F2937" size={24} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.topbarTitle}>Kalkulator Emisi</Text>
              <Text style={styles.topbarSub}>Kalkulasi jejak emisi harian & tahunanmu</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + HEADER_HEIGHT - 5, paddingBottom: 100 + insets.bottom, minHeight: Dimensions.get('window').height + HEADER_HEIGHT }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >

        <View style={[styles.tabContainer]}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'hitung' && styles.tabBtnActive]} onPress={() => setActiveTab('hitung')} disabled={autoFill}>
            <Calculator color={activeTab === 'hitung' ? '#1D9E75' : '#6B7280'} size={16} />
            <Text style={[styles.tabText, activeTab === 'hitung' && styles.tabTextActive]}>Emisi Harian</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'proyeksi' && styles.tabBtnActive]} onPress={() => setActiveTab('proyeksi')} disabled={autoFill}>
            <BarChart2 color={activeTab === 'proyeksi' ? '#1D9E75' : '#6B7280'} size={16} />
            <Text style={[styles.tabText, activeTab === 'proyeksi' && styles.tabTextActive]}>Emisi Tahunan</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, autoFill && { opacity: 0.7 }]}>
          <Text style={styles.cardTitle}>Moda Transportasi {autoFill && '(Otomatis)'}</Text>
          <View style={styles.modaGrid}>
            {TRANSPORTASI.map(t => {
              const Icon = t.icon;
              return (
                <TouchableOpacity key={t.value} style={[styles.modaBtn, jenis === t.value && styles.modaBtnActive]} onPress={() => { setJenis(t.value); setBbm(''); }} disabled={autoFill}>
                  <Icon color={jenis === t.value ? 'white' : '#6B7280'} size={16} />
                  <Text style={[styles.modaText, jenis === t.value && styles.modaTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedModa?.isPrivate && (
          <View style={[styles.card]}>
            <Text style={styles.cardTitle}>Bahan Bakar</Text>
            <View style={styles.modaGrid}>
              {BBM_OPTIONS[jenis]?.map(b => (
                <TouchableOpacity key={b} style={[styles.modaBtn, bbm === b && styles.modaBtnActive]} onPress={() => setBbm(b)}>
                  <Text style={[styles.modaText, bbm === b && styles.modaTextActive]}>{LABEL_BBM[b]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'hitung' ? (
          <>
            <View style={[styles.card, autoFill && { opacity: 0.7 }]}>
              <Text style={styles.cardTitle}>Jarak Tempuh {autoFill ? 'Aktual' : 'Harian'} (km) {autoFill && '(Otomatis)'}</Text>
              <TextInput value={jarakText} onChangeText={setJarakText} keyboardType="numeric" style={styles.input} editable={!autoFill} />
            </View>
            {showResultHitung && (
              <View style={styles.resultCard}>
                <Text style={styles.cardTitle}>Hasil Estimasi CO₂</Text>
                <View style={styles.modaGrid}>
                  {[{ label: 'Harian', val: emisiHarian, color: '#D97706' }, { label: 'Bulanan', val: emisiBulanan, color: '#1D9E75' }, { label: 'Tahunan', val: emisiTahunan, color: '#EF4444' }].map(s => (
                    <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: s.color }}>{s.val}</Text>
                      <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{s.label} (kg)</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.compareBox, { marginTop: 10 }]}>
                  <Text style={styles.compareText}>{vsRataRata <= 100 ? `✓ Emisi kamu ${100 - vsRataRata}% di bawah rata-rata nasional. Bagus!` : `⚠️ Emisi kamu ${vsRataRata - 100}% di atas rata-rata nasional.`}</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={[styles.card]}>
              <Text style={styles.cardTitle}>Jarak Harian (km)</Text>
              <TextInput value={jarakHarian} onChangeText={setJarakHarian} keyboardType="numeric" style={styles.input} />
            </View>
            <View style={[styles.card]}>
              <Text style={styles.cardTitle}>Hari per Minggu</Text>
              <TextInput value={hariPerMinggu} onChangeText={setHariPerMinggu} keyboardType="numeric" style={styles.input} />
            </View>
            {showResultProyeksi && (
              <>
                <Text style={[styles.cardTitle, { marginTop: 10 }]}>Dampak Setahun Penuh</Text>
                <View style={[styles.modaGrid]}>
                  <View style={[styles.resultCard, { flex: 1 }]}>
                    <Text style={{ fontWeight: 'bold', color: '#EF4444', fontSize: 18 }}>{emisiTahunProyeksi}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>kg CO₂</Text>
                  </View>
                  <View style={[styles.resultCard, { flex: 1 }]}>
                    <Text style={{ fontWeight: 'bold', color: '#2563EB', fontSize: 18 }}>{biayaBbmTahun >= 1000000 ? `${(biayaBbmTahun / 1000000).toFixed(1)} jt` : `${Math.round(biayaBbmTahun / 1000)} rb`}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Biaya BBM</Text>
                  </View>
                </View>
                <View style={[styles.resultCard, { marginTop: 12 }]}>
                  <View style={styles.modaGrid}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <TreePine color="#1D9E75" size={24} />
                      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Setara {pohon} pohon</Text>
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Droplets color="#3B82F6" size={24} />
                      <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Serapan {Math.round(airLiter / 1000)}k L air</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {autoFill ? (
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: '#1D9E75', borderWidth: 1, borderColor: '#047857', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }]} 
              onPress={saveAutoTrip}
              disabled={isSaving}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{isSaving ? 'Menyimpan...' : 'Selesai & Simpan'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }]} onPress={() => {
              setJenis('');
              setBbm('');
              setJarakText('');
              setJarakHarian('');
              setHariPerMinggu('');
              setShowResultHitung(false);
              setShowResultProyeksi(false);
            }}>
              <Text style={{ color: '#4B5563', fontWeight: '600' }}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, { flex: 1, borderWidth: 1, borderColor: '#047857', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }]} onPress={() => {
              if (activeTab === 'hitung') {
                if (!jenis || (selectedModa?.isPrivate && !bbm) || !jarakText) {
                  showToast('Mohon lengkapi semua data', 'warning');
                  return;
                }
                setShowResultHitung(true);
              } else {
                if (!jenis || (selectedModa?.isPrivate && !bbm) || !jarakHarian || !hariPerMinggu) {
                  showToast('Mohon lengkapi semua data', 'warning');
                  return;
                }
                setShowResultProyeksi(true);
              }
            }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Hitung</Text>
            </TouchableOpacity>
          </View>
        )}
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
  tabContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  tabBtnActive: { backgroundColor: '#E1F5EE', borderColor: '#1D9E75' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#1D9E75' },
  scrollContent: { paddingBottom: 100, paddingHorizontal: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  modaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F9FAFB' },
  modaBtnActive: { backgroundColor: '#1D9E75' },
  modaText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  modaTextActive: { color: 'white' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#374151', fontWeight: '500' },
  resultCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  compareBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  compareText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  saveBtn: { backgroundColor: '#1D9E75', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#9FE1CB' },
  saveBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
