import { JSX } from "react";
import { Users, Award, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { Employee } from "../types";
import { getPromotionAlerts, getKgbAlerts, getChildrenAlerts } from "../utils/dateHelpers";

interface DashboardStatsProps {
  employees: Employee[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  alertThresholdDays: number;
}

export default function DashboardStats({ 
  employees, 
  activeTab, 
  setActiveTab,
  alertThresholdDays
}: DashboardStatsProps): JSX.Element {
  
  // Calculations
  const totalEmployees = employees.length;
  
  const promotionAlerts = getPromotionAlerts(employees, new Date(), alertThresholdDays);
  const activePromotionWarnings = promotionAlerts.filter(p => p.status === "overdue" || p.status === "critical" || p.status === "upcoming").length;
  const overduePromotionCount = promotionAlerts.filter(p => p.status === "overdue").length;

  const kgbAlerts = getKgbAlerts(employees, new Date(), alertThresholdDays);
  const activeKgbWarnings = kgbAlerts.filter(k => k.status === "overdue" || k.status === "critical" || k.status === "upcoming").length;
  const overdueKgbCount = kgbAlerts.filter(k => k.status === "overdue").length;

  const { turning21, over21 } = getChildrenAlerts(employees, new Date());
  
  const stats = [
    {
      id: "all",
      title: "Total Pegawai",
      value: totalEmployees,
      description: "Pegawai aktif terdaftar",
      icon: Users,
      color: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-zinc-900 dark:text-blue-400 dark:border-zinc-800",
      accent: "text-blue-600 dark:text-blue-400"
    },
    {
      id: "pangkat",
      title: "Peringatan Kenaikan Pangkat",
      value: activePromotionWarnings,
      description: overduePromotionCount > 0 ? `${overduePromotionCount} Terlambat` : "Perlu tindak lanjut pangkat",
      icon: Award,
      color: activePromotionWarnings > 0 
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" 
        : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
      accent: activePromotionWarnings > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""
    },
    {
      id: "kgb",
      title: "Kenaikan Gaji Berkala (KGB)",
      value: activeKgbWarnings,
      description: overdueKgbCount > 0 ? `${overdueKgbCount} Terlambat` : "Jadwal 2 tahunan",
      icon: DollarSign,
      color: activeKgbWarnings > 0 
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
        : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
      accent: activeKgbWarnings > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""
    },
    {
      id: "anak-21",
      title: "Anak Menjelang 21 Thn",
      value: turning21.length,
      description: "Menginjak usia 21 tahun",
      icon: Calendar,
      color: turning21.length > 0 
        ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30" 
        : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
      accent: turning21.length > 0 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""
    },
    {
      id: "anak-over",
      title: "Anak > 21 Tahun",
      value: over21.length,
      description: "Verifikasi tunjangan",
      icon: AlertTriangle,
      color: over21.length > 0 
        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" 
        : "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
      accent: over21.length > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : ""
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="dashboard-stats-grid">
      {stats.map((stat) => {
        const IconComponent = stat.icon;
        const isActive = activeTab === stat.id;
        
        return (
          <button
            key={stat.id}
            id={`stat-card-${stat.id}`}
            onClick={() => setActiveTab(stat.id)}
            className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${
              isActive 
                ? "ring-2 ring-primary-500 scale-102 border-zinc-300 shadow bg-white dark:bg-zinc-800 dark:border-zinc-700" 
                : "bg-white hover:bg-zinc-50 hover:border-zinc-200 shadow-sm cursor-pointer dark:bg-zinc-900 dark:hover:bg-zinc-800/50 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">
                {stat.title}
              </span>
              <div className={`p-2 rounded-lg border ${stat.color}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {stat.value}
              </span>
            </div>
            
            <span className={`text-xs mt-1 block truncate text-zinc-500 dark:text-zinc-400 ${stat.accent}`}>
              {stat.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
