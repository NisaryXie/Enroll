import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Student, Recruiter, AppUser, SystemSettings, CloudConfig } from '../types';

// --- Database Schema Definition ---
interface SchoolDB extends DBSchema {
  students: {
    key: string;
    value: Student;
    indexes: { 'by-date': string };
  };
  appUsers: {
    key: string;
    value: AppUser;
    indexes: { 'by-idCard': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'chengdu_school_db';
const DB_VERSION = 1;
const CLOUD_CONFIG_KEY = 'cloud_config';
const DEFAULT_FIREBASE_DB_URL =
  (import.meta as any)?.env?.VITE_FIREBASE_DB_URL ||
  'https://direct-subset-479705-q4-default-rtdb.asia-southeast1.firebasedatabase.app';

// --- Mock Data ---
const MOCK_ADMIN: Recruiter = { id: 'admin-1', username: 'admin', role: 'admin' };
const ADMIN_PWD_KEY = 'admin_password';
const DEFAULT_PASSWORD = 'system123@';

// --- DB Initialization ---
let dbPromise: Promise<IDBPDatabase<SchoolDB>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SchoolDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', { keyPath: 'id' });
          studentStore.createIndex('by-date', 'reportTime');
        }
        if (!db.objectStoreNames.contains('appUsers')) {
          const userStore = db.createObjectStore('appUsers', { keyPath: 'id' });
          userStore.createIndex('by-idCard', 'idCard', { unique: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    }).catch(err => {
      console.error("Failed to open database", err);
      throw err;
    }) as any;
  }
  return dbPromise;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// --- Cloud Configuration Helpers ---

export const getCloudConfig = async (): Promise<CloudConfig | null> => {
  try {
    const db = await getDB();
    const storedConfig = await db.get('settings', CLOUD_CONFIG_KEY);

    // Default to enabled with provided URL if not configured
    if (!storedConfig) {
      const defaultConfig: CloudConfig = {
        type: 'firebase',
        dbUrl: DEFAULT_FIREBASE_DB_URL,
        enabled: true
      };
      return defaultConfig;
    }

    return storedConfig;
  } catch (e) {
    console.warn("Error loading cloud config, falling back to default", e);
    // Return safe default to prevent app crash
    return {
      type: 'firebase',
      dbUrl: DEFAULT_FIREBASE_DB_URL,
      enabled: true
    };
  }
};

export const saveCloudConfig = async (config: CloudConfig): Promise<void> => {
  try {
    const db = await getDB();
    await db.put('settings', config, CLOUD_CONFIG_KEY);
    window.dispatchEvent(new Event('settings-updated'));
  } catch (e) {
    console.error("Failed to save cloud config", e);
    throw e;
  }
};

/**
 * Generic Request Handler
 * - Firebase: Uses path-based REST API
 */
const cloudRequest = async (path: string, method: string = 'GET', body?: any) => {
  try {
    const config = await getCloudConfig();
    if (!config || !config.enabled || !config.dbUrl) return null;
    if (config.type !== 'firebase') return null;

    let url = `${config.dbUrl}/${path}.json`;
    if (config.dbSecret) {
      url += `?auth=${config.dbSecret}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Cloud request failed`);
    return response.json();
  } catch (e) {
    // Suppress cloud errors to keep local functionality working
    return null;
  }
};

// --- Student Operations ---

export const getStudents = async (): Promise<Student[]> => {
  try {
    const config = await getCloudConfig();

    // Try to fetch from cloud first if enabled
    if (config?.enabled && config.type === 'firebase') {
      try {
        const data = await cloudRequest('students');
        if (data) {
          const cloudStudents = Object.values(data) as Student[];
          // Update local cache
          try {
            const db = await getDB();
            const tx = db.transaction('students', 'readwrite');
            for (const s of cloudStudents) await tx.store.put(s);
            await tx.done;
          } catch (dbErr) { /* ignore cache write error */ }

          return cloudStudents.sort((a, b) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());
        }
      } catch (e) { }
    }

    const db = await getDB();
    const students = await db.getAll('students');
    return students.sort((a, b) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());
  } catch (e) {
    console.error("getStudents failed", e);
    return [];
  }
};

export const saveStudent = async (student: Omit<Student, 'id' | 'reportTime'>): Promise<Student> => {
  const newStudent: Student = {
    ...student,
    id: generateId(),
    reportTime: new Date().toISOString(),
  };

  const db = await getDB();
  await db.put('students', newStudent);

  // Fire and forget cloud update
  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest(`students/${newStudent.id}`, 'PUT', newStudent).catch(() => { });
    }
  }).catch(() => { });

  window.dispatchEvent(new Event('students-updated'));
  return newStudent;
};

