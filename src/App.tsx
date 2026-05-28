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
  MessageSquare,
  Settings
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
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem("sipeka_guest_mode") === "true");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<any>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
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
  const [alertThresholdDays, setAlertThresholdDays] = useState(() => parseInt(localStorage.getItem("sipeka_alert_threshold") || "90") || 90);

  // Fonnte configurations
  const [fonnteToken, setFonnteToken] = useState(() => localStorage.getItem("sipeka_fonnte_token") || "");
  const [fonnteCode, setFonnteCode] = useState(() => localStorage.getItem("sipeka_fonnte_code") || "62");
  const [useFonnteAsDefault, setUseFonnteAsDefault] = useState(() => localStorage.getItem("sipeka_fonnte_default") === "true");

  // Direct configuration for unified cloud-server store
  useEffect(() => {
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
        setFirestoreError(null);
      }, (error) => {
        setDbLoading(false);
        const errMsg = error instanceof Error ? error.message : String(error);
        const isOfflineError = errMsg.includes("offline") || errMsg.includes("Could not reach Cloud Firestore") || errMsg.includes("Backend didn't respond") || errMsg.includes("failed-precondition") || errMsg.includes("network");
        
        if (isOfflineError) {
          console.warn("Firestore onSnapshot offline fallback: ", errMsg);
          setFirestoreError("Koneksi cloud offline (tidak dapat menjangkau server Firestore). Sistem otomatis beralih menggunakan basis data lokal offline.");
          
          // Switch flag of guestMode safely so that other components operate offline too
          setGuestMode(true);
          
          // Load from local storage
          const saved = localStorage.getItem("sipeka_local_employees");
          if (saved) {
            try {
              setEmployees(JSON.parse(saved));
            } catch (e) {
              console.error("Gagal membaca LocalStorage fallback:", e);
            }
          }
        } else {
          try {
            handleFirestoreError(error, OperationType.LIST, "employees");
          } catch (thrownErr: any) {
            setFirestoreError(thrownErr.message);
          }
        }
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
      }, (error) => {
        const errMsg = error instanceof Error ? error.message : String(error);
        const isOfflineError = errMsg.includes("offline") || errMsg.includes("Could not reach Cloud Firestore") || errMsg.includes("Backend didn't respond") || errMsg.includes("failed-precondition") || errMsg.includes("network");
        
        if (isOfflineError) {
          console.warn("Firestore templates sync offline: ", errMsg);
          
          const saved = localStorage.getItem("sipeka_local_whatsapp_templates");
          if (saved) {
            try {
              setTemplates(JSON.parse(saved));
            } catch (e) {
              console.error("Gagal membaca LocalStorage templates:", e);
              setTemplates(DEFAULT_WAT_TEMPLATES);
            }
          } else {
            setTemplates(DEFAULT_WAT_TEMPLATES);
          }
        } else {
          try {
            handleFirestoreError(error, OperationType.LIST, "whatsapp_templates");
          } catch (thrownErr: any) {
            setFirestoreError(thrownErr.message);
          }
        }
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
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 ${guestMode ? "bg-amber-500" : "bg-emerald-500"} rounded-full border border-white`}></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white uppercase font-mono">
                Sipeka Pegawai
              </h1>
              {guestMode ? (
                <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full font-bold uppercase">
                  Penyimpanan Lokal (Offline)
                </span>
              ) : (
                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full font-bold uppercase">
                  Cloud Firestore
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">
              {guestMode 
                ? "Bekerja secara offline menggunakan memori perangkat lokal Anda" 
                : "Data sinkron otomatis dan tersimpan aman di Cloud Database Instansi"}
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
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Pengaturan
          </button>
        </nav>

        {/* User Badge Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 dark:border-zinc-850">
          <div className="text-right text-xs">
            <span className="font-bold block text-zinc-900 dark:text-white truncate max-w-[140px]">
              Portal Instansi (Shared)
            </span>
            {guestMode ? (
              <span className="text-[10px] text-amber-500 font-semibold block flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                Mode Lokal (Offline)
              </span>
            ) : (
              <span className="text-[10px] text-emerald-500 font-semibold block flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Koneksi Cloud Aktif
              </span>
            )}
          </div>
        </div>

      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8" id="private-main-body">
        
        {/* Firestore Offline / Connection Error Alert Banner */}
        {firestoreError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <span className="font-bold block uppercase tracking-wide text-amber-800 dark:text-amber-300">Pemberitahuan Sistem (Offline / Kendala Koneksi)</span>
                <p className="text-zinc-550 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Aplikasi mendeteksi kendala dalam menyambung ke jaringan Cloud Firestore. Sistem otomatis mengaktifkan Penyimpanan Lokal Offline sehingga Anda tetap dapat memasukkan dan memodifikasi data kepegawaian Anda dengan lancar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => {
                  setGuestMode(true);
                  localStorage.setItem("sipeka_guest_mode", "true");
                  setFirestoreError(null);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all shadow-xs shrink-0 cursor-pointer whitespace-nowrap text-xs"
              >
                Gunakan Offline Lokal
              </button>
              <button
                onClick={() => {
                  setFirestoreError(null);
                  setDbLoading(true);
                  window.location.reload();
                }}
                className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-lg transition-all shrink-0 cursor-pointer whitespace-nowrap text-xs"
              >
                Coba Hubungkan Kembali
              </button>
            </div>
          </div>
        )}

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
                fonnteToken={fonnteToken}
                useFonnteAsDefault={useFonnteAsDefault}
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
            
            {/* INTEGRASI FONNTE GATEWAY */}
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 rounded-lg">
                    <Smartphone className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Integrasi Gateway WhatsApp - Fonnte
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Kirim pesan pengingat instan langsung ke nomor PNS melalui API Fonnte tanpa repot membuka WhatsApp Web.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wide">Fonnte API Ready</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                    API Token Fonnte
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan Token Fonnte..."
                    value={fonnteToken}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFonnteToken(val);
                      localStorage.setItem("sipeka_fonnte_token", val);
                    }}
                    className="w-full p-2.5 border border-zinc-250 dark:border-zinc-850 rounded-xl text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-zinc-450 mt-1">
                    Dapatkan dari menu dashboard di <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline font-semibold">fonnte.com</a>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                    Kode Negara Default
                  </label>
                  <input
                    type="text"
                    placeholder="62"
                    value={fonnteCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFonnteCode(val);
                      localStorage.setItem("sipeka_fonnte_code", val);
                    }}
                    className="w-full p-2.5 border border-zinc-250 dark:border-zinc-850 rounded-xl text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-450 mt-1">
                    Isi dengan <span className="font-mono">62</span> untuk Indonesia. Otomatis mengubah angka awalan <span className="font-mono">08xxx</span> ke <span className="font-mono">628xxx</span>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-1">
                    Opsi Pengiriman Utama
                  </label>
                  <div className="flex flex-col space-y-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-350 select-none">
                      <input
                        type="checkbox"
                        checked={useFonnteAsDefault}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setUseFonnteAsDefault(val);
                          localStorage.setItem("sipeka_fonnte_default", String(val));
                        }}
                        className="rounded-sm border-zinc-250 dark:border-zinc-800 text-emerald-600 cursor-pointer h-4 w-4 accent-emerald-500"
                      />
                      Gunakan Fonnte (Kirim Otomatis)
                    </label>
                    <p className="text-[10px] text-zinc-450">
                      Jika dicentang, tombol pengingat WA akan menembak API Fonnte via HTTP request di latar belakang.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fonnte account status utility button */}
              <div className="mt-6 pt-4 border-t dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-[10px] text-zinc-400 max-w-md">
                  <strong>Tips Uji Coba:</strong> Masukkan Token dan klik tombol di samping kanan untuk memeriksa status perangkat Anda di server Fonnte.
                </div>
                
                <button
                  onClick={async () => {
                    if (!fonnteToken) {
                      alert("Silakan isi Token API Fonnte Anda terlebih dahulu.");
                      return;
                    }
                    try {
                      const response = await fetch("https://api.fonnte.com/device", {
                        method: "POST",
                        headers: {
                          "Authorization": fonnteToken
                        }
                      });
                      const resData = await response.json();
                      if (resData.status === true || resData.status === "true") {
                        alert(`Koneksi Sukses!\nNama Perangkat: ${resData.name || "-"}\nNomor: ${resData.device || "-"}\nStatus: ${resData.device_status || "-"}`);
                      } else {
                        alert(`Respons Gagal Terkoneksi: ${resData.reason || resData.detail || "Cek kembali keabsahan token Anda di panel Fonnte."}`);
                      }
                    } catch (e: any) {
                      alert(`Kesalahan pengujian koneksi: ${e.message || e}`);
                    }
                  }}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-205 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border dark:border-zinc-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Uji Koneksi Token Fonnte
                </button>
              </div>
            </div>

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

        {/* 5. VIEW E: SETTINGS PANEL */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-in fade-in duration-200 text-left">
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 rounded-lg">
                    <Settings className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Pengaturan Waktu Notifikasi & Alarm
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Modifikasi batas waktu alarm peringatan (alert threshold) untuk pemicu notifikasi pangkat, gaji berkala (KGB), dan tunjangan anak.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wide">Konfigurasi Aktif</span>
                </div>
              </div>

              <div className="max-w-xl space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-2">
                    Batas Waktu Alarm Peringatan (Hari)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={10}
                      max={365}
                      value={alertThresholdDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 90;
                        setAlertThresholdDays(val);
                        localStorage.setItem("sipeka_alert_threshold", String(val));
                      }}
                      className="w-32 p-2.5 border border-zinc-250 dark:border-zinc-850 rounded-xl text-xs bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-bold font-mono text-center"
                    />
                    <span className="text-xs font-semibold text-zinc-650 dark:text-zinc-350">
                      Hari sebelum tanggal jatuh tempo (pangkat / KGB)
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-2 leading-relaxed">
                    Alarm peringatan pada Dasbor Monitoring akan otomatis aktif menyaring pegawai jika rentang sisa hari menuju KPG (Kenaikan Pangkat), KGB, ataupun batas usulan tunjangan anak berada di bawah angka hari ini.
                  </p>
                </div>

                <div className="pt-4 border-t dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-3 text-left">
                    Tombol Akses Penyetelan Cepat Rentang Hari
                  </h4>
                  <div className="flex flex-wrap gap-2 justify-start">
                    {[30, 60, 90, 120, 180].map((days) => (
                      <button
                        key={days}
                        onClick={() => {
                          setAlertThresholdDays(days);
                          localStorage.setItem("sipeka_alert_threshold", String(days));
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          alertThresholdDays === days
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {days} Hari ({Math.round(days / 30)} Bulan)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Database Synchronization Source Controller */}
                <div className="pt-4 border-t dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase mb-3 text-left">
                    Sumber Sinkronisasi Data (Cloud vs Lokal)
                  </h4>
                  <div className="flex gap-4 items-center">
                    <button
                      onClick={() => {
                        setGuestMode(false);
                        localStorage.setItem("sipeka_guest_mode", "false");
                        window.location.reload();
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        !guestMode
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Cloud Firestore
                    </button>
                    <button
                      onClick={() => {
                        setGuestMode(true);
                        localStorage.setItem("sipeka_guest_mode", "true");
                        // Prepopulate local storage with demo or existing data if empty
                        const saved = localStorage.getItem("sipeka_local_employees");
                        if (!saved && employees.length > 0) {
                          localStorage.setItem("sipeka_local_employees", JSON.stringify(employees));
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        guestMode
                          ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                          : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Mode Offline (Lokal)
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-2 leading-relaxed text-left">
                    Database Cloud sinkron otomatis antar-perangkat lewat server instansi. Gunakan Mode Offline (Lokal) jika menemui kendala jaringan atau ingin mencoba database mandiri di memori browser Anda.
                  </p>
                </div>

                {/* Additional kepegawaian settings helper context card */}
                <div className="bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-2xl border dark:border-zinc-850/60 text-xs space-y-2 text-left">
                  <span className="font-bold text-emerald-600 dark:text-emerald-450 block uppercase text-[10px] tracking-wider">
                    Ketentuan Mandatori Layanan Sipeka:
                  </span>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                    <li>Siklus reguler Kenaikan Pangkat (KPG) PNS bergulir per <strong>4 Tahun sekali</strong> terhitung dari TMT Pangkat Terakhir.</li>
                    <li>Siklus Kenaikan Gaji Berkala (KGB) otomatis terjadi reguler setiap <strong>2 Tahun sekali</strong>.</li>
                    <li>Tunjangan anak diayomi s/d batasan usia <strong>21 tahun</strong>, dan diizinkan perpanjangan s/d <strong>25 tahun</strong> bila melampirkan keterangan kuliah aktif yang sah.</li>
                  </ul>
                </div>
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
