import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Info, Leaf, Car, TreePine as Trees, TrendingUp, AlertTriangle, Bus, Bike, Wind, Zap, Users, Target, BookOpen } from 'lucide-react-native';

const FAKTA = [
  { icon: Car, text: 'Kendaraan pribadi menyumbang 47% emisi CO₂ di sektor transportasi Indonesia.', source: 'Sumber: KLHK, 2022' },
  { icon: AlertTriangle, text: 'Jakarta konsisten masuk daftar kota dengan polusi udara terburuk dunia.', source: 'Sumber: IQAir, 2023' },
  { icon: Trees, text: '1 pohon dewasa rata-rata menyerap sekitar 21 kg CO₂ per tahun.', source: 'Fakta Lingkungan' },
  { icon: TrendingUp, text: 'Jumlah kendaraan Indonesia tumbuh 5-7% per tahun, sudah tembus lebih dari 150 juta unit.', source: 'Sumber: BPS, 2023' },
];

const TIPS = [
  { icon: Bus, title: 'Gunakan Transportasi Umum', desc: 'TransJakarta menghasilkan 96% lebih sedikit emisi dibanding mobil pribadi per penumpang.', color: '#2563EB', bg: '#EFF6FF' },
  { icon: Bike, title: 'Bersepeda untuk Jarak Dekat', desc: 'Perjalanan < 5 km? Bersepeda = 0 emisi CO₂ dan jauh lebih menyehatkan!', color: '#059669', bg: '#ECFDF5' },
  { icon: Wind, title: 'Jaga Tekanan Ban', desc: 'Ban kurang angin meningkatkan konsumsi BBM hingga 3%.', color: '#D97706', bg: '#FFFBEB' },
  { icon: Users, title: 'Carpooling', desc: 'Berbagi kendaraan efektif membagi jejak karbonmu.', color: '#7C3AED', bg: '#F5F3FF' },
  { icon: Zap, title: 'Kendaraan Listrik', desc: 'Motor listrik menghasilkan 63% lebih sedikit emisi dibanding bensin.', color: '#0891B2', bg: '#ECFEFF' },
];

export default function EdukasiScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BookOpen color="#1F2937" size={18} />
          <View>
            <Text style={styles.topbarTitle}>Edukasi & Tips</Text>
            <Text style={styles.topbarSub}>Pahami emisimu, ubah kebiasaanmu</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Tahukah Kamu */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info color="#1D9E75" size={18} />
          <Text style={styles.sectionTitle}>Tahukah Kamu?</Text>
        </View>
        {FAKTA.map((f, i) => {
          const Icon = f.icon;
          return (
            <View key={i} style={styles.faktaCard}>
              <View style={styles.faktaIcon}>
                <Icon color="#1D9E75" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.faktaText}>{f.text}</Text>
                <Text style={styles.faktaSource}>{f.source}</Text>
              </View>
            </View>
          );
        })}

        {/* Rumus */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 20 }}>
          <TrendingUp color="#6366F1" size={18} />
          <Text style={styles.sectionTitle}>Bagaimana Emisi Dihitung?</Text>
        </View>
        <View style={styles.rumusCard}>
          <View style={styles.rumusBox}>
            <Text style={styles.rumusText}>E = D × FE × FK</Text>
          </View>
          <View style={styles.rumusItem}>
            <View style={[styles.rumusTag, { backgroundColor: '#EEF2FF' }]}><Text style={[styles.rumusTagText, { color: '#4F46E5' }]}>D</Text></View>
            <Text style={styles.rumusDesc}>Jarak Tempuh (km)</Text>
          </View>
          <View style={styles.rumusItem}>
            <View style={[styles.rumusTag, { backgroundColor: '#FFFBEB' }]}><Text style={[styles.rumusTagText, { color: '#D97706' }]}>FE</Text></View>
            <Text style={styles.rumusDesc}>Faktor Emisi (kg CO₂/liter)</Text>
          </View>
          <View style={styles.rumusItem}>
            <View style={[styles.rumusTag, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.rumusTagText, { color: '#DC2626' }]}>FK</Text></View>
            <Text style={styles.rumusDesc}>Konsumsi BBM (liter/km)</Text>
          </View>
          <Text style={styles.sourceText}>Sumber data: IPCC 2021 + Kementerian ESDM RI</Text>
        </View>

        {/* Tips */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 20 }}>
          <Leaf color="#22C55E" size={18} />
          <Text style={styles.sectionTitle}>Tips Kurangi Emisi</Text>
        </View>
        {TIPS.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <View key={i} style={[styles.tipCard, { backgroundColor: tip.bg }]}>
              <View style={styles.tipIcon}>
                <Icon color={tip.color} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.desc}</Text>
              </View>
            </View>
          );
        })}

        {/* SDG */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 20 }}>
          <Target color="#0EA5E9" size={18} />
          <Text style={styles.sectionTitle}>EmiTrack & SDG</Text>
        </View>
        {[
          { label: 'SDG 11.2', title: 'Transportasi Berkelanjutan', desc: 'Menyediakan akses sistem transportasi yang aman, terjangkau, dan berkelanjutan.' },
          { label: 'SDG 11.6', title: 'Kurangi Dampak Kota', desc: 'Mengurangi dampak lingkungan negatif per kapita di perkotaan.' },
        ].map((sdg, i) => (
          <View key={i} style={styles.sdgCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <View style={styles.sdgBadge}><Text style={styles.sdgBadgeText}>{sdg.label}</Text></View>
              <Text style={styles.sdgTitle}>{sdg.title}</Text>
            </View>
            <Text style={styles.sdgDesc}>{sdg.desc}</Text>
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topbar: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  topbarTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  topbarSub: { fontSize: 12, color: '#9CA3AF' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },

  // Fakta
  faktaCard: { flexDirection: 'row', gap: 12, backgroundColor: '#E1F5EE', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#9FE1CB' },
  faktaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  faktaText: { fontSize: 13, fontWeight: '600', color: '#065F46', lineHeight: 18 },
  faktaSource: { fontSize: 9, color: '#1D9E75', fontWeight: 'bold', marginTop: 4, letterSpacing: 0.5 },

  // Rumus
  rumusCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  rumusBox: { backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  rumusText: { fontFamily: 'monospace', fontSize: 18, color: '#4ADE80', letterSpacing: 3 },
  rumusItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rumusTag: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  rumusTagText: { fontSize: 12, fontWeight: 'bold' },
  rumusDesc: { fontSize: 13, color: '#374151', fontWeight: '500' },
  sourceText: { fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Tips
  tipCard: { flexDirection: 'row', gap: 12, borderRadius: 16, padding: 14, marginBottom: 10 },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  tipTitle: { fontSize: 13, fontWeight: 'bold', color: '#1F2937', marginBottom: 2 },
  tipDesc: { fontSize: 11, color: '#4B5563', lineHeight: 16 },

  // SDG
  sdgCard: { backgroundColor: '#E0F2FE', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#BAE6FD' },
  sdgBadge: { backgroundColor: '#0369A1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  sdgBadgeText: { fontSize: 10, fontWeight: '900', color: 'white' },
  sdgTitle: { fontSize: 13, fontWeight: 'bold', color: '#0369A1' },
  sdgDesc: { fontSize: 11, color: '#075985', lineHeight: 16 },
});
