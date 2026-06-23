import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Bike, Car, Train, Bus, Check, Calculator, Leaf, Coins, Trophy, BarChart2, Droplets, TreePine, Plane } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { hitungEmisi, RATA_RATA_NASIONAL, BBM_OPTIONS, LABEL_BBM, CONTOH_MEREK, KONSUMSI } from '../lib/emisi';
import { getLevelByPoin } from '../lib/level';
import { showToast } from '../components/Toast';

const TRANSPORTASI = [
  { value: 'motor', label: 'Motor', icon: Bike, poin: 10, isPrivate: true },
  { value: 'mobil', label: 'Mobil', icon: Car, poin: 10, isPrivate: true },
  { value: 'sepeda', label: 'Sepeda', icon: Bike, poin: 80, isPrivate: false, emisiPerKm: 0 },
  { value: 'krl', label: 'KRL', icon: Train, poin: 40, isPrivate: false, emisiPerKm: 0.001 },
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

export default function KalkulatorScreen({ navigation }: any) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'hitung' | 'proyeksi'>('hitung');
  const [jenis, setJenis] = useState('motor');
  const [bbm, setBbm] = useState('ron92');
  const [jarakText, setJarakText] = useState('20');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const jarak = Number(jarakText) || 0;
  const selectedModa = TRANSPORTASI.find(t => t.value === jenis)!;

  const emisiHarian = selectedModa.isPrivate
    ? hitungEmisi(jenis, bbm, jarak)
    : Number((jarak * (selectedModa.emisiPerKm ?? 0)).toFixed(3));

  const emisiBulanan = Number((emisiHarian * 22).toFixed(1));
  const emisiTahunan = Number((emisiHarian * 264).toFixed(0));
  const vsRataRata = Number(((emisiHarian / RATA_RATA_NASIONAL) * 100).toFixed(0));

  const [jarakHarian, setJarakHarian] = useState('20');
  const [hariPerMinggu, setHariPerMinggu] = useState('5');

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

  async function simpanTrip() {
    if (!user) return;
    setSaving(true);
    const emisiDihemat = selectedModa.isPrivate
      ? Math.max(0, Number((RATA_RATA_NASIONAL - emisiHarian).toFixed(3)))
      : Number((hitungEmisi('motor', 'ron92', jarak) - emisiHarian).toFixed(3));

    const { error } = await supabase.from('trips').insert({
      user_id: user.id,
      jenis: selectedModa.isPrivate ? jenis : 'transportasi_umum',
      bbm: selectedModa.isPrivate ? bbm : jenis,
      jarak_km: jarak,
      emisi_kg: emisiHarian,
      emisi_dihemat: emisiDihemat,
      poin_didapat: selectedModa.poin,
    });

    if (error) {
      showToast(error.message, 'warning');
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    showToast(`Tersimpan! +${selectedModa.poin} poin`, 'success');
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Kembali</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.topbarTitle}>Kalkulator Emisi</Text>
          <Text style={styles.topbarSub}>Berdasarkan IPCC 2021 & ESDM RI</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'hitung' && styles.tabBtnActive]} onPress={() => setActiveTab('hitung')}>
          <Calculator color={activeTab === 'hitung' ? '#1D9E75' : '#6B7280'} size={16} />
          <Text style={[styles.tabText, activeTab === 'hitung' && styles.tabTextActive]}>Hitung Emisi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'proyeksi' && styles.tabBtnActive]} onPress={() => setActiveTab('proyeksi')}>
          <BarChart2 color={activeTab === 'proyeksi' ? '#1D9E75' : '#6B7280'} size={16} />
          <Text style={[styles.tabText, activeTab === 'proyeksi' && styles.tabTextActive]}>Proyeksi Tahunan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Moda Transportasi</Text>
          <View style={styles.modaGrid}>
            {TRANSPORTASI.map(t => {
              const Icon = t.icon;
              return (
                <TouchableOpacity key={t.value} style={[styles.modaBtn, jenis === t.value && styles.modaBtnActive]} onPress={() => { setJenis(t.value); setBbm('ron92'); }}>
                  <Icon color={jenis === t.value ? 'white' : '#6B7280'} size={16} />
                  <Text style={[styles.modaText, jenis === t.value && styles.modaTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedModa.isPrivate && (
          <View style={styles.card}>
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
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Jarak Tempuh Harian (km)</Text>
              <TextInput value={jarakText} onChangeText={setJarakText} keyboardType="numeric" style={styles.input} />
            </View>
            <View style={styles.resultCard}>
              <Text style={styles.cardTitle}>Hasil Estimasi CO₂</Text>
              <View style={styles.modaGrid}>
                {[ { label: 'Harian', val: emisiHarian, color: '#D97706' }, { label: 'Bulanan', val: emisiBulanan, color: '#1D9E75' }, { label: 'Tahunan', val: emisiTahunan, color: '#EF4444' } ].map(s => (
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
            <TouchableOpacity style={styles.saveBtn} onPress={simpanTrip} disabled={saving || saved}>
              <Text style={{ color: 'white', fontWeight: '600' }}>{saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : `Simpan Perjalanan (+${selectedModa.poin} poin)`}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Jarak Harian (km)</Text>
              <TextInput value={jarakHarian} onChangeText={setJarakHarian} keyboardType="numeric" style={styles.input} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hari per Minggu</Text>
              <TextInput value={hariPerMinggu} onChangeText={setHariPerMinggu} keyboardType="numeric" style={styles.input} />
            </View>
            <Text style={[styles.cardTitle, { marginTop: 10 }]}>Dampak Setahun Penuh</Text>
            <View style={styles.modaGrid}>
              <View style={[styles.resultCard, { flex: 1 }]}>
                <Text style={{ fontWeight: 'bold', color: '#EF4444' }}>{emisiTahunProyeksi}</Text>
                <Text style={{ fontSize: 10 }}>kg CO₂</Text>
              </View>
              <View style={[styles.resultCard, { flex: 1 }]}>
                <Text style={{ fontWeight: 'bold', color: '#2563EB' }}>{biayaBbmTahun >= 1000000 ? `${(biayaBbmTahun/1000000).toFixed(1)} jt` : `${Math.round(biayaBbmTahun/1000)} rb`}</Text>
                <Text style={{ fontSize: 10 }}>Biaya BBM</Text>
              </View>
            </View>
            <View style={styles.resultCard}>
              <View style={styles.modaGrid}>
                <View style={{ alignItems: 'center', flex: 1 }}><TreePine color="#1D9E75" /><Text style={{ fontSize: 10 }}>{pohon} pohon</Text></View>
                <View style={{ alignItems: 'center', flex: 1 }}><Droplets color="#3B82F6" /><Text style={{ fontSize: 10 }}>{Math.round(airLiter/1000)}k L air</Text></View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },
  topbarTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  topbarSub: { fontSize: 12, color: '#9CA3AF' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#1D9E75' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#1D9E75', fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  modaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F9FAFB' },
  modaBtnActive: { backgroundColor: '#1D9E75' },
  modaText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  modaTextActive: { color: 'white' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#374151', fontWeight: '500' },
  resultCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', marginTop: 8 },
  compareBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  compareText: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  saveBtn: { backgroundColor: '#1D9E75', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#9FE1CB' },
  saveBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
