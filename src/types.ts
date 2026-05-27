export interface Child {
  name: string;
  birthDate: string; // YYYY-MM-DD
}

export interface Employee {
  id: string;
  ownerId: string;
  nip: string; // 18-digit ID
  name: string;
  birthDate: string; // YYYY-MM-DD
  currentRank: string; // e.g., III/a, III/b
  maxRankReached: boolean; // if true, don't alert for promotions
  lastPromotionDate: string; // YYYY-MM-DD
  lastKgbDate?: string; // YYYY-MM-DD (optional, calculated if empty)
  phoneNumber?: string; // WhatsApp number
  children: Child[];
  createdAt: any;
  updatedAt: any;
}

export interface WhatsappTemplate {
  id: string; // type of alert e.g., "pangkat" | "kgb" | "anak-21" | "anak-over"
  name: string; // display name of template
  content: string; // text with placeholders like {Nama}, {NIP}, {BatasTanggal}, etc.
}


// System configuration for thresholds (in days)
export interface AlertSettings {
  promotionPeriodYear: number; // default 4 years
  kgbPeriodYear: number; // default 2 years
  alertThresholdDays: number; // default 90 days before due
}

export const GOLONGAN_PNS = [
  { code: "I/a", name: "Juru Muda" },
  { code: "I/b", name: "Juru Muda Tingkat I" },
  { code: "I/c", name: "Juru" },
  { code: "I/d", name: "Juru Tingkat I" },
  { code: "II/a", name: "Pengatur Muda" },
  { code: "II/b", name: "Pengatur Muda Tingkat I" },
  { code: "II/c", name: "Pengatur" },
  { code: "II/d", name: "Pengatur Tingkat I" },
  { code: "III/a", name: "Penata Muda" },
  { code: "III/b", name: "Penata Muda Tingkat I" },
  { code: "III/c", name: "Penata" },
  { code: "III/d", name: "Penata Tingkat I" },
  { code: "IV/a", name: "Pembina" },
  { code: "IV/b", name: "Pembina Tingkat I" },
  { code: "IV/c", name: "Pembina Utama Muda" },
  { code: "IV/d", name: "Pembina Utama Madya" },
  { code: "IV/e", name: "Pembina Utama" }
];