export const deleteStudent = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('students', id);

  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest(`students/${id}`, 'DELETE').catch(() => { });
    }
  }).catch(() => { });

  window.dispatchEvent(new Event('students-updated'));
};

// --- User Management Operations ---

export const getAppUsers = async (): Promise<AppUser[]> => {
  try {
    const config = await getCloudConfig();
    if (config?.enabled && config.type === 'firebase') {
      try {
        const data = await cloudRequest('appUsers');
        if (data) {
          const cloudUsers = Object.values(data) as AppUser[];
          // Update local cache
          try {
            const db = await getDB();
            const tx = db.transaction('appUsers', 'readwrite');
            await tx.store.clear();
            for (const u of cloudUsers) await tx.store.put(u);
            await tx.done;
          } catch (dbErr) { }
          return cloudUsers;
        }
      } catch (e) { }
    }

    const db = await getDB();
    return db.getAll('appUsers');
  } catch (e) {
    console.error("getAppUsers failed", e);
    return [];
  }
};

export const saveAppUser = async (user: Omit<AppUser, 'id' | 'createdAt' | 'role'>): Promise<AppUser> => {
  const users = await getAppUsers();
  if (users.some(u => u.idCard === user.idCard)) {
    throw new Error("该身份证号已存在");
  }

  const newUser: AppUser = {
    ...user,
    id: generateId(),
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  const db = await getDB();
  await db.put('appUsers', newUser);

  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest(`appUsers/${newUser.id}`, 'PUT', newUser).catch(() => { });
    }
  }).catch(() => { });

  return newUser;
};

export const deleteAppUser = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('appUsers', id);

  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest(`appUsers/${id}`, 'DELETE').catch(() => { });
    }
  }).catch(() => { });
};

// --- System Settings & Auth ---

export const getSystemSettings = async (): Promise<SystemSettings> => {
  let config = null;
  try {
    config = await getCloudConfig();
  } catch (e) { console.warn("Could not get cloud config for settings", e); }

  if (config?.enabled && config.type === 'firebase') {
    try {
      const data = await cloudRequest('system_settings');
      if (data) {
        try {
          const db = await getDB();
          await db.put('settings', data, 'system_config');
        } catch (dbErr) { }
        return data;
      }
    } catch (e) { }
  }

  try {
    const db = await getDB();
    const data = await db.get('settings', 'system_config');
    return data || { reportingStartTime: null, reportingEndTime: null, logoUrl: '' };
  } catch (error) {
    // Fallback safe return
    return { reportingStartTime: null, reportingEndTime: null, logoUrl: '' };
  }
};

export const saveSystemSettings = async (settings: SystemSettings): Promise<void> => {
  const db = await getDB();
  await db.put('settings', settings, 'system_config');

  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest('system_settings', 'PUT', settings).catch(() => { });
    }
  }).catch(() => { });

  window.dispatchEvent(new Event('settings-updated'));
};

export const isReportingTimeValid = async (): Promise<{ valid: boolean; message?: string }> => {
  try {
    const settings = await getSystemSettings();
    const now = new Date().getTime();

    const startStr = settings.reportingStartTime;
    const endStr = settings.reportingEndTime;

    const hasStart = startStr && startStr.trim() !== '';
    const hasEnd = endStr && endStr.trim() !== '';

    if (!hasStart && !hasEnd) {
      return { valid: false, message: '系统未开启：后台暂未配置报备时间。' };
    }

    if (hasStart) {
      const startDate = new Date(startStr);
      if (!isNaN(startDate.getTime()) && now < startDate.getTime()) {
        return { valid: false, message: `系统未开放。开放时间: ${startDate.toLocaleString()}` };
      }
    }

    if (hasEnd) {
      const endDate = new Date(endStr);
      if (!isNaN(endDate.getTime()) && now > endDate.getTime()) {
        return { valid: false, message: `报备已截止。截止时间: ${endDate.toLocaleString()}` };
      }
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, message: "时间校验失败" };
  }
};

// --- Authentication Logic ---

export const verifyAdminPassword = async (inputPassword: string): Promise<boolean> => {
  let config = null;
  try { config = await getCloudConfig(); } catch (e) { }

  if (config?.enabled && config.type === 'firebase') {
    try {
      const storedPwd = await cloudRequest(ADMIN_PWD_KEY);
      if (storedPwd) {
        try {
          const db = await getDB();
          await db.put('settings', storedPwd, ADMIN_PWD_KEY);
        } catch (e) { }
        return inputPassword === storedPwd;
      }
    } catch (e) { }
  }

  // Local check (synced)
  try {
    const db = await getDB();
    const storedPwd = await db.get('settings', ADMIN_PWD_KEY);
    return inputPassword === (storedPwd || DEFAULT_PASSWORD);
  } catch (e) {
    return inputPassword === DEFAULT_PASSWORD;
  }
};

