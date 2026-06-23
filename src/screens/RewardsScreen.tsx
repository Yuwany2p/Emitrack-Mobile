import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Gift, Coins, Tag, Clock, ArrowRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';

type Reward = {
  id: string;
  title: string;
  partner: string;
  points: number;
  type: 'voucher' | 'discount' | 'donation';
  bgColor: string;
  iconColor: string;
};

const REWARDS: Reward[] = [
  {
    id: '1',
    title: 'Voucher KRL Rp 50.000',
    partner: 'KAI Commuter',
    points: 1500,
    type: 'voucher',
    bgColor: '#E1F5EE',
    iconColor: '#1D9E75'
  },
  {
    id: '2',
    title: 'Diskon 20% Minuman',
    partner: 'Fore Coffee',
    points: 800,
    type: 'discount',
    bgColor: '#FFFBEB',
    iconColor: '#D97706'
  },
  {
    id: '3',
    title: 'Tanam 1 Pohon Mangrove',
    partner: 'LindungiHutan',
    points: 2000,
    type: 'donation',
    bgColor: '#E0F2FE',
    iconColor: '#0284C7'
  }
];

export default function RewardsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [poin, setPoin] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchPoin();
  }, [user]);

  const fetchPoin = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('total_poin')
      .eq('id', user!.id)
      .single();
    if (data) setPoin(data.total_poin || 0);
    setLoading(false);
  };

  const handleRedeem = (reward: Reward) => {
    if (poin < reward.points) {
      showToast(`Butuh ${reward.points - poin} poin lagi untuk menukar reward ini.`, 'warning');
      return;
    }
    
    Alert.alert(
      'Tukar Poin',
      `Tukar ${reward.points} poin dengan ${reward.title}?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Tukar', 
          onPress: async () => {
            const newPoin = poin - reward.points;
            await supabase.from('profiles').update({ total_poin: newPoin }).eq('id', user!.id);
            setPoin(newPoin);
            showToast('Reward berhasil ditukar! Cek email kamu.', 'success');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Kembali</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.topbarTitle}>Tukar Reward</Text>
          <Text style={styles.topbarSub}>Tukarkan poin hijau kamu</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Poin Card */}
        <View style={styles.poinCard}>
          <View>
            <Text style={styles.poinLabel}>Poin Saya</Text>
            {loading ? (
               <ActivityIndicator size="small" color="white" />
            ) : (
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                 <Coins color="#FBBF24" size={28} />
                 <Text style={styles.poinValue}>{poin}</Text>
               </View>
            )}
          </View>
          <Gift color="rgba(255,255,255,0.2)" size={64} style={{ position: 'absolute', right: -10, top: -10 }} />
        </View>

        <Text style={styles.sectionTitle}>Tersedia Untukmu</Text>

        {REWARDS.map(r => (
          <View key={r.id} style={styles.rewardCard}>
            <View style={[styles.rewardIcon, { backgroundColor: r.bgColor }]}>
              {r.type === 'voucher' ? <Tag color={r.iconColor} size={24} /> : 
               r.type === 'donation' ? <Leaf color={r.iconColor} size={24} /> : 
               <Clock color={r.iconColor} size={24} />}
            </View>
            <View style={styles.rewardContent}>
              <Text style={styles.rewardPartner}>{r.partner}</Text>
              <Text style={styles.rewardTitle}>{r.title}</Text>
              <View style={styles.rewardCostRow}>
                <Coins color="#F59E0B" size={12} />
                <Text style={styles.rewardCostText}>{r.points} poin</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.redeemBtn, poin < r.points && styles.redeemBtnDisabled]} 
              onPress={() => handleRedeem(r)}
            >
              <Text style={styles.redeemBtnText}>Tukar</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  
  poinCard: { backgroundColor: '#1D9E75', borderRadius: 16, padding: 20, marginBottom: 24, overflow: 'hidden', position: 'relative' },
  poinLabel: { color: '#A7F3D0', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  poinValue: { color: 'white', fontSize: 36, fontWeight: 'bold' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },

  rewardCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  rewardIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  rewardContent: { flex: 1 },
  rewardPartner: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  rewardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  rewardCostRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardCostText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  
  redeemBtn: { backgroundColor: '#1D9E75', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  redeemBtnDisabled: { backgroundColor: '#F3F4F6' },
  redeemBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
