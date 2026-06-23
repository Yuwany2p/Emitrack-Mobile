// Faktor emisi (kg CO₂ per liter) — sumber IPCC 2021 + ESDM RI
export const FAKTOR_EMISI: Record<string, number> = {
  ron90:   2.30,
  ron92:   2.31,
  ron95:   2.33,
  ron98:   2.35,
  diesel48: 2.67,
  diesel51: 2.65,
  diesel53: 2.63,
  listrik:  0.85,
};

// Konsumsi rata-rata (liter/km)
export const KONSUMSI: Record<string, number> = {
  motor_ron90:    0.045,
  motor_ron92:    0.043,
  motor_ron95:    0.041,
  motor_ron98:    0.040,
  motor_listrik:  0.020,
  mobil_ron90:    0.125,
  mobil_ron92:    0.120,
  mobil_ron95:    0.115,
  mobil_ron98:    0.110,
  mobil_diesel48: 0.095,
  mobil_diesel51: 0.092,
  mobil_diesel53: 0.090,
  mobil_listrik:  0.180,
};

export const LABEL_BBM: Record<string, string> = {
  ron90:    'RON 90',
  ron92:    'RON 92',
  ron95:    'RON 95',
  ron98:    'RON 98',
  diesel48: 'Solar (CN 48)',
  diesel51: 'Dexlite (CN 51)',
  diesel53: 'Diesel Premium (CN 53)',
  listrik:  'Listrik',
  pertalite: 'RON 90 (Pertalite)',
  pertamax:  'RON 92 (Pertamax)',
  solar:     'Solar (CN 48)',
};

export const CONTOH_MEREK: Record<string, string> = {
  ron90:    'Pertalite, Shell Regular, Vivo Revvo 90',
  ron92:    'Pertamax, Shell Super, Total Performance 92, BP 92',
  ron95:    'Pertamax Green 95, Shell V-Power, Total Eco Plus',
  ron98:    'Pertamax Turbo, Shell V-Power Nitro+',
  diesel48: 'Biosolar, Solar subsidi',
  diesel51: 'Dexlite, Shell Diesel Extra',
  diesel53: 'Pertadex, Shell Diesel Premium',
  listrik:  'Semua kendaraan listrik',
};

export const BBM_OPTIONS: Record<string, string[]> = {
  motor: ['ron90', 'ron92', 'ron95', 'ron98', 'listrik'],
  mobil: ['ron90', 'ron92', 'ron95', 'ron98', 'diesel48', 'diesel51', 'diesel53', 'listrik'],
};

export const RATA_RATA_NASIONAL = 5.8;

export function hitungEmisi(jenis: string, bbm: string, jarakKm: number): number {
  if (!jarakKm || isNaN(jarakKm)) return 0;
  const jenisSafe = (jenis || 'motor').toLowerCase().replace(' pribadi', '').trim();
  const bbmSafe = (bbm || 'ron92').toLowerCase().trim();
  const key = `${jenisSafe}_${bbmSafe}`;
  const konsumsi = KONSUMSI[key] || 0.1;
  const faktor = FAKTOR_EMISI[bbmSafe] || (bbmSafe.includes('listrik') ? 0.85 : 2.31);
  const hasil = jarakKm * konsumsi * faktor;
  return isNaN(hasil) ? 0 : Number(hasil.toFixed(3));
}

export function hitungJarak(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export const EMISI_TRANSPUBLIK: Record<string, number> = {
  transjakarta: 0.008,
  mrt: 0.004,
  krl: 0.005,
  lrt: 0.006,
  sepeda: 0,
};

export const POIN_REWARD: Record<string, number> = {
  'Sepeda': 100,
  'KRL + MRT': 70,
  'MRT': 65,
  'KRL + LRT': 60,
  'KRL Commuter': 55,
  'LRT Jabodebek': 50,
  'TransJakarta + MRT': 45,
  'Motor Pribadi': 15,
  'Mobil Pribadi': 5,
};

// Moda label translations for trip display
export const MODA_UMUM_LABEL: Record<string, string> = {
  transjakarta: 'TransJakarta',
  krl: 'KRL',
  sepeda: 'Sepeda',
};
