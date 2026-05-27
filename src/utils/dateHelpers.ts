import { Employee, Child } from "../types";

// Standard current date as of simulation or real runtime
export function getCurrentDate(): Date {
  // Let's use real current date, fallback to simulation date 2026-05-27 if not available or for consistency
  return new Date();
}

export function formatDateIndo(dateString: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return dateString;
  }
}

export function calculateAge(birthDateString: string, refDate: Date = getCurrentDate()): { years: number; months: number; days: number } {
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = refDate.getFullYear() - birthDate.getFullYear();
  let months = refDate.getMonth() - birthDate.getMonth();
  let days = refDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const lastDayPrevMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 0).getDate();
    days += lastDayPrevMonth;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

// Convert YYYY-MM-DD + years addition
export function addYearsToDate(dateString: string, yearsToAdd: number): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + yearsToAdd);
  
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDaysDifference(targetDateString: string, refDate: Date = getCurrentDate()): number {
  if (!targetDateString) return 0;
  const target = new Date(targetDateString);
  if (isNaN(target.getTime())) return 0;
  
  // Strip hours to do exact date diff
  const ref = new Date(refDate);
  ref.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Check for Kenaikan Pangkat
export interface PromotionAlert {
  employee: Employee;
  dueDate: string;
  daysRemaining: number;
  status: "overdue" | "critical" | "upcoming" | "safe";
}

export function getPromotionAlerts(employees: Employee[], refDate: Date = getCurrentDate(), alertThresholdDays = 90): PromotionAlert[] {
  return employees
    .filter(emp => !emp.maxRankReached) // Exclude if max rank reached
    .map(emp => {
      const dueDate = addYearsToDate(emp.lastPromotionDate, 4);
      const daysRemaining = getDaysDifference(dueDate, refDate);
      
      let status: "overdue" | "critical" | "upcoming" | "safe" = "safe";
      if (daysRemaining < 0) {
        status = "overdue";
      } else if (daysRemaining <= 30) {
        status = "critical";
      } else if (daysRemaining <= alertThresholdDays) {
        status = "upcoming";
      }

      return {
        employee: emp,
        dueDate,
        daysRemaining,
        status
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Check for KGB (Kenaikan Gaji Berkala) - 2 Years after last promotion
export interface KgbAlert {
  employee: Employee;
  dueDate: string;
  daysRemaining: number;
  status: "overdue" | "critical" | "upcoming" | "safe";
}

export function getKgbAlerts(employees: Employee[], refDate: Date = getCurrentDate(), alertThresholdDays = 90): KgbAlert[] {
  return employees.map(emp => {
    // KGB is 2 years after last promotion date
    const dueDate = addYearsToDate(emp.lastPromotionDate, 2);
    const daysRemaining = getDaysDifference(dueDate, refDate);

    let status: "overdue" | "critical" | "upcoming" | "safe" = "safe";
    if (daysRemaining < 0) {
      status = "overdue";
    } else if (daysRemaining <= 30) {
      status = "critical";
    } else if (daysRemaining <= alertThresholdDays) {
      status = "upcoming";
    }

    return {
      employee: emp,
      dueDate,
      daysRemaining,
      status
    };
  }).sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Check children alerts (menginjak 21 tahun - meaning age 20 turning 21 soon, or turning 21 in less than 365 days)
export interface ChildAlert {
  employee: Employee;
  child: Child;
  age: { years: number; months: number; days: number };
  dueDate21: string;
  daysRemaining: number;
  status: "turning_21" | "over_21" | "under_20";
}

export function getChildrenAlerts(employees: Employee[], refDate: Date = getCurrentDate()): { turning21: ChildAlert[]; over21: ChildAlert[] } {
  const turning21: ChildAlert[] = [];
  const over21: ChildAlert[] = [];

  employees.forEach(emp => {
    (emp.children || []).forEach(child => {
      const age = calculateAge(child.birthDate, refDate);
      const dueDate21 = addYearsToDate(child.birthDate, 21);
      const daysRemaining = getDaysDifference(dueDate21, refDate);

      // Child alert classifications:
      // Over 21: age.years >= 21
      // Turning 21 soon: is currently 20 years old (menginjak usia 21)
      if (age.years >= 21) {
        over21.push({
          employee: emp,
          child,
          age,
          dueDate21,
          daysRemaining,
          status: "over_21"
        });
      } else if (age.years === 20) {
        turning21.push({
          employee: emp,
          child,
          age,
          dueDate21,
          daysRemaining,
          status: "turning_21"
        });
      }
    });
  });

  // Sort turning 21 by days remaining (closest first)
  turning21.sort((a, b) => a.daysRemaining - b.daysRemaining);
  // Sort over 21 by age descending (oldest first)
  over21.sort((a, b) => b.age.years * 365 + b.age.months * 30 + b.age.days - (a.age.years * 365 + a.age.months * 30 + a.age.days));

  return { turning21, over21 };
}
