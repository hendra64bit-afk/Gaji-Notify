import { useState, JSX, DragEvent, ChangeEvent } from "react";
import { Download, Upload, Copy, Check, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { Employee, Child } from "../types";

interface ExcelImportExportProps {
  employees: Employee[];
  onImportSuccess: (imported: Partial<Employee>[]) => void;
}

export default function ExcelImportExport({
  employees,
  onImportSuccess,
}: ExcelImportExportProps): JSX.Element {
  const [csvText, setCsvText] = useState("");
  const [importFeedback, setImportFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    if (!file) return;
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportFeedback("Format berkas harus berupa CSV (.csv)!");
      return;
    }

    setFileName(file.name);
    setImportFeedback("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setCsvText(text);
        setImportFeedback(`Berkas "${file.name}" berhasil dimuat! Silakan tinjau data di bawah ini atau klik tombol "Proses Unggahan" untuk memasukkan data.`);
      }
    };
    reader.onerror = () => {
      setImportFeedback("Gagal membaca berkas CSV!");
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const sampleCsvHeader = "NIP,NAMA,GOLONGAN,TANGGAL_LAHIR,BATAS_PANGKAT_MAKSIMAL,TANGGAL_KENAIKAN_PANGKAT,ANAK_1_NAMA,ANAK_1_LAHIR,ANAK_2_NAMA,ANAK_2_LAHIR";
  const sampleCsvRow = "198511222010032001,Rina Amalia,S.Kom,III/c,1985-11-22,false,2024-04-01,Ahmad Dani,2012-08-05,Siti Aminah,2016-10-12";
  const sampleCsvContent = `${sampleCsvHeader}\n${sampleCsvRow}`;

  // Export to CSV function
  const handleExportCSV = () => {
    if (employees.length === 0) {
      alert("Tidak ada data pegawai untuk diekspor!");
      return;
    }

    let csvContent = "NIP,NAMA,GOLONGAN,TANGGAL_LAHIR,BATAS_PANGKAT_MAKSIMAL,TANGGAL_KENAIKAN_PANGKAT,TANGGAL_KGB";
    
    // Find the max number of children to build dynamic headers
    let maxChildren = 0;
    employees.forEach(emp => {
      const childCount = emp.children?.length || 0;
      if (childCount > maxChildren) maxChildren = childCount;
    });

    for (let i = 1; i <= maxChildren; i++) {
      csvContent += `,ANAK_${i}_NAMA,ANAK_${i}_LAHIR`;
    }
    csvContent += "\n";

    // Add rows
    employees.forEach(emp => {
      const isMaxRank = emp.maxRankReached ? "true" : "false";
      let row = `"${emp.nip}","${emp.name}","${emp.currentRank}","${emp.birthDate}","${isMaxRank}","${emp.lastPromotionDate}","${emp.lastKgbDate || ''}"`;
      
      for (let i = 0; i < maxChildren; i++) {
        if (emp.children && emp.children[i]) {
          row += `,"${emp.children[i].name}","${emp.children[i].birthDate}"`;
        } else {
          row += `,"",""`;
        }
      }
      csvContent += row + "\n";
    });

    // Download flow
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `daftar_peringatan_kepegawaian_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import from CSV text
  const handleImportCSV = () => {
    setImportFeedback("");
    if (!csvText.trim()) {
      setImportFeedback("Silakan masukkan teks berkas CSV terlebih dahulu");
      return;
    }

    try {
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        setImportFeedback("Format berkas CSV salah: Baris data tidak ditemukan!");
        return;
      }

      const header = lines[0].split(",");
      const importedList: Partial<Employee>[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Handle quotes in CSV columns
        const csvRegex = /("([^"]*)"|([^,]*))(,|$)/g;
        const matches = [...lines[i].matchAll(csvRegex)];
        const cols: string[] = [];
        
        matches.forEach(m => {
          if (m[2] !== undefined) {
            cols.push(m[2]);
          } else if (m[3] !== undefined) {
            cols.push(m[3]);
          }
        });
        
        // Remove trailing match column which is always empty due to regex matches
        if (cols.length > 0 && cols[cols.length - 1] === "") {
          cols.pop();
        }

        if (cols.length < 5) {
          continue; // skip empty or incomplete lines
        }

        const nip = cols[0].trim();
        const name = cols[1].trim();
        const currentRank = cols[2].trim() || "III/a";
        const birthDate = cols[3].trim();
        const maxRankReached = cols[4].trim().toLowerCase() === "true";
        const lastPromotionDate = cols[5].trim();
        const lastKgbDate = cols[6]?.trim() || "";

        // Collect children
        const children: Child[] = [];
        // Children start from parameter column index 7 onwards
        for (let colIdx = 7; colIdx < cols.length; colIdx += 2) {
          const childName = cols[colIdx]?.trim();
          const childBirthStr = cols[colIdx + 1]?.trim();
          if (childName && childBirthStr) {
            children.push({
              name: childName,
              birthDate: childBirthStr
            });
          }
        }

        importedList.push({
          nip,
          name,
          currentRank,
          birthDate,
          maxRankReached,
          lastPromotionDate,
          lastKgbDate: lastKgbDate || undefined,
          children
        });
      }

      if (importedList.length === 0) {
        setImportFeedback("Format CSV salah atau tidak ada baris yang memenuhi kriteria pengimporan.");
        return;
      }

      onImportSuccess(importedList);
      setImportFeedback(`Berhasil mengimpor ${importedList.length} pegawai PNS ke database!`);
      setCsvText("");
      setFileName("");
    } catch (err) {
      setImportFeedback(`Gagal membaca berkas CSV. Periksa kesalahan tanda baca/koma.`);
      console.error(err);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(sampleCsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm p-6 text-left" id="panel-import-export">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="w-5 h-5 text-zinc-700" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          Pengimporan & Ekspor Data Excel/CSV
        </h3>
      </div>

      <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
        Pindahkan data dengan mudah antara aplikasi ini dan Microsoft Excel atau Google Sheets. 
        Ekspor seluruh database ke dalam berkas .csv yang dapat dibuka di lembar kerja Anda, atau impor kembali data baru.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left column: EXPORT MODULE */}
        <div className="p-5 bg-zinc-50 dark:bg-zinc-950/20 border dark:border-zinc-850 rounded-xl flex flex-col justify-between" id="sub-panel-export">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider block">
                Ekspor Data ke Berkas CSV
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-zinc-800 dark:text-blue-300 px-2 py-0.5 rounded-sm font-semibold">
                Saran
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              Semua baris pegawai PNS aktif saat ini beserta datatabel tanggungan anak akan diunduh ke bentuk berkas .csv terstruktur. 
              Sangat cocok untuk membuat cadangan berkas mandiri.
            </p>
          </div>

          <div className="mt-4">
            <button
              onClick={handleExportCSV}
              disabled={employees.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border text-xs font-bold transition-all ${
                employees.length === 0
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 cursor-not-allowed"
                  : "bg-zinc-950 dark:bg-white dark:text-zinc-900 hover:bg-zinc-850 border-transparent text-white cursor-pointer shadow-xs"
              }`}
            >
              <Download className="w-4 h-4" /> Unduh Database CSV ({employees.length} Pegawai)
            </button>
          </div>
        </div>

        {/* Right column: IMPORT MODULE */}
        <div className="space-y-4" id="sub-panel-import">
          <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider block">
            Impor Data Kepegawaian Baru
          </span>

          {/* Interactive Drag & Drop File Picker */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
              dragActive 
                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
                : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-600 dark:hover:border-emerald-500 bg-zinc-50/30 dark:bg-zinc-950/10"
            }`}
          >
            <input
              id="csv-file-picker"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="csv-file-picker" className="w-full h-full cursor-pointer flex flex-col items-center justify-center">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-2 text-zinc-600 dark:text-zinc-400">
                <Upload className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                {fileName ? fileName : "Pilih Berkas CSV atau seret ke sini"}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                {fileName ? "Klik untuk memilih berkas pengganti" : "Hanya mendukung berkas .csv dengan pemisah koma"}
              </span>
            </label>
          </div>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/40 border dark:border-zinc-850 rounded-xl text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-zinc-400 font-bold">
                CONTOH FORMAT KOLOM CSV
              </span>
              <button
                onClick={copyTemplate}
                className="text-[10px] text-zinc-500 hover:text-zinc-850 flex items-center gap-1 transition-colors font-bold cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Tersalin!" : "Salin Kerangka"}
              </button>
            </div>
            <pre className="text-[9px] font-mono text-zinc-400 overflow-x-auto bg-zinc-100 dark:bg-zinc-900/60 p-2.5 rounded-sm">
              {sampleCsvContent}
            </pre>
            <span className="text-[9px] text-zinc-400 mt-2 block leading-snug">
              Pastikan tanggal lahir dan kenaikan pangkat berformat YYYY-MM-DD (contoh: 1985-11-22).
            </span>
          </div>

          {/* Import text input fields */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-450 uppercase mb-1">
              Pratinjau / Input Teks CSV Manual
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Atau tempel baris CSV di sini secara manual..."
              className="w-full p-3 border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-xl focus:outline-hidden focus:ring-1 focus:ring-zinc-400 font-mono text-xs"
            ></textarea>
          </div>

          {importFeedback && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-950/50 text-xs flex gap-2 items-center">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{importFeedback}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleImportCSV}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border dark:border-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Proses Unggahan
            </button>
            {(csvText || fileName) && (
              <button
                onClick={() => {
                  setCsvText("");
                  setFileName("");
                  setImportFeedback("");
                }}
                className="px-3 border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
