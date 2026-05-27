import { useState, JSX } from "react";
import { Search, Edit2, Trash2, ShieldAlert, Award, AlertCircle, FileSpreadsheet, ChevronRight, HelpCircle } from "lucide-react";
import { Employee, GOLONGAN_PNS } from "../types";
import { formatDateIndo, calculateAge } from "../utils/dateHelpers";

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
  openAddModal: () => void;
  loadDemoData: () => void;
}

export default function EmployeeList({
  employees,
  onEdit,
  onDelete,
  openAddModal,
  loadDemoData
}: EmployeeListProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRankFilter, setSelectedRankFilter] = useState("");

  // Filter lists
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.nip.includes(searchTerm);
    const matchesRank =
      selectedRankFilter === "" || emp.currentRank === selectedRankFilter;
    return matchesSearch && matchesRank;
  });

  return (
    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden" id="employee-list-card">
      
      {/* List Header Actions */}
      <div className="p-5 border-b dark:border-zinc-800 flex flex-col md:flex-row gap-4 items-center justify-between" id="employee-list-header">
        <div className="flex flex-col text-left w-full md:w-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            Daftar Pegawai Terdaftar ({filteredEmployees.length})
          </h3>
          <p className="text-xs text-zinc-500">
            Cari, saring, dan kelola profil kepegawaian
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {employees.length === 0 && (
            <button
              onClick={loadDemoData}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 font-semibold rounded-lg hover:bg-amber-100 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Muat Data Demo
            </button>
          )}
          <button
            onClick={openAddModal}
            className="text-xs px-4 py-2 bg-zinc-950 hover:bg-zinc-850 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white font-bold rounded-lg transition-all shadow-xs cursor-pointer"
          >
            + Tambah Pegawai
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-50/50 dark:bg-zinc-950/25 p-4 border-b dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3" id="employee-list-filters">
        
        {/* Search */}
        <div className="relative md:col-span-2">
          <span className="absolute left-3 top-2.5 text-zinc-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama pegawai atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-850 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 text-xs transition-all"
          />
        </div>

        {/* Dropdown Rank */}
        <div>
          <select
            value={selectedRankFilter}
            onChange={(e) => setSelectedRankFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-850 text-zinc-900 dark:text-white rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-400 text-xs transition-all"
          >
            <option value="">Semua Golongan/Pangkat</option>
            {GOLONGAN_PNS.map((g) => (
              <option key={g.code} value={g.code}>
                Golongan {g.code} ({g.name})
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Main Table view */}
      <div className="overflow-x-auto" id="employee-list-table-wrapper">
        {filteredEmployees.length === 0 ? (
          <div className="py-12 px-4 text-center" id="empty-state">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Tidak ada pegawai ditemukan
            </p>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              {employees.length === 0 
                ? "Mulai dengan menambahkan data pegawai baru atau memuat data demo pengujian." 
                : "Ubah kata kunci pencarian atau saringan golongan Anda."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[700px] border-collapse text-left text-xs" id="employee-list-table">
            <thead className="bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 uppercase tracking-wider border-b dark:border-zinc-800 font-bold">
              <tr>
                <th className="px-6 py-3.5">Biodata Pegawai</th>
                <th className="px-6 py-3.5">Golongan & Pangkat</th>
                <th className="px-6 py-3.5">KPG Terakhir</th>
                <th className="px-6 py-3.5">Tanggungan Anak</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {filteredEmployees.map((emp) => {
                const ageInfo = calculateAge(emp.birthDate);
                const childrenCount = emp.children?.length || 0;
                
                return (
                  <tr 
                    key={emp.id} 
                    id={`row-${emp.id}`}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/10 transition-colors"
                  >
                    {/* Basic Info */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {emp.name}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 mt-0.5">
                          NIP: {emp.nip}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                          Born {formatDateIndo(emp.birthDate)} ({ageInfo.years} Thn)
                        </span>
                      </div>
                    </td>

                    {/* Golongan/Rank */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-sm font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {emp.currentRank}
                          </span>
                          {emp.maxRankReached && (
                            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-full font-semibold">
                              Mentok
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1">
                          {GOLONGAN_PNS.find(g => g.code === emp.currentRank)?.name || "-"}
                        </span>
                      </div>
                    </td>

                    {/* Promotion Date */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {formatDateIndo(emp.lastPromotionDate)}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-0.5">
                          KPG Terakhir
                        </span>
                      </div>
                    </td>

                    {/* Children count / breakdown */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {childrenCount} Anak
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {childrenCount > 0 ? (
                            emp.children.slice(0, 2).map((child, cIdx) => {
                              const childAge = calculateAge(child.birthDate);
                              return (
                                <span 
                                  key={cIdx} 
                                  title={`${child.name} (${childAge.years} Thn)`}
                                  className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 rounded-xs truncate max-w-[100px]"
                                >
                                  {child.name.split(" ")[0]} ({childAge.years} yr)
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-zinc-400">Tidak ada tanggungan</span>
                          )}
                          {childrenCount > 2 && (
                            <span className="text-[9px] font-semibold text-zinc-400">
                              +{childrenCount - 2} lagi
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(emp)}
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-650 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg transition-all cursor-pointer border border-zinc-200 dark:border-zinc-850"
                          title="Ubah Profil Pegawai"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Hapus data pegawai "${emp.name}"? Semua riwayat monitoring akan hilang.`)) {
                              onDelete(emp.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg hover:text-rose-600 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-850 hover:border-rose-100"
                          title="Hapus Pegawai"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
  );
}
