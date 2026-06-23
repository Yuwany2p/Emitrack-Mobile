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
