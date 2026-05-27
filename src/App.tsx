import { useState, useEffect, JSX } from "react";
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  auth, 
  db, 
  loginWithGoogle, 
  loginAnonymously,
  logoutUser, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { Employee, GOLONGAN_PNS, WhatsappTemplate } from "./types";
import { getDaysDifference, formatDateIndo } from "./utils/dateHelpers";

// Components
import DashboardStats from "./components/DashboardStats";
import EmployeeForm from "./components/EmployeeForm";
import EmployeeList from "./components/EmployeeList";
import ReminderAlerts from "./components/ReminderAlerts";
import ExcelImportExport from "./components/ExcelImportExport";

// Lucide Icons
import { 
  Award, 
  DollarSign, 
  Users, 
  Calendar, 
  AlertTriangle, 
  Smartphone, 
  LogOut, 
  Database,
  Briefcase,
  HelpCircle,
  Clock,
  CheckCircle,
  Sparkles,
  RefreshCw,
  FolderSync,
  MessageSquare
} from "lucide-react";

// Default system WhatsApp templates configuration
const DEFAULT_WAT_TEMPLATES: WhatsappTemplate[] = [
  {
    id: "pangkat",
    name: "Pengingat Kenaikan Pangkat (KPG)",
    content: "Halo Bpk/Ibu *{Nama}* (NIP: {NIP}), diinformasikan bahwa jadwal Kenaikan Pangkat Anda jatuh pada tanggal *{BatasTanggal}* ({SisaHari} hari lagi). Harap segera mempersiapkan berkas dinas yang diperlukan. Terima kasih.",
  },
  {
    id: "kgb",
    name: "Pengingat Kenaikan Gaji Berkala (KGB)",
    content: "Halo Bpk/Ibu *{Nama}* (NIP: {NIP}), diinformasikan bahwa jadwal Kenaikan Gaji Berkala (KGB) Anda jatuh pada tanggal *{BatasTanggal}* ({SisaHari} hari lagi). Terima kasih atas dedikasinya.",
  },
  {
    id: "anak-21",
    name: "Pengingat Batas Tunjangan Anak (21 Thn)",
    content: "Yth. Bpk/Ibu *{Nama}* (NIP: {NIP}), diinformasikan bahwa anak Anda *{NamaAnak}* akan menginjak usia 21 tahun pada *{BatasTanggal}* ({SisaHari} hari lagi). Agar tunjangan anak tetap berjalan pada gaji bulanan, mohon segera sampaikan Surat Keterangan Kuliah aktif ke bagian Administrasi.",
  },
  {
    id: "anak-over",
    name: "Audit Kelayakan Tunjangan Anak (> 21 Thn)",
    content: "Yth. Bpk/Ibu *{Nama}* (NIP: {NIP}), menginformasikan bahwa anak Anda *{NamaAnak}* saat ini sudah berusia {UsiaAnak} tahun. Mohon sampaikan pembaruan berkas Surat Keterangan Kuliah aktif agar tunjangan tidak dihentikan otomatis. Terima kasih.",
  }
];

const SHARED_OWNER_ID = "instansi_central_db";