export const changeAdminPassword = async (newPassword: string): Promise<void> => {
  const db = await getDB();
  await db.put('settings', newPassword, ADMIN_PWD_KEY);

  getCloudConfig().then(config => {
    if (config?.enabled && config.type === 'firebase') {
      cloudRequest(ADMIN_PWD_KEY, 'PUT', newPassword).catch(() => { });
    }
  }).catch(() => { });
};

export const loginAdmin = async (username: string, passwordOrIdCard: string): Promise<Recruiter | null> => {
  if (username === 'admin') {
    const isValid = await verifyAdminPassword(passwordOrIdCard);
    return isValid ? MOCK_ADMIN : null;
  }

  const users = await getAppUsers();
  const user = users.find(u => u.idCard === passwordOrIdCard && u.username === username);

  if (user && user.status === 'active') {
    return { id: user.id, username: user.username, role: 'admin' };
  }

  return null;
};

export const validateReporter = (username: string, phoneNumber: string): Recruiter | null => {
  if (!username) return null;
  const phoneRegex = /^1[3-9]\d{9}$/;

  if (!phoneRegex.test(phoneNumber)) {
    return null;
  }

  return { id: phoneNumber, username: username, role: 'user' };
};

// --- Backup & Restore ---

export const getFullBackup = async (): Promise<string> => {
  const db = await getDB();
  const students = await db.getAll('students');
  const appUsers = await db.getAll('appUsers');
  const settings = await db.get('settings', 'system_config');
  const password = await db.get('settings', ADMIN_PWD_KEY);
  const cloudConfig = await db.get('settings', CLOUD_CONFIG_KEY);

  const backup = {
    students,
    appUsers,
    settings: settings || null,
    password: password || null,
    cloudConfig: cloudConfig || null,
    timestamp: new Date().toISOString(),
    version: '2.0',
    note: 'Chengdu Urban Construction School Data Backup'
  };
  return JSON.stringify(backup, null, 2);
};

export const restoreFromBackup = async (jsonString: string): Promise<{ success: boolean; message: string }> => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, message: '无效的文件格式' };
    }

    const db = await getDB();
    const tx = db.transaction(['students', 'appUsers', 'settings'], 'readwrite');
    await tx.objectStore('students').clear();
    await tx.objectStore('appUsers').clear();

    if (Array.isArray(data.students)) {
      for (const s of data.students) await tx.objectStore('students').put(s);
    }
    if (Array.isArray(data.appUsers)) {
      for (const u of data.appUsers) await tx.objectStore('appUsers').put(u);
    }
    if (data.settings) {
      await tx.objectStore('settings').put(data.settings, 'system_config');
    }
    if (data.password) {
      await tx.objectStore('settings').put(data.password, ADMIN_PWD_KEY);
    }
    if (data.cloudConfig) {
      await tx.objectStore('settings').put(data.cloudConfig, CLOUD_CONFIG_KEY);
    }
    await tx.done;

    window.dispatchEvent(new Event('students-updated'));
    window.dispatchEvent(new Event('settings-updated'));

    return { success: true, message: '数据恢复成功' };
  } catch (error) {
    return { success: false, message: '恢复失败: ' + (error as Error).message };
  }
};

export const exportToCSV = async (data?: Student[]): Promise<void> => {
  try {
    const students = data || await getStudents();

    if (students.length === 0) {
      alert("暂无数据可导出");
      return;
    }

    // Updated headers to include new fields
    const headers = ["ID", "姓名", "性别", "身份证号", "班型", "报读专业", "联系电话", "电话归属", "报备时间", "填报人", "填报人电话"];
    const csvContent = [
      headers.join(","),
      ...students.map(s => [
        s.id,
        s.name,
        s.gender || '', // Handle potential missing data for old records
        s.idCard ? `\t${s.idCard}` : '', // Add tab to prevent Excel converting long numbers to scientific notation
        s.classType || '',
        s.major || '',
        s.phoneNumber,
        s.contactType === 'student' ? '学生本人' : '家长',
        new Date(s.reportTime).toLocaleString(),
        s.recruiterName || s.recruiterId,
        s.recruiterPhone || s.recruiterId
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const prefix = data ? '筛选报备数据' : '全部报备数据';
    link.setAttribute("download", `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error("Export Error", e);
    alert("导出失败：无法获取数据。");
  }
};
