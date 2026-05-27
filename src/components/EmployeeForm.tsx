import React, { useState, useEffect, JSX } from "react";
import { X, Plus, Trash2, Calendar, UserPlus, Check, Sparkles } from "lucide-react";
import { Employee, Child, GOLONGAN_PNS } from "../types";

interface EmployeeFormProps {
  employee: Employee | null; // null if creating a new employee
  onSave: (employeeData: Partial<Employee>) => void;
  onClose: () => void;
}

export default function EmployeeForm({
  employee,
  onSave,
  onClose,
}: EmployeeFormProps): JSX.Element {
  const [nip, setNip] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [currentRank, setCurrentRank] = useState("III/a");
  const [maxRankReached, setMaxRankReached] = useState(false);
  const [lastPromotionDate, setLastPromotionDate] = useState("");
  const [lastKgbDate, setLastKgbDate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [validationError, setValidationError] = useState("");

  // Populate data when editing
  useEffect(() => {
    if (employee) {
      setNip(employee.nip || "");
      setName(employee.name || "");
      setBirthDate(employee.birthDate || "");
      setCurrentRank(employee.currentRank || "III/a");
      setMaxRankReached(employee.maxRankReached || false);
      setLastPromotionDate(employee.lastPromotionDate || "");
      setLastKgbDate(employee.lastKgbDate || "");
      setPhoneNumber(employee.phoneNumber || "");
      setChildren(employee.children ? [...employee.children] : []);
    } else {
      // Set defaults for new
      setNip("");
      setName("");
      setBirthDate("");
      setCurrentRank("III/a");
      setMaxRankReached(false);
      setLastPromotionDate("");
      setLastKgbDate("");
      setPhoneNumber("");
      setChildren([]);
    }
    setValidationError("");
  }, [employee]);

  // Autofill cpns/birthdate features from Indonesian NIP
  // PNS NIP is 18 digits: YYYYMMDD (birth) + YYYYMM (CPNS) + Gender (1) + Seq (3)
  const handleNipChange = (val: string) => {
    // Only numbers
    const cleaned = val.replace(/[^0-9]/g, "").substring(0, 18);
    setNip(cleaned);

    // Dynamic extraction helper to delight the user
    if (cleaned.length >= 8) {
      const year = cleaned.substring(0, 4);
      const month = cleaned.substring(4, 6);
      const day = cleaned.substring(6, 8);
      
      // Validate extracted date is real
      const y = parseInt(year);
      const m = parseInt(month) - 1;
      const d = parseInt(day);
      if (y > 1940 && y < 2026 && m >= 0 && m < 12 && d >= 1 && d <= 31) {
        setBirthDate(`${year}-${month}-${day}`);
      }
    }
  };

  const handleAddChild = () => {
    if (children.length >= 10) {
      alert("Maksimum 10 anak per pegawai");
      return;
    }
    setChildren([...children, { name: "", birthDate: "" }]);
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, idx) => idx !== index));
  };

  const handleChildChange = (index: number, key: keyof Child, value: string) => {
    const updatedChildren = [...children];
    updatedChildren[index] = { ...updatedChildren[index], [key]: value };
    setChildren(updatedChildren);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Simple validations
    if (!nip || nip.length < 9) {
      setValidationError("NIP harus valid (biasanya 18 digit)");
      return;
    }
    if (!name.trim()) {
      setValidationError("Nama pegawai tidak boleh kosong");
      return;
    }
    if (!birthDate) {
      setValidationError("Tanggal lahir tidak boleh kosong");
      return;
    }
    if (!lastPromotionDate) {
      setValidationError("Tanggal kenaikan pangkat terakhir tidak boleh kosong");
      return;
    }

    // Validate child data
    for (let i = 0; i < children.length; i++) {
      if (!children[i].name.trim()) {
        setValidationError(`Isi nama anak ke-${i + 1} atau hapus barisnya`);
        return;
      }
      if (!children[i].birthDate) {
        setValidationError(`Isi tanggal lahir anak ke-${i + 1} atau hapus barisnya`);
        return;
      }
    }

    // Submit partial data
    onSave({
      nip,
      name: name.trim(),
      birthDate,
      currentRank,
      maxRankReached,
      lastPromotionDate,
      lastKgbDate: lastKgbDate || undefined,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      children,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" id="employee-modal-overlay">
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] my-8 animate-in fade-in zoom-in-95 duration-200" id="employee-modal-box">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800" id="employee-modal-header">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <UserPlus className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {employee ? "Ubah Data Pegawai ke-PNS" : "Tambah Data Pegawai PNS / PPPK"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Lengkapi berkas administrasi dan data anak untuk monitoring berkala
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6" id="employee-modal-form">
          
          {validationError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-xl text-sm font-medium flex gap-2 items-center">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {validationError}
            </div>
          )}

          {/* Core Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* NIP */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                NIP (18 Digit) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Contoh: 198005122005011002"
                  value={nip}
                  onChange={(e) => handleNipChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all font-mono text-sm"
                />
                {nip.length === 18 && (
                  <span className="absolute right-3 top-2.5 text-emerald-500 flex items-center gap-1 text-xs font-semibold">
                    <Check className="w-4 h-4" /> Valid 18
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                Ketik 18 digit angka. Isi NIP otomatis memicu pengisian tanggal lahir dari digit 1-8.
              </p>
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Nama Lengkap Pegawai *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Hendra Wijaya, S.Kom."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
              />
            </div>

            {/* Tanggal Lahir */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Tanggal Lahir *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
                />
              </div>
            </div>

            {/* Golongan / Pangkat terakhir */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Golongan / Pangkat Saat Ini *
              </label>
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
              >
                {GOLONGAN_PNS.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} ({g.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Kenaikan Pangkat Terakhir */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Tanggal Naik Pangkat Terakhir *
              </label>
              <input
                type="date"
                required
                value={lastPromotionDate}
                onChange={(e) => setLastPromotionDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                KPG berikutnya dihitung 4 tahun dan KGB dihitung 2 tahun dari tanggal ini.
              </p>
            </div>

            {/* Kenaikan Gaji Berkala Terakhir (Opsional override) */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Tanggal KGB Terakhir (Opsional Override)
              </label>
              <input
                type="date"
                value={lastKgbDate}
                onChange={(e) => setLastKgbDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                Biarkan kosong agar KGB dihitung otomatis 2 tahun dari KPG terakhir.
              </p>
            </div>

            {/* Nomor WhatsApp Pegawai */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Nomor WhatsApp Pegawai *
              </label>
              <input
                type="text"
                placeholder="Contoh: 08123456789 atau 628123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-400 transition-all text-sm"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                Gunakan nomor aktif untuk integrasi pengiriman pesan WhatsApp pengingat otomatis.
              </p>
            </div>
          </div>

          {/* Max Rank Reached Toggle */}
          <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 rounded-xl p-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="maxRankReached"
              checked={maxRankReached}
              onChange={(e) => setMaxRankReached(e.target.checked)}
              className="mt-1 h-4 w-4 rounded-sm border-amber-300 text-amber-650 focus:ring-amber-500 cursor-pointer"
            />
            <div className="flex-1">
              <label htmlFor="maxRankReached" className="block text-sm font-semibold text-amber-900 dark:text-amber-400 cursor-pointer select-none">
                Sudah Mencapai Batas Maksimal Golongan/Pangkat
              </label>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Aktifkan jika pegawai ini telah mentok pangkatnya (misalnya karena ijazah terakhir) agar sistem <strong>menghentikan</strong> semua peringatan jadwal kenaikan pangkat 4 tahunan.
              </p>
            </div>
          </div>

          {/* Children Section */}
          <div className="border-t dark:border-zinc-800 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Daftar Anak / Tanggungan Gaji ({children.length})
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Digunakan untuk mendeteksi anak usia di atas 21 tahun (batas tunjangan)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddChild}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium transition-all shadow-sm cursor-pointer dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-105"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Anak
              </button>
            </div>

            {children.length === 0 ? (
              <div className="p-6 bg-zinc-50 dark:bg-zinc-950/20 border border-dashed dark:border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
                Belum ada data anak terdaftar. Klik "Tambah Anak" jika pegawai memiliki anak dalam tanggungan gaji.
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {children.map((child, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border dark:border-zinc-850 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <span className="text-xs font-mono font-bold bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-sm text-zinc-700 dark:text-zinc-300">
                      Anak #{idx + 1}
                    </span>
                    
                    {/* Child Name */}
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        placeholder="Nama Lengkap Anak"
                        value={child.name}
                        onChange={(e) => handleChildChange(idx, "name", e.target.value)}
                        className="w-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 text-xs"
                      />
                    </div>

                    {/* Child BirthDate */}
                    <div className="w-full sm:w-48">
                      <input
                        type="date"
                        value={child.birthDate}
                        onChange={(e) => handleChildChange(idx, "birthDate", e.target.value)}
                        className="w-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 text-xs font-mono"
                      />
                    </div>

                    {/* Delete Child Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveChild(idx)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg hover:text-rose-600 transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t dark:border-zinc-800 rounded-b-2xl flex items-center justify-between" id="employee-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-105 font-bold rounded-lg text-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            Simpan Data Pegawai
          </button>
        </div>

      </div>
    </div>
  );
}
