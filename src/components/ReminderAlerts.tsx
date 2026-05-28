import { useState, JSX } from "react";
import { 
  Award, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  User, 
  CheckCircle2, 
  Printer, 
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Briefcase,
  MessageCircle,
  Send
} from "lucide-react";
import { Employee, GOLONGAN_PNS, WhatsappTemplate } from "../types";
import { 
  getPromotionAlerts, 
  getKgbAlerts, 
  getChildrenAlerts, 
  formatDateIndo, 
  addYearsToDate 
} from "../utils/dateHelpers";

interface ReminderAlertsProps {
  employees: Employee[];
  activeCategory: string; // "pangkat" | "kgb" | "anak-21" | "anak-over" | "all"
  alertThresholdDays: number;
  onPromoteSuccess?: (id: string, nextRank: string, promoteDate: string) => void;
  onKgbSuccess?: (id: string, kgbDate: string) => void;
  templates: WhatsappTemplate[];
  fonnteToken?: string;
  useFonnteAsDefault?: boolean;
}

export default function ReminderAlerts({
  employees,
  activeCategory,
  alertThresholdDays,
  onPromoteSuccess,
  onKgbSuccess,
  templates,
  fonnteToken,
  useFonnteAsDefault
}: ReminderAlertsProps): JSX.Element {
  
  // States
  const [showOnlyWarnings, setShowOnlyWarnings] = useState(true);
  const [sendLogs, setSendLogs] = useState<Record<string, { status: 'idle' | 'sending' | 'success' | 'error'; message?: string; time?: string }>>({});

  // Helper resolved text message generator
  const getMessageText = (
    employee: Employee,
    templateId: string,
    extraData?: { dueDate?: string; daysRemaining?: number; childName?: string; childAge?: string }
  ): string => {
    const template = templates.find(t => t.id === templateId);
    let content = template ? template.content : "";

    if (!content) {
      // Fallback contents
      if (templateId === "pangkat") {
        content = "Halo *{Nama}* (NIP: {NIP}), diinformasikan bahwa jadwal Kenaikan Pangkat Anda jatuh pada tanggal *{BatasTanggal}* ({SisaHari} hari lagi). Harap segera mempersiapkan berkas dinas yang diperlukan. Terima kasih.";
      } else if (templateId === "kgb") {
        content = "Halo Bpk/Ibu *{Nama}* (NIP: {NIP}), diinformasikan bahwa jadwal Kenaikan Gaji Berkala (KGB) Anda jatuh pada tanggal *{BatasTanggal}* ({SisaHari} hari lagi). Terima kasih atas dedikasinya.";
      } else if (templateId === "anak-21") {
        content = "Yth. Bpk/Ibu *{Nama}* (NIP: {NIP}), diinformasikan bahwa anak Anda *{NamaAnak}* akan menginjak usia 21 tahun pada *{BatasTanggal}* ({SisaHari} hari lagi). Agar tunjangan anak tetap berjalan pada gaji bulanan, mohon segera sampaikan Surat Keterangan Kuliah aktif ke bagian Administrasi.";
      } else if (templateId === "anak-over") {
        content = "Yth. Bpk/Ibu *{Nama}* (NIP: {NIP}), menginformasikan bahwa anak Anda *{NamaAnak}* saat ini sudah berusia {UsiaAnak} tahun. Mohon sampaikan pembaruan berkas Surat Keterangan Kuliah aktif agar tunjangan tidak dihentikan otomatis. Terima kasih.";
      }
    }

    // Replace placeholders
    let text = content
      .replace(/{Nama}/g, employee.name)
      .replace(/{NIP}/g, employee.nip)
      .replace(/{Pangkat}/g, employee.currentRank);

    if (extraData?.dueDate) {
      text = text.replace(/{BatasTanggal}/g, extraData.dueDate);
    }
    if (extraData?.daysRemaining !== undefined) {
      text = text.replace(/{SisaHari}/g, String(extraData.daysRemaining));
    }
    if (extraData?.childName) {
      text = text.replace(/{NamaAnak}/g, extraData.childName);
    }
    if (extraData?.childAge) {
      text = text.replace(/{UsiaAnak}/g, extraData.childAge);
    }

    return text;
  };

  // Helper WA generator
  const getWhatsappUrl = (
    employee: Employee, 
    templateId: string, 
    extraData?: { dueDate?: string; daysRemaining?: number; childName?: string; childAge?: string }
  ): string => {
    const phone = employee.phoneNumber || "";
    if (!phone) return "";

    const text = getMessageText(employee, templateId, extraData);

    // Format phone number
    let cleanedPhone = phone.replace(/[^0-9]/g, "");
    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = "62" + cleanedPhone.substring(1);
    }

    return `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(text)}`;
  };

  const handleNoPhone = () => {
    alert("Pegawai ini belum memiliki nomor WhatsApp terdaftar. Silakan edit data pegawai terlebih dahulu di tab 'Manajemen Pegawai'!");
  };

  const handleSendFonnte = async (
    employee: Employee,
    templateId: string,
    extraData?: { dueDate?: string; daysRemaining?: number; childName?: string; childAge?: string }
  ) => {
    const phone = employee.phoneNumber || "";
    if (!phone) {
      handleNoPhone();
      return;
    }

    const token = localStorage.getItem("sipeka_fonnte_token") || "";
    if (!token) {
      alert("Token API Fonnte belum dikonfigurasi! Harap buka tab 'Template Pesan WA' terlebih dahulu untuk memasukkan Token API Fonnte Anda.");
      return;
    }

    // Clean phone number
    let cleanedPhone = phone.replace(/[^0-9]/g, "");
    const customCode = localStorage.getItem("sipeka_fonnte_code") || "62";
    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = customCode + cleanedPhone.substring(1);
    }

    const text = getMessageText(employee, templateId, extraData);
    const key = `${employee.id}_${templateId}_${extraData?.childName || ""}`;

    setSendLogs(prev => ({
      ...prev,
      [key]: { status: 'sending' }
    }));

    try {
      const formData = new FormData();
      formData.append("target", cleanedPhone);
      formData.append("message", text);
      formData.append("countryCode", customCode);

      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": token
        },
        body: formData
      });

      const data = await response.json();
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      if (data.status === true || data.status === "true" || data.status === 1 || response.ok) {
        setSendLogs(prev => ({
          ...prev,
          [key]: { 
            status: 'success', 
            message: data.detail || "Berhasil dikirim", 
            time: nowTime 
          }
        }));
        alert(`Sukses! Pesan pengingat otomatis berhasil dikirim langsung via Fonnte Gateway ke ${employee.name} (${cleanedPhone}).`);
      } else {
        const errorReason = data.reason || data.detail || "Error API Fonnte";
        setSendLogs(prev => ({
          ...prev,
          [key]: { 
            status: 'error', 
            message: errorReason
          }
        }));
        alert(`Gagal mengirim via Fonnte: ${errorReason}. Silakan coba menggunakan tombol tautan WhatsApp manual.`);
      }
    } catch (error: any) {
      console.error("Gagal mengirim via Fonnte:", error);
      setSendLogs(prev => ({
        ...prev,
        [key]: { 
          status: 'error', 
          message: error.message || "Kesalahan jaringan"
        }
      }));
      alert(`Gagal mengirim via Fonnte (Kesalahan Jaringan): ${error.message || error}. Silakan coba menggunakan tombol tautan WhatsApp manual.`);
    }
  };

  // Centralized action rendering helper
  const renderNotificationActions = (
    employee: Employee,
    templateId: string,
    extraData?: { dueDate?: string; daysRemaining?: number; childName?: string; childAge?: string }
  ) => {
    const key = `${employee.id}_${templateId}_${extraData?.childName || ""}`;
    const log = sendLogs[key];
    const waUrl = getWhatsappUrl(employee, templateId, extraData);

    if (!employee.phoneNumber) {
      return (
        <button
          onClick={handleNoPhone}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 font-bold text-[10px] rounded-lg cursor-pointer border dark:border-zinc-700/50"
        >
          <MessageCircle className="w-3.5 h-3.5" /> No WA Kosong
        </button>
      );
    }

    const isSending = log?.status === "sending";
    const isSuccess = log?.status === "success";
    const isError = log?.status === "error";

    // If Use Fonnte is active and token is set
    const hasFonnte = !!fonnteToken;

    if (hasFonnte && useFonnteAsDefault) {
      return (
        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
          {isSuccess && (
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">
              ✓ Terkirim {log.time}
            </span>
          )}
          {isError && (
            <span className="text-[9px] text-rose-605 dark:text-rose-450 font-bold font-mono" title={log.message}>
              ⚠ Gagal API
            </span>
          )}
          
          <div className="flex items-center gap-[4px]">
            <button
              disabled={isSending}
              onClick={() => handleSendFonnte(employee, templateId, extraData)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer ${
                isSending 
                  ? "bg-zinc-150 dark:bg-zinc-800 text-zinc-400 cursor-wait"
                  : isSuccess
                    ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-350"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white font-black"
              }`}
            >
              {isSending ? (
                <>
                  <span className="w-2.5 h-2.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></span>
                  Kirim...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  {isSuccess ? "Ulang API" : "Kirim Fonnte"}
                </>
              )}
            </button>
            
            {/* Fallback WA Web button */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1.5 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-600 dark:text-zinc-350 rounded-lg text-[10px] font-bold border dark:border-zinc-700/60 flex items-center justify-center cursor-pointer"
              title="Kirim Manual lewat WhatsApp Web / App"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
            </a>
          </div>
        </div>
      );
    }

    // Default layout or when Fonnte is not preferred as default but can still be clicked
    return (
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
        {isSuccess && (
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">
            ✓ Terkirim {log.time}
          </span>
        )}
        
        <div className="flex items-center gap-1.5">
          {/* Main WA Link */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WA Notif
          </a>

          {/* Quick background Fonnte Button if token is configured */}
          {hasFonnte && (
            <button
              disabled={isSending}
              onClick={() => handleSendFonnte(employee, templateId, extraData)}
              className={`p-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center cursor-pointer ${
                isSending 
                  ? "bg-zinc-150 text-zinc-450 border-zinc-200 cursor-wait"
                  : "bg-white hover:bg-zinc-50 border-emerald-500 dark:bg-zinc-900 dark:border-emerald-900 text-emerald-600 hover:text-emerald-700"
              }`}
              title="Kirim Instan via Fonnte API di Latar Belakang"
            >
              {isSending ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Calculations
  const promotionAlerts = getPromotionAlerts(employees, new Date(), alertThresholdDays);
  const kgbAlerts = getKgbAlerts(employees, new Date(), alertThresholdDays);
  const { turning21, over21 } = getChildrenAlerts(employees, new Date());

  // Filter alerts based on active category & warning thresholds
  const displayPromotions = showOnlyWarnings 
    ? promotionAlerts.filter(p => p.status !== "safe") 
    : promotionAlerts;

  const displayKgb = showOnlyWarnings 
    ? kgbAlerts.filter(k => k.status !== "safe") 
    : kgbAlerts;

  const handlePrint = () => {
    window.print();
  };

  // Quick next rank helper
  const getNextRank = (currentRank: string): string => {
    const idx = GOLONGAN_PNS.findIndex(g => g.code === currentRank);
    if (idx !== -1 && idx < GOLONGAN_PNS.length - 1) {
      return GOLONGAN_PNS[idx + 1].code;
    }
    return currentRank;
  };

  // Badge stylings
  const getStatusBadge = (status: string, days: number) => {
    switch(status) {
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30">
            <AlertCircle className="w-3 h-3" /> Terlewat ({Math.abs(days)} Hari)
          </span>
        );
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 animate-pulse">
            <Clock className="w-3 h-3" /> Kritis ({days} Hari Lagi)
          </span>
        );
      case "upcoming":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30">
            <Clock className="w-3 h-3" /> Mendekati ({days} Hari)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-850 text-zinc-650 dark:text-zinc-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Aman ({days} Hari)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="alerts-container">
      
      {/* Settings Row / Filter options */}
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4" id="alerts-control-panel-heading">
        <div className="flex items-center gap-3 text-left w-full sm:w-auto">
          <Clock className="w-5 h-5 text-zinc-500" />
          <div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
              Saringan Peringatan Otomatis
            </span>
            <span className="text-[10px] text-zinc-500">
              Menampilkan jadwal berdasarkan ambang batas peringatan aktif: {alertThresholdDays} Hari
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 w-full sm:w-auto flex-wrap">
          {(activeCategory === "pangkat" || activeCategory === "kgb") && (
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyWarnings}
                onChange={(e) => setShowOnlyWarnings(e.target.checked)}
                className="rounded-sm border-zinc-300 dark:border-zinc-800 text-zinc-900 cursor-pointer h-4 w-4"
              />
              Hanya tampilkan yang butuh tindakan (Peringatan & Terlewat)
            </label>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-850 dark:hover:bg-zinc-805 dark:text-zinc-250 border dark:border-zinc-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Laporan
          </button>
        </div>
      </div>

      {/* 1. SECTION: KENAIKAN PANGKAT */}
      {(activeCategory === "pangkat" || activeCategory === "all") && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden print:border-none" id="section-pangkat">
          <div className="p-5 border-b dark:border-zinc-800 bg-amber-50/20 dark:bg-amber-950/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div className="text-left">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Jadwal Kenaikan Pangkat (KPG) — Siklus 4 Tahunan
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Daftar PNS yang akan kenaikan pangkat dinasnya berikutnya (kecuali status pangkat mentok/maksimal)
                </p>
              </div>
            </div>
            <span className="hidden print:inline text-xs font-mono">Dinas Kepegawaian RI</span>
          </div>

          <div className="overflow-x-auto">
            {displayPromotions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Tidak ada peringatan kenaikan pangkat saat ini {showOnlyWarnings && "(Semua PNS berstatus Aman)." } 
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 uppercase font-bold tracking-wider border-b dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Nama / NIP</th>
                    <th className="px-6 py-3">Pangkat Sekarang</th>
                    <th className="px-6 py-3">KPG Terakhir</th>
                    <th className="px-6 py-3">KPG Berikutnya</th>
                    <th className="px-6 py-3">Sisa Waktu</th>
                    <th className="px-6 py-3 text-right print:hidden">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {displayPromotions.map((p) => {
                    const nextRank = getNextRank(p.employee.currentRank);
                    const defaultDateNow = new Date().toISOString().split("T")[0];
                    
                    return (
                      <tr key={p.employee.id} className="hover:bg-zinc-50/35">
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-zinc-900 dark:text-white">{p.employee.name}</span>
                            <span className="font-mono text-[10px] text-zinc-500 mt-0.5">NIP: {p.employee.nip}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 font-mono bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-150 rounded-sm">
                              {p.employee.currentRank}
                            </span>
                            {nextRank !== p.employee.currentRank && (
                              <>
                                <span className="text-zinc-400">→</span>
                                <span className="px-1.5 py-0.5 font-mono bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 rounded-sm font-semibold">
                                  {nextRank}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">{formatDateIndo(p.employee.lastPromotionDate)}</td>
                        <td className="px-6 py-4 font-bold text-zinc-950 dark:text-white">{formatDateIndo(p.dueDate)}</td>
                        <td className="px-6 py-4">{getStatusBadge(p.status, p.daysRemaining)}</td>
                        <td className="px-6 py-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-2">
                            {renderNotificationActions(p.employee, "pangkat", { dueDate: formatDateIndo(p.dueDate), daysRemaining: p.daysRemaining })}

                            {onPromoteSuccess && (
                              <button
                                onClick={() => {
                                  if (confirm(`Proses kenaikan pangkat untuk pegawai "${p.employee.name}" ke golongan ${nextRank}? Tanggal naik pangkat terakhir akan dimutakhirkan.`)) {
                                    onPromoteSuccess(p.employee.id, nextRank, defaultDateNow);
                                  }
                                }}
                                className="text-[10px] font-bold px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                              >
                                Selesai
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 2. SECTION: KENAIKAN GAJI BERKALA */}
      {(activeCategory === "kgb" || activeCategory === "all") && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden print:border-none" id="section-kgb">
          <div className="p-5 border-b dark:border-zinc-800 bg-emerald-50/20 dark:bg-emerald-950/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <div className="text-left">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Jadwal Kenaikan Gaji Berkala (KGB) — Siklus 2 Tahunan
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Monitoring kenaikan gaji PNS berkala setiap 2 tahun dari kenaikan gaji berkala (KGB) terakhir, atau dari KPG jika KGB terakhir kosong
                </p>
              </div>
            </div>
          </div>
 
          <div className="overflow-x-auto">
            {displayKgb.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Tidak ada peringatan KGB saat ini {showOnlyWarnings && "(Semua PNS berstatus Aman)." }
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 uppercase font-bold tracking-wider border-b dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Nama / NIP</th>
                    <th className="px-6 py-3">Golongan</th>
                    <th className="px-6 py-3">KGB Terakhir / KPG</th>
                    <th className="px-6 py-3">Jadwal KGB Berikutnya</th>
                    <th className="px-6 py-3">Sisa Waktu</th>
                    <th className="px-6 py-3 text-right print:hidden">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {displayKgb.map((k) => {
                    const defaultDateNow = new Date().toISOString().split("T")[0];
                    return (
                      <tr key={k.employee.id} className="hover:bg-zinc-50/35">
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-zinc-900 dark:text-white">{k.employee.name}</span>
                            <span className="font-mono text-[10px] text-zinc-500 mt-0.5">NIP: {k.employee.nip}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-1.5 py-0.5 font-mono bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 rounded-sm">
                            {k.employee.currentRank}
                          </span>
                        </td>
                        <td className="px-6 py-4">{formatDateIndo(k.employee.lastKgbDate || k.employee.lastPromotionDate)}</td>
                        <td className="px-6 py-4 font-bold text-zinc-950 dark:text-white">{formatDateIndo(k.dueDate)}</td>
                        <td className="px-6 py-4">{getStatusBadge(k.status, k.daysRemaining)}</td>
                        <td className="px-6 py-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-2">
                            {renderNotificationActions(k.employee, "kgb", { dueDate: formatDateIndo(k.dueDate), daysRemaining: k.daysRemaining })}

                            {onKgbSuccess && (
                              <button
                                onClick={() => {
                                  if (confirm(`Proses pencatatan KGB selesai untuk pegawai "${k.employee.name}"? Ini mencatat penyesuaian gaji saat ini.`)) {
                                    onKgbSuccess(k.employee.id, defaultDateNow);
                                  }
                                }}
                                className="text-[10px] font-bold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                              >
                                Selesai KGB
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 3. SECTION: ANAK MENJELANG USIA 21 TAHUN */}
      {(activeCategory === "anak-21" || activeCategory === "all") && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden print:border-none" id="section-anak-21">
          <div className="p-5 border-b dark:border-zinc-800 bg-indigo-50/20 dark:bg-indigo-950/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <div className="text-left">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Anak Karyawan Menginjak Usia 21 Tahun (Kontrol Tunjangan)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Daftar anak PNS berusia 20 tahun yang segera menginjak 21. Perlu verifikasi Surat Keterangan Kuliah agar tunjangan tidak dihentikan.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {turning21.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Tidak ada anak karyawan yang berusia mendekati 21 tahun saat ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 uppercase font-bold tracking-wider border-b dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Nama Anak</th>
                    <th className="px-6 py-3">Tanggal Lahir Anak</th>
                    <th className="px-6 py-3">Usia Saat Ini</th>
                    <th className="px-6 py-3">Orang Tua (Pegawai)</th>
                    <th className="px-6 py-3">Tanggal Genap 21 Thn</th>
                    <th className="px-6 py-3 font-medium text-right">Perkiraan Sisa</th>
                    <th className="px-6 py-3 text-right print:hidden">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {turning21.map((c, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/35">
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">{c.child.name}</td>
                      <td className="px-6 py-4">{formatDateIndo(c.child.birthDate)}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {c.age.years} Thn {c.age.months} Bln {c.age.days} Hari
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-left">
                          <span className="font-semibold">{c.employee.name}</span>
                          <span className="text-[10px] text-zinc-500">NIP: {c.employee.nip}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-indigo-700 dark:text-indigo-400">{formatDateIndo(c.dueDate21)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-300 border border-indigo-155 rounded-md font-mono text-[10px] font-bold animate-pulse">
                          {c.daysRemaining} Hari Lagi
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right print:hidden">
                        {renderNotificationActions(c.employee, "anak-21", { dueDate: formatDateIndo(c.dueDate21), daysRemaining: c.daysRemaining, childName: c.child.name })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 4. SECTION: ANAK DI ATAS 21 TAHUN */}
      {(activeCategory === "anak-over" || activeCategory === "all") && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden print:border-none" id="section-anak-over">
          <div className="p-5 border-b dark:border-zinc-800 bg-rose-50/20 dark:bg-rose-950/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <div className="text-left">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Daftar Anak Berusia Di Atas 21 Tahun (Kontrol Kelayakan Tunjangan)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Anak yang telah berusia &ge; 21 tahun. Menurut regulasi, tunjangan harus dihentikan kecuali menyertakan Surat Keterangan Kuliah yang sah (maksimum 25 tahun).
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {over21.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Tidak ada anak karyawan terdaftar yang berusia di atas 21 tahun.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 uppercase font-bold tracking-wider border-b dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Nama Anak</th>
                    <th className="px-6 py-3">Tanggal Lahir Anak</th>
                    <th className="px-6 py-3">Usia Sekarang</th>
                    <th className="px-6 py-3">Orang Tua (Pegawai)</th>
                    <th className="px-6 py-3">Status Tunjangan PNS</th>
                    <th className="px-6 py-3 text-right">Keterangan Pajak/Gaji</th>
                    <th className="px-6 py-3 text-right print:hidden">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {over21.map((c, idx) => {
                    const isEligibleScholar = c.age.years <= 25;
                    return (
                      <tr key={idx} className="hover:bg-zinc-50/35">
                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">{c.child.name}</td>
                        <td className="px-6 py-4">{formatDateIndo(c.child.birthDate)}</td>
                        <td className="px-6 py-4 font-mono font-bold text-rose-700 dark:text-rose-450">
                          {c.age.years} Tahun {c.age.months} Bulan
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{c.employee.name}</span>
                            <span className="text-[10px] text-zinc-500">NIP: {c.employee.nip}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {isEligibleScholar ? (
                            <span className="inline-flex px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border border-amber-200 dark:border-amber-900/30 rounded-md font-semibold text-[10px]">
                              Butuh Surat Kuliah (Aktif)
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-md font-bold text-[10px]">
                              Hentikan Tunjangan (Mutlak)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] text-zinc-500">
                            {isEligibleScholar ? "Maks. s/d 25 Thn jika kuliah" : "Telah melebihi batas usia 25 tahun"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right print:hidden">
                          {renderNotificationActions(c.employee, "anak-over", { childName: c.child.name, childAge: `${c.age.years}` })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
