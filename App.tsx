import React, { useState, useEffect } from 'react';
import StudentForm from './components/StudentForm';
import AdminDashboard from './components/AdminDashboard';
import { Recruiter, SystemSettings } from './types';
import { loginAdmin, validateReporter, getSystemSettings, isReportingTimeValid } from './services/dataService';
import { Smartphone, Monitor, Lock, Clock, User, ChevronRight } from 'lucide-react';

type SystemMode = 'PORTAL' | 'STUDENT_APP' | 'ADMIN_APP';

const DEFAULT_LOGO = "https://pic1.imgdb.cn/item/69383a2df9354404e341391f.jpg";

const App: React.FC = () => {
  const [mode, setMode] = useState<SystemMode>('STUDENT_APP');
  const [currentUser, setCurrentUser] = useState<Recruiter | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({ reportingStartTime: null, reportingEndTime: null, logoUrl: '' });
  const [isTimeValid, setIsTimeValid] = useState<{valid: boolean, message?: string}>({valid: true});

  // Authentication State for sub-apps
  const [username, setUsername] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Initialize
  useEffect(() => {
    const initApp = async () => {
      try {
        // Clear any legacy session data to ensure clean state
        try {
          localStorage.removeItem('school_app_session');
        } catch (e) {
          // Ignore localStorage errors
        }

        // Load Settings
        const s = await getSystemSettings();
        setSettings(s);
        
        const t = await isReportingTimeValid();
        setIsTimeValid(t);

        // Handle URL Routing
        const params = new URLSearchParams(window.location.search);
        const appParam = params.get('app');
        if (appParam === 'student') {
          setMode('STUDENT_APP');
        } else if (appParam === 'admin') {
          setMode('ADMIN_APP');
        } else if (appParam === 'portal') {
          setMode('PORTAL');
        } else {
          setMode('STUDENT_APP');
        }
      } catch (e) {
        console.error("App initialization failed", e);
        // Fallback to defaults if critical failure
        setSettings({ reportingStartTime: null, reportingEndTime: null, logoUrl: '' });
      }
    };

    initApp();

    const handlePopState = () => {
      // Strict Security: Clear user session on any history navigation (Back/Forward)
      setCurrentUser(null);
      setUsername('');
      setLoginPhone('');
      setPassword('');
      
      const params = new URLSearchParams(window.location.search);
      const appParam = params.get('app');
      if (appParam === 'student') {
        setMode('STUDENT_APP');
      } else if (appParam === 'admin') {
        setMode('ADMIN_APP');
      } else if (appParam === 'portal') {
        setMode('PORTAL');
      } else {
        setMode('STUDENT_APP');
      }
    };
    
    // Sync settings across tabs
    const handleStorageChange = async () => {
      try {
        const s = await getSystemSettings();
        setSettings(s);
      } catch (e) {
        console.error("Failed to sync settings", e);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('settings-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('settings-updated', handleStorageChange);
    };
  }, []);

  const changeMode = (newMode: SystemMode) => {
    setMode(newMode);
    
    // Attempt to update URL for bookmarking/refresh capability, 
    // but fail gracefully in sandboxed environments (like blob: urls)
    try {
        // Skip URL updates for blob: or data: protocols common in playgrounds to prevent SecurityErrors
        if (window.location.protocol === 'blob:' || window.location.protocol === 'data:') {
            return;
        }

        const url = new URL(window.location.href);
        
        if (newMode === 'STUDENT_APP') {
          url.searchParams.set('app', 'student');
        } else if (newMode === 'ADMIN_APP') {
          url.searchParams.set('app', 'admin');
        } else {
          url.searchParams.delete('app');
        }
        
        window.history.pushState({}, '', url.toString());
    } catch (e) {
      // Intentionally ignore pushState errors in sandboxes
    }
  };

  const handleLogin = async (e: React.FormEvent, targetRole: 'user' | 'admin') => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    
    try {
        if (!username.trim()) {
          setLoginError('请输入账号/姓名');
          setIsLoading(false);
          return;
        }

        // --- Admin Login ---
        if (targetRole === 'admin') {
          if (!password) {
            setLoginError('请输入密码 (或子管理员身份证号)');
            setIsLoading(false);
            return;
          }
          
          const adminUser = await loginAdmin(username.trim(), password.trim());
          if (adminUser) {
            setCurrentUser(adminUser);
          } else {
            setLoginError('登录失败：账号或密码错误');
          }
          setIsLoading(false);
          return;
        } 
        
        // --- Student/User Login (Information Reporting) ---
        if (targetRole === 'user') {
          // Check if reporting time window is valid (Backup check)
          const timeCheck = await isReportingTimeValid();
          if (!timeCheck.valid) {
            setLoginError(timeCheck.message || '当前不在报备时间内');
            setIsLoading(false);
            return;
          }

          if (!loginPhone.trim()) {
            setLoginError('请输入手机号码');
            setIsLoading(false);
            return;
          }
          
          const user = validateReporter(username.trim(), loginPhone.trim());
          
          if (user) {
            setCurrentUser(user);
          } else {
            setLoginError('登录失败：请输入有效的11位手机号码');
          }
          setIsLoading(false);
        }
    } catch (err) {
        setLoginError('系统错误，请重试');
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // Immediate logout without confirmation to prevent sticking issues
    setCurrentUser(null);
    setUsername('');
    setLoginPhone('');
    setPassword('');
    setLoginError('');
  };

  const handleBackToHome = () => {
    // Force logout when returning to home from student form
    setCurrentUser(null);
    setUsername('');
    setLoginPhone('');
    setPassword('');
    setLoginError('');
    changeMode('STUDENT_APP');
  };

  // --- PORTAL VIEW ---
  if (mode === 'PORTAL') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-16">
            <img 
              src={settings.logoUrl || DEFAULT_LOGO} 
              alt="Chengdu School Logo" 
              className="w-32 h-32 mx-auto mb-8 object-contain drop-shadow-lg"
            />
            <h1 className="text-4xl md:text-6xl font-extrabold text-[#05A7E2] tracking-tight leading-tight">
              成都城市建设技工学校
            </h1>
            <p className="text-gray-500 mt-4 text-xl">综合信息管理平台</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button 
              onClick={() => changeMode('STUDENT_APP')}
              className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 text-left overflow-hidden border border-gray-100 ring-1 ring-gray-100"
            >
              <div className="absolute top-0 right-0 bg-blue-50 w-32 h-32 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <div className="bg-blue-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Smartphone size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">信息报备</h2>
                <p className="text-gray-500 mb-6">H5 移动端 • 新生信息录入</p>
                <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                  进入系统 <ChevronRight className="ml-1" size={20} />
                </div>
              </div>
            </button>

            <button 
              onClick={() => changeMode('ADMIN_APP')}
              className="group relative bg-gray-50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 text-left overflow-hidden border border-gray-200"
            >
              <div className="absolute top-0 right-0 bg-gray-200 w-32 h-32 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 opacity-50"></div>
              <div className="relative z-10">
                <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-gray-700 group-hover:bg-gray-800 group-hover:text-white transition-colors shadow-sm">
                  <Monitor size={28} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">管理后台</h2>
                <p className="text-gray-500 mb-6">Web 端 • 数据管理与分析</p>
                <div className="flex items-center text-gray-700 font-semibold group-hover:translate-x-2 transition-transform">
                  进入后台 <ChevronRight className="ml-1" size={20} />
                </div>
              </div>
            </button>
          </div>
          
          <p className="text-center text-gray-400 text-sm mt-12">
             请选择对应的入口进入系统
          </p>
        </div>
      </div>
    );
  }

  // --- STUDENT APP FLOW (Information Reporting) ---
  if (mode === 'STUDENT_APP') {
    
    if (!currentUser && !isTimeValid.valid) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-sm text-center border border-gray-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 ring-8 ring-red-50/50">
                        <Clock size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">报备已过期或尚未开启报备</h2>
                    <p className="text-gray-500 text-sm leading-relaxed border-t border-b border-gray-100 py-4">
                        {isTimeValid.message}
                    </p>
                </div>
                <div className="mt-8 opacity-40 grayscale flex flex-col items-center gap-2">
                    <img src={settings.logoUrl || DEFAULT_LOGO} className="h-8 object-contain" />
                    <span className="text-xs text-gray-400">成都城市建设技工学校</span>
                </div>
            </div>
        );
    }

    if (!currentUser) {
      return (
        <div className="min-h-screen bg-white flex flex-col">
          <div className="flex-1 flex flex-col justify-center px-6">
            <div className="w-full max-w-sm mx-auto">
              <div className="text-center mb-10">
                 {/* Logo Area */}
                <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                   <img 
                      src={settings.logoUrl || DEFAULT_LOGO} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                </div>

                <h2 className="text-3xl font-bold text-[#05A7E2] mb-2">成都城市建设技工学校</h2>
                <h1 className="text-xl font-bold text-gray-900">信息报备</h1>
                <p className="text-gray-500 text-sm mt-2">请输入姓名和手机号开始录入</p>
              </div>
              <form onSubmit={(e) => handleLogin(e, 'user')} className="space-y-6">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-school-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                      autoComplete="off"
                      placeholder="请输入您的姓名"
                    />
                    <User className="absolute left-3 top-4 text-gray-400" size={20} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">手机号码</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-school-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                      maxLength={11}
                      autoComplete="off"
                      placeholder="请输入11位手机号码"
                    />
                    <Smartphone className="absolute left-3 top-4 text-gray-400" size={20} />
                  </div>
                </div>

                {loginError && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{loginError}</p>}
                
                <button type="submit" disabled={isLoading} className="w-full bg-school-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-school-700 transition disabled:opacity-50">
                  {isLoading ? '登录中...' : '进入系统'}
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }
    return <StudentForm user={currentUser} onLogout={handleLogout} onBack={handleBackToHome} />;
  }

  // --- ADMIN APP FLOW ---
  if (mode === 'ADMIN_APP') {
    if (!currentUser) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden flex flex-col md:flex-row">
            <div className="w-full p-8 md:p-10">
              <div className="text-center mb-8">
                <img 
                  src={settings.logoUrl || DEFAULT_LOGO} 
                  alt="Logo" 
                  className="w-20 h-20 mx-auto mb-4 object-contain"
                />
                <h2 className="text-2xl font-bold text-[#05A7E2] mb-2">成都城市建设技工学校</h2>
                <h3 className="text-xl font-bold text-gray-900">管理后台登录</h3>
                <p className="text-gray-500 text-sm mt-2">仅限管理人员访问</p>
              </div>
              <form onSubmit={(e) => handleLogin(e, 'admin')} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管理员账号</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                    autoComplete="off"
                    placeholder="请输入管理员账号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">管理员密码</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                      autoComplete="new-password"
                      placeholder="请输入密码"
                    />
                    <Lock className="absolute right-3 top-3.5 text-gray-400" size={18} />
                  </div>
                </div>
                {loginError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">{loginError}</div>}
                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition disabled:opacity-50">
                  {isLoading ? '验证中...' : '安全登录'}
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }
    return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
  }

  return null;
};

export default App;