export default function App(): JSX.Element {
  // Auth states (Configured for Silent Unified Cloud Mode)
  const [currentUser, setCurrentUser] = useState<any>({ uid: SHARED_OWNER_ID, isAnonymous: true });
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<any>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Core Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  
  // WhatsApp Templates core state
  const [templates, setTemplates] = useState<WhatsappTemplate[]>(DEFAULT_WAT_TEMPLATES);

  // Navigation / Tabs
  // "all" | "pangkat" | "kgb" | "anak-21" | "anak-over" | "data" | "cadangan"
  const [activeTab, setActiveTab] = useState("all"); 

  // Modal control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Settings
  const [alertThresholdDays, setAlertThresholdDays] = useState(90);

  // Direct configuration for unified cloud-server store
  useEffect(() => {
    setGuestMode(false);
    setAuthLoading(false);
  }, []);

  // Sync data
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser && !guestMode) {
      setEmployees([]);
      return;
    }

    setDbLoading(true);

    if (guestMode) {
      // Load from local storage
      const saved = localStorage.getItem("sipeka_local_employees");
      if (saved) {
        try {
          setEmployees(JSON.parse(saved));
        } catch (e) {
          console.error("Gagal membaca LocalStorage:", e);
        }
      } else {
        setEmployees([]);
      }
      setDbLoading(false);
      return;
    }

    // Auth is available, sync to Firestore
    try {
      const q = query(
        collection(db, "employees"), 
        where("ownerId", "==", SHARED_OWNER_ID)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Employee);
        });
        setEmployees(list);
        setDbLoading(false);
      }, (error) => {
        // Log clean error payload mapping to rules
        handleFirestoreError(error, OperationType.LIST, "employees");
        setDbLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Firestore sync error:", err);
      setDbLoading(false);
    }
  }, [currentUser, guestMode, authLoading]);

  // Sync WhatsApp Templates
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser && !guestMode) {
      setTemplates(DEFAULT_WAT_TEMPLATES);
      return;
    }

    if (guestMode) {
      const saved = localStorage.getItem("sipeka_local_whatsapp_templates");
      if (saved) {
        try {
          setTemplates(JSON.parse(saved));
        } catch (e) {
          console.error(e);
          setTemplates(DEFAULT_WAT_TEMPLATES);
        }
      } else {
        setTemplates(DEFAULT_WAT_TEMPLATES);
      }
    } else if (currentUser) {
      const q = query(
        collection(db, "whatsapp_templates"),
        where("ownerId", "==", SHARED_OWNER_ID)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loaded: any[] = [];
        snapshot.forEach((doc) => {
          loaded.push({ id: doc.id, ...doc.data() });
        });
        
        // If snapshot is empty, populate with default templates under this owner
        if (loaded.length === 0) {
          // Trigger saving default templates in firestore
          DEFAULT_WAT_TEMPLATES.forEach(async (t) => {
            try {
              await setDoc(doc(db, "whatsapp_templates", `${SHARED_OWNER_ID}_${t.id}`), {
                id: t.id,
                name: t.name,
                content: t.content,
                ownerId: SHARED_OWNER_ID,
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              console.error("Error creating default template in firestore:", err);
            }
          });
          setTemplates(DEFAULT_WAT_TEMPLATES);
        } else {
          // Map loaded items
          const mapped = DEFAULT_WAT_TEMPLATES.map(def => {
            const found = loaded.find(item => item.id === `${SHARED_OWNER_ID}_${def.id}` || item.id === def.id || item.id.endsWith(def.id));
            return {
              id: def.id,
              name: def.name,
              content: found ? found.content : def.content
            };
          });
          setTemplates(mapped);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, "whatsapp_templates");
      });
      return () => unsubscribe();
    }
  }, [currentUser, guestMode, authLoading]);

  const handleSaveTemplate = async (templateId: string, content: string) => {
    const updated = templates.map(t => t.id === templateId ? { ...t, content } : t);
    setTemplates(updated);

    if (guestMode) {
      localStorage.setItem("sipeka_local_whatsapp_templates", JSON.stringify(updated));
      alert("Template berhasil disimpan secara lokal!");
    } else if (currentUser) {
      setDbLoading(true);
      try {
        const target = templates.find(t => t.id === templateId);
        if (target) {
          await setDoc(doc(db, "whatsapp_templates", `${SHARED_OWNER_ID}_${templateId}`), {
            id: templateId,
            name: target.name,
            content: content,
            ownerId: SHARED_OWNER_ID,
            updatedAt: new Date().toISOString()
          });
          alert("Template berhasil disimpan ke Cloud Database!");
        }
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, "whatsapp_templates");
      } finally {
        setDbLoading(false);
      }
    }
  };

  // Load Demo/Mock PNS Data
  const loadDemoData = async () => {
    const demoList: Omit<Employee, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: "Drs. Hendra Permana",
        nip: "197904122002031002",
        birthDate: "1979-04-12",
        currentRank: "IV/a",
        maxRankReached: false,
        lastPromotionDate: "2022-04-01", // KPG Overdue (passed 4 years on Apr 27, 2026)
        children: [
          { name: "Siti Rahma Permana", birthDate: "2005-06-15" }, // Age 20 yr 11 mo -> Turning 21 soon!
          { name: "Budi Permana", birthDate: "2002-12-10" }  // Age 23 -> Over 21!
        ]
      },
      {
        name: "Rina Amalia, S.Sos.",
        nip: "198511222010122001",
        birthDate: "1985-11-22",
        currentRank: "III/c",
        maxRankReached: false,
        lastPromotionDate: "2024-04-01", // Next promotion is 2028. But KGB is 2 years (2026-04-01 -> Overdue!)
        children: [
          { name: "Ahmad Dani", birthDate: "2012-08-05" } // Age 13 -> safe
        ]
      },
      {
        name: "Ir. Achmad Fauzi, M.T.",
        nip: "197603152003121004",
        birthDate: "1976-03-15",
        currentRank: "IV/b",
        maxRankReached: true, // No promotion alarms!
        lastPromotionDate: "2023-10-01", // KGB is 2 years (2025-10-01 -> Overdue!)
        children: [
          { name: "Rizky Fauzi", birthDate: "2005-01-20" }, // Age 21 -> Over 21
          { name: "Dina Fauzi", birthDate: "2009-02-14" }   // Age 17 -> safe
        ]
      }
    ];

    if (guestMode) {
      const generated: Employee[] = demoList.map((d, index) => ({
        ...d,
        id: `local-demo-${index}`,
        ownerId: "guest",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      setEmployees(generated);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(generated));
      alert("Berhasil memuat 3 PNS data demo ke Local Storage!");
    } else if (currentUser) {
      try {
        setDbLoading(true);
        const batch = writeBatch(db);
        
        demoList.forEach((d) => {
          const newDocRef = doc(collection(db, "employees"));
          const payload: Employee = {
            ...d,
            id: newDocRef.id,
            ownerId: SHARED_OWNER_ID,
            createdAt: new Date().toISOString(), // Fallback strings matching valid schemas
            updatedAt: new Date().toISOString()
          };
          batch.set(newDocRef, payload);
        });

        await batch.commit();
        alert("Berhasil memuat 3 PNS data demo ke akun Cloud Firestore!");
      } catch (error) {
        console.error("Gagal memuat batch data ke Cloud:", error);
        alert("Terjadi kesalahan memuat data ke Cloud Server. Periksa hak akses.");
      } finally {
        setDbLoading(false);
      }
    }
  };

  // Create or Update single record
  const handleSaveEmployee = async (employeeData: Partial<Employee>) => {
    setIsFormOpen(false);

    const isEdit = !!selectedEmployee;
    const currentOwner = SHARED_OWNER_ID;

    if (guestMode) {
      let updatedList = [...employees];
      if (isEdit && selectedEmployee) {
        updatedList = employees.map(emp => 
          emp.id === selectedEmployee.id 
            ? { ...emp, ...employeeData, updatedAt: new Date().toISOString() } as Employee
            : emp
        );
      } else {
        const newLocalEmp: Employee = {
          ...employeeData,
          id: `local-emp-${Date.now()}`,
          ownerId: "guest",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Employee;
        updatedList.push(newLocalEmp);
      }
      setEmployees(updatedList);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(updatedList));
      alert(isEdit ? "Perubahan data PNS berhasil disimpan!" : "PNS Baru berhasil terdaftar!");
      return;
    }

    // Firebase write flow
    if (!currentUser) return;

    try {
      setDbLoading(true);
      const targetId = isEdit && selectedEmployee ? selectedEmployee.id : doc(collection(db, "employees")).id;
      const targetDocRef = doc(db, "employees", targetId);

      const payload: Record<string, any> = {
        ...employeeData,
        id: targetId,
        ownerId: currentOwner,
        updatedAt: new Date().toISOString() // server timestamp standard
      };

      if (!isEdit) {
        payload.createdAt = new Date().toISOString();
      } else {
        payload.createdAt = selectedEmployee.createdAt;
      }

      // Remove undefined values to prevent Firestore unsupported field value errors
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(targetDocRef, payload);
      alert(isEdit ? "Dokumen berhasil diperbarui di Cloud Firestore!" : "Pegawai berhasil ditambahkan ke Cloud Server!");
    } catch (error) {
      handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, `employees/${selectedEmployee?.id || 'new'}`);
      alert("Gagal menyimpan ke server Firestore. Pastikan otorisasi Anda valid.");
    } finally {
      setDbLoading(false);
    }
  };

  // Delete single record
  const handleDeleteEmployee = async (id: string) => {
    if (guestMode) {
      const updatedList = employees.filter(emp => emp.id !== id);
      setEmployees(updatedList);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(updatedList));
      alert("Pegawai berhasil dihapus!");
      return;
    }

    if (!currentUser) return;

    try {
      setDbLoading(true);
      await deleteDoc(doc(db, "employees", id));
      alert("Pegawai berhasil dihapus dari Cloud Server.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employees/${id}`);
      alert("Gagal menghapus berkas di server.");
    } finally {
      setDbLoading(false);
    }
  };

  // Batch CSV Import logic
  const handleImportCSVData = async (importedList: Partial<Employee>[]) => {
    const defaultOwner = SHARED_OWNER_ID;

    if (guestMode) {
      const formatted: Employee[] = importedList.map((emp, index) => ({
        ...emp,
        id: `local-imported-${Date.now()}-${index}`,
        ownerId: "guest",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) as Employee[];

      const combined = [...employees, ...formatted];
      setEmployees(combined);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(combined));
      return;
    }

    if (!currentUser) return;

    try {
      setDbLoading(true);
      const batch = writeBatch(db);

      importedList.forEach((emp) => {
        const newDocRef = doc(collection(db, "employees"));
        const payload: Employee = {
          ...emp,
          id: newDocRef.id,
          ownerId: defaultOwner,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Employee;
        batch.set(newDocRef, payload);
      });

      await batch.commit();
    } catch (error) {
      console.error("Batch CSV import error:", error);
      alert("Terjadi kegagalan penulisan database. Hubungi admin.");
    } finally {
      setDbLoading(false);
    }
  };

  // Action: Quick process Promotion (KPG)
  const handlePromoteSuccess = async (id: string, nextRank: string, promoteDate: string) => {
    const empToPromote = employees.find(e => e.id === id);
    if (!empToPromote) return;

    const updatedData: Partial<Employee> = {
      currentRank: nextRank,
      lastPromotionDate: promoteDate,
      // Reset custom KGB override so it recalculates from the new promo date
      lastKgbDate: ""
    };

    if (guestMode) {
      const updatedList = employees.map(e => e.id === id ? { ...e, ...updatedData, updatedAt: new Date().toISOString() } : e);
      setEmployees(updatedList);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(updatedList));
      alert(`Selamat! Drs/${empToPromote.name} naik pangkat ke ${nextRank}.`);
      return;
    }

    try {
      setDbLoading(true);
      const payload = {
        ...empToPromote,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      
      // Remove undefined values to prevent Firestore unsupported field value errors
      Object.keys(payload).forEach(key => {
        if ((payload as any)[key] === undefined) {
          delete (payload as any)[key];
        }
      });

      await setDoc(doc(db, "employees", id), payload);
      alert(`Kenaikan pangkat ${empToPromote.name} berhasil disimpan di Cloud.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
    } finally {
      setDbLoading(false);
    }
  };

  // Action: Quick process KGB
  const handleKgbSuccess = async (id: string, kgbDate: string) => {
    const empKgb = employees.find(e => e.id === id);
    if (!empKgb) return;

    const updatedData = {
      lastKgbDate: kgbDate
    };

    if (guestMode) {
      const updatedList = employees.map(e => e.id === id ? { ...e, ...updatedData, updatedAt: new Date().toISOString() } : e);
      setEmployees(updatedList);
      localStorage.setItem("sipeka_local_employees", JSON.stringify(updatedList));
      alert(`KGB selesai dicatatkan untuk ${empKgb.name}.`);
      return;
    }

    try {
      setDbLoading(true);
      const payload = {
        ...empKgb,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };

      // Remove undefined values to prevent Firestore unsupported field value errors
      Object.keys(payload).forEach(key => {
        if ((payload as any)[key] === undefined) {
          delete (payload as any)[key];
        }
      });

      await setDoc(doc(db, "employees", id), payload);
      alert(`Berkas kenaikan gaji berkala ${empKgb.name} berhasil di-upload.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
    } finally {
      setDbLoading(false);
    }
  };

  const openAddModal = () => {
    setSelectedEmployee(null);
    setIsFormOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsFormOpen(true);
  };

  // Direct Dashboard Navigation: Loading & Landing are bypassed

  // MAIN PRIVATE LAYOUT (Logged In OR Guest Mode)
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans flex flex-col" id="app-private-root">
      
      {/* Upper Navigation Bar */}
      <header className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-850 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-40 shadow-xs" id="main-app-header">
        
        {/* Brand */}
        <div className="flex items-center gap-3 w-full sm:w-auto text-left">
          <div className="w-9 h-9 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl flex items-center justify-center font-black text-sm relative">
            S
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-white"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white uppercase font-mono">
                Sipeka Pegawai
              </h1>
              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
                CLOUD FIRESTORE
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Data sinkron otomatis dan tersimpan aman di Cloud Database Instansi
            </p>
          </div>
        </div>

        {/* Dynamic Nav Tabs */}
        <nav className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl w-full sm:w-auto overflow-x-auto" id="main-nav">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              ["all", "pangkat", "kgb", "anak-21", "anak-over"].includes(activeTab)
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Dashboard Monitoring
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "data"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Manajemen Pegawai
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "whatsapp"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Template Pesan WA
          </button>
          <button
            onClick={() => setActiveTab("cadangan")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "cadangan"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Pindahkan CSV
          </button>
        </nav>

      {/* User Badge Controls */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 dark:border-zinc-850">
        <div className="text-right text-xs">
          <span className="font-bold block text-zinc-900 dark:text-white truncate max-w-[140px]">
            Portal Instansi (Shared)
          </span>
          <span className="text-[10px] text-emerald-500 font-semibold block flex items-center justify-end gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Koneksi Cloud Aktif
          </span>
        </div>
      </div>

      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8" id="private-main-body">
        
        {dbLoading && (
          <div className="p-3 bg-zinc-900 text-white rounded-xl text-xs font-mono flex items-center gap-2 justify-center shadow-md animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            <span>Menghubungi Cloud Server - Menyinkronkan Perubahan Database...</span>
          </div>
        )}

        {/* 1. VIEW A: DASHBOARD AND MONITOR ALERTS */}
        {["all", "pangkat", "kgb", "anak-21", "anak-over"].includes(activeTab) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            
            {/* Stats */}
            <DashboardStats 
              employees={employees} 
              activeTab={activeTab} 
              setActiveTab={(tab) => {
                // If it's "all" or specific categories, keep on dashboard, else toggle views
                setActiveTab(tab);
              }}
              alertThresholdDays={alertThresholdDays}
            />

            {/* If no employees registered yet, show seed action callout */}
            {employees.length === 0 && (
              <div className="p-10 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                  <FolderSync className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                    Database Pegawai Masih Kosong
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Mulai petualangan Anda dengan memuat contoh 3 data pegawai fiktif (PNS) dengan data umur anak dan pangkat dinas yang unik untuk simulasi alarm.
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={openAddModal}
                    className="text-xs px-4 py-2 bg-zinc-950 hover:bg-zinc-850 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-lg transition-all"
                  >
                    + Tambah Pegawai Pertama
                  </button>
                  <button
                    onClick={loadDemoData}
                    className="text-xs px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 font-bold rounded-lg transition-all"
                  >
                    Muat 3 PNS Demo
                  </button>
                </div>
              </div>
            )}

            {/* List and descriptions */}
            {employees.length > 0 && (
              <ReminderAlerts 
                employees={employees}
                activeCategory={activeTab}
                alertThresholdDays={alertThresholdDays}
                onPromoteSuccess={handlePromoteSuccess}
                onKgbSuccess={handleKgbSuccess}
                templates={templates}
              />
            )}

          </div>
        )}

        {/* 2. VIEW B: EMPLOYEE LIST WORKSPACE */}
        {activeTab === "data" && (
          <div className="animate-in fade-in duration-200">
            <EmployeeList 
              employees={employees} 
              onEdit={openEditModal} 
              onDelete={handleDeleteEmployee} 
              openAddModal={openAddModal}
              loadDemoData={loadDemoData}
            />
          </div>
        )}

        {/* 3. VIEW C: BACKUP & INTEGRATIONS */}
        {activeTab === "cadangan" && (
          <div className="animate-in fade-in duration-200">
            <ExcelImportExport 
              employees={employees} 
              onImportSuccess={handleImportCSVData} 
            />
          </div>
        )}

        {/* 4. VIEW D: WHATSAPP TEMPLATES EDITOR */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6 animate-in fade-in duration-200 text-left">
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 rounded-lg">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Templat Pemberitahuan WhatsApp
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Tulis templat pesan WhatsApp otomatis yang dikirim ke pegawai saat alarm berbunyi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {templates.map((t) => (
                  <div key={t.id} className="border dark:border-zinc-800 p-5 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col space-y-4">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white mb-1 block">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        ID: <span className="font-mono font-bold">{t.id}</span>
                      </span>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                        Isi Pesan Templat
                      </label>
                      <textarea
                        rows={5}
                        value={t.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemplates(templates.map(orig => orig.id === t.id ? { ...orig, content: val } : orig));
                        }}
                        className="w-full p-3 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-150 font-sans focus:outline-hidden focus:ring-1 focus:ring-zinc-400 focus:border-zinc-450 leading-relaxed"
                        placeholder="Tulis pesan Anda..."
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mr-1">Parameter:</span>
                      <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{Nama}"}</code>
                      <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{NIP}"}</code>
                      <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{Pangkat}"}</code>
                      {(t.id === "pangkat" || t.id === "kgb" || t.id === "anak-21") && (
                        <>
                          <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{BatasTanggal}"}</code>
                          <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{SisaHari}"}</code>
                        </>
                      )}
                      {(t.id === "anak-21" || t.id === "anak-over") && (
                        <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{NamaAnak}"}</code>
                      )}
                      {t.id === "anak-over" && (
                        <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-mono">{"{UsiaAnak}"}</code>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t dark:border-zinc-850/60 mt-auto">
                      <span className="text-[10px] text-zinc-400 italic">
                        Mendukung tebal (*) & miring (_).
                      </span>
                      <button
                        onClick={() => handleSaveTemplate(t.id, t.content)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        Simpan Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Slide Modal Editor for creating/modifying Employees */}
      {isFormOpen && (
        <EmployeeForm 
          employee={selectedEmployee} 
          onSave={handleSaveEmployee} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}

      {/* Footer bar */}
      <footer className="py-8 bg-white dark:bg-zinc-950 border-t dark:border-zinc-900 text-center text-xs text-zinc-400 mt-auto">
        <p>Aplikasi Sipeka PNS &copy; 2026. Dioptimalkan untuk administrator pengelola gaji sipil.</p>
        <div className="flex gap-4 items-center justify-center mt-2 text-[10px]">
        <span>Penyimpanan: Local Storage Browser (Aktif)</span>
        <span>&bull;</span>
          <span>Batas Usia Anak Tunjangan: 21 Tahun (Bisa s/d 25 kuliah)</span>
          <span>&bull;</span>
          <span>Siklus KPG: 4 Tahun</span>
          <span>&bull;</span>
          <span>Siklus KGB: 2 Tahun</span>
        </div>
      </footer>

    </div>
  );
}
