/**
 * GPS Utility Functions — Validasi perjalanan navigasi real-time
 */

// Haversine: hitung jarak antara dua koordinat (km)
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Hitung total jarak kumulatif dari array koordinat GPS [lat, lon][]
export function hitungJarakKumulatif(path: {latitude: number, longitude: number}[]): number {
  if (path.length < 2) return 0
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1].latitude, path[i - 1].longitude, path[i].latitude, path[i].longitude)
    // Filter GPS noise: abaikan lompatan > 1km dalam 1 interval (kemungkinan GPS error)
    if (d < 1) {
      total += d
    }
  }
  return Number(total.toFixed(2))
}

// Format durasi detik → "X mnt Y dtk"
export function formatDurasi(detik: number): string {
  if (detik < 60) return `${detik} dtk`
  const menit = Math.floor(detik / 60)
  const sisa = detik % 60
  if (menit >= 60) {
    const jam = Math.floor(menit / 60)
    const sisaMnt = menit % 60
    return `${jam} jam ${sisaMnt} mnt`
  }
  return sisa > 0 ? `${menit} mnt ${sisa} dtk` : `${menit} mnt`
}

// Validasi apakah perjalanan valid
export function validasiPerjalanan(
  walkedArray: [number, number][],
  jarakKmTarget: number,
  tujuanLatLng: { lat: number; lon: number } | null
): { valid: boolean; pesan: string; jarakAktual: number } {
  if (walkedArray.length < 3) {
    return { valid: false, pesan: 'Perjalanan terlalu singkat atau GPS tidak merekam.', jarakAktual: 0 };
  }

  // Hitung akumulasi pergerakan user
  const pathObj = walkedArray.map(p => ({ latitude: p[0], longitude: p[1] }));
  const jarakAktual = hitungJarakKumulatif(pathObj);

  if (jarakAktual < 0.1) {
    return { valid: false, pesan: 'Anda belum bergerak cukup jauh (min. 100m).', jarakAktual: jarakAktual };
  }

  // Validasi radius tujuan
  if (tujuanLatLng) {
    const lastPos = walkedArray[walkedArray.length - 1];
    const jarakKeTujuan = haversineKm(
      lastPos[0], lastPos[1],
      tujuanLatLng.lat, tujuanLatLng.lon
    );

    if (jarakKeTujuan > 1.0) { // Toleransi 1 km
      return { valid: false, pesan: `Anda belum sampai di tujuan (jarak tersisa: ${(jarakKeTujuan).toFixed(1)} km).`, jarakAktual: jarakAktual };
    }
  }

  return { valid: true, pesan: 'Perjalanan valid.', jarakAktual: jarakAktual };
}

// Deteksi Keluar Jalur (Off-Route)
export function isOffRoute(
  currentLoc: { latitude: number; longitude: number },
  routeCoords: { latitude: number; longitude: number }[],
  thresholdKm: number = 0.05 // 50 meter default
): boolean {
  if (!routeCoords || routeCoords.length === 0) return false;
  
  let minDistance = Infinity;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = haversineKm(
      currentLoc.latitude, currentLoc.longitude,
      routeCoords[i].latitude, routeCoords[i].longitude
    );
    if (d < minDistance) {
      minDistance = d;
    }
    // Early exit jika menemukan satu titik yang cukup dekat
    if (minDistance <= thresholdKm) {
      return false;
    }
  }
  
  return minDistance > thresholdKm;
}
