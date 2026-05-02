import React, { useEffect, useState, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { Download, Sparkles, RefreshCw, LogOut, Users, Search, Lock, X, Clock, Plus, Trash2, Check, Image as ImageIcon, Upload, Database, UploadCloud, DownloadCloud, Globe, Link as LinkIcon, AlertCircle, AlertTriangle } from 'lucide-react';
import { 
  getStudents, exportToCSV, verifyAdminPassword, changeAdminPassword, 
  getAppUsers, saveAppUser, deleteAppUser,
  getSystemSettings, saveSystemSettings, deleteStudent,
  getFullBackup, restoreFromBackup,
  getCloudConfig, saveCloudConfig
} from '../services/dataService';
import { analyzeRecruitmentData } from '../services/geminiService';
import { Student, AnalysisResult, AppUser, SystemSettings, Recruiter, CloudConfig } from '../types';

interface Props {
  user: Recruiter;
  onLogout: () => void;
}

type Tab = 'DASHBOARD' | 'USERS' | 'SETTINGS';

const DEFAULT_LOGO = "https://pic1.imgdb.cn/item/69383a2df9354404e341391f.jpg";
const DEFAULT_FIREBASE_DB_URL =
  (import.meta as any)?.env?.VITE_FIREBASE_DB_URL ||
  'https://direct-subset-479705-q4-default-rtdb.asia-southeast1.firebasedatabase.app';

const AdminDashboard: React.FC<Props> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [students, setStudents] = useState<Student[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Password Modal
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  // User Management State
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFormName, setUserFormName] = useState('');
  const [userFormIdCard, setUserFormIdCard] = useState('');
  const [userFormError, setUserFormError] = useState('');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'student' | 'user', id: string } | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SystemSettings>({ reportingStartTime: null, reportingEndTime: null, logoUrl: '' });
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ 
    type: 'firebase', 
    dbUrl: DEFAULT_FIREBASE_DB_URL,
    dbSecret: '', 
    enabled: true 
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  
  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Wrap initial loads in a safe function
    const init = async () => {
      try {
        await loadSettings(); 
        await loadData(); 
        if (user.username === 'admin') {
          await loadUsers();
        }
      } catch (e) {
        console.error("Dashboard init error:", e);
      }
    };
    init();

    // Event listener for real-time updates (Same Tab)
    const handleDataUpdate = () => {
      loadData().catch(console.error);
    };
    const handleSettingsUpdate = () => {
      loadSettings().catch(console.error);
    }

    window.addEventListener('students-updated', handleDataUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('students-updated', handleDataUpdate);
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, [user]);

  const loadData = async () => {
    try {
      const data = await getStudents();
      const allStudents = Array.isArray(data) ? data : [];
      if (user.username === 'admin') {
        setStudents(allStudents);
      } else {
        setStudents(allStudents.filter(s => s.recruiterId === user.id));
      }
    } catch (e) {
      console.error("Failed to load students", e);
    }
  };

  const loadUsers = async () => {
    try {
      const users = await getAppUsers();
      setAppUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      console.error("Failed to load users", e);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await getSystemSettings();
      setSettings(s || { reportingStartTime: null, reportingEndTime: null, logoUrl: '' });
      
      const c = await getCloudConfig();
      if (c) setCloudConfig(prev => ({...prev, ...c}));
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  // --- Handlers ---

  const handleAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeRecruitmentData(students);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const triggerDeleteStudent = (id: string) => {
    setDeleteTarget({ type: 'student', id });
  };

  const triggerDeleteUser = (id: string) => {
    setDeleteTarget({ type: 'user', id });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'student') {
        await deleteStudent(deleteTarget.id);
      } else if (deleteTarget.type === 'user') {
        await deleteAppUser(deleteTarget.id);
        await loadUsers();
      }
    } catch (e) {
      alert("操作失败，请重试");
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    try {
      const isValid = await verifyAdminPassword(oldPwd);
      if (!isValid) {
        setPwdError('原密码错误');
        return;
      }
      if (newPwd.length < 6) {
        setPwdError('新密码长度不能少于6位');
        return;
      }

      await changeAdminPassword(newPwd);
      setPwdSuccess('密码修改成功');
      setTimeout(() => {
        setShowPwdModal(false);
        setOldPwd('');
        setNewPwd('');
        setPwdSuccess('');
      }, 1500);
    } catch (e) {
      setPwdError("操作失败");
      console.error(e);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');

    if (!userFormName || !userFormIdCard) {
      setUserFormError('请填写完整信息');
      return;
    }

    try {
      await saveAppUser({
        username: userFormName,
        idCard: userFormIdCard,
        status: 'active'
      });
      setShowUserModal(false);
      setUserFormName('');
      setUserFormIdCard('');
      await loadUsers();
    } catch (err: any) {
      setUserFormError(err.message || '添加失败');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await saveSystemSettings(settings);
      await saveCloudConfig(cloudConfig);
      
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      
      await loadData();
    } catch (e) {
      alert("保存失败");
      console.error(e);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("为了保证系统性能，图片大小不能超过 1MB。");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSettings(prev => ({ ...prev, logoUrl: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // --- Backup & Restore Handlers ---

  const handleExportBackup = async () => {
    try {
      const jsonString = await getFullBackup();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `school_db_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("导出备份失败");
      console.error(e);
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let confirmRestore = false;
    try {
        confirmRestore = confirm("高风险操作：恢复备份将完全覆盖当前的【所有数据】。\n\n建议在恢复前先导出当前数据作为备份。\n\n确定要继续吗？");
    } catch(e) {
        console.error(e);
        if (backupInputRef.current) backupInputRef.current.value = '';
        return;
    }

    if (!confirmRestore) {
      if (backupInputRef.current) backupInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const result = await restoreFromBackup(content);
        if (result.success) {
          alert("数据恢复成功！系统将刷新以应用更改。");
          window.location.reload();
        } else {
          alert(`恢复失败: ${result.message}`);
        }
      } catch (err) {
        alert("恢复过程中发生错误");
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  // --- Helpers for Sharing ---
  const getShareLink = () => {
    if (!cloudConfig.dbUrl) return '';
    const baseUrl = window.location.href.split('?')[0];
    const params = new URLSearchParams();
    params.set('app', 'student');
    params.set('sync_url', encodeURIComponent(cloudConfig.dbUrl));
    
    if (cloudConfig.dbSecret) {
        params.set('sync_key', encodeURIComponent(cloudConfig.dbSecret));
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const copyShareLink = () => {
    const link = getShareLink();
    if (link) {
      navigator.clipboard.writeText(link);
      alert("H5 报备端链接已复制！发送给招生老师即可自动连接数据库。");
    }
  };

  // --- Chart Data ---
  const chartData = React.useMemo(() => {
    if (!Array.isArray(students)) return [];
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      return {
        date: date.slice(5),
        count: students.filter(s => s.reportTime && s.reportTime.startsWith(date)).length
      };
    });
  }, [students]);

  // Enhanced Filter Logic for Full-Field Search
  const filteredStudents = Array.isArray(students) ? students.filter(s => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    // Searchable Fields
    const name = (s.name || '').toLowerCase();
    const gender = (s.gender || '').toLowerCase();
    const phone = (s.phoneNumber || '');
    const idCard = (s.idCard || '').toLowerCase();
    const classType = (s.classType || '').toLowerCase();
    const major = (s.major || '').toLowerCase();
    const type = s.contactType === 'student' ? '学生' : '家长';
    const date = new Date(s.reportTime).toLocaleString().toLowerCase();
    const recruiter = (s.recruiterName || '').toLowerCase();
    const recruiterPhone = (s.recruiterPhone || '');

    return (
      name.includes(term) ||
      gender.includes(term) ||
      phone.includes(term) ||
      idCard.includes(term) ||
      classType.includes(term) ||
      major.includes(term) ||
      type.includes(term) ||
      date.includes(term) ||
      recruiter.includes(term) ||
      recruiterPhone.includes(term)
    );
  }) : [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <img src={settings.logoUrl || DEFAULT_LOGO} alt="Logo" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-[#05A7E2] leading-none">成都城市建设技工学校</h1>
                <p className="text-sm text-gray-500 mt-1">招生管理后台 ({user.username})</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user.username === 'admin' && (
                <button 
                  onClick={() => setShowPwdModal(true)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-school-600 transition"
                >
                  <Lock size={16} /> 修改密码
                </button>
              )}
              <div className="h-6 w-px bg-gray-200"></div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition"
              >
                <LogOut size={16} /> 退出
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-8 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'DASHBOARD' ? 'border-school-600 text-school-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              数据报表
            </button>
            {user.username === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('USERS')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'USERS' ? 'border-school-600 text-school-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  用户管理
                </button>
                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'SETTINGS' ? 'border-school-600 text-school-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  系统设置
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-500">
                  {user.username === 'admin' ? '总报备人数' : '我的报备人数'}
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">{students.length}</span>
                  <span className="text-sm text-gray-500">人</span>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={() => exportToCSV(students).catch(console.error)}
                    className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    <Download size={16} /> 导出所有报表 (.csv)
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#05A7E2] to-blue-700 rounded-xl shadow-lg p-6 text-white md:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Sparkles className="w-40 h-40" />
                </div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-300" /> AI 智能分析
                      </h3>
                      <p className="text-blue-100 text-sm mt-1">基于实时数据的招生趋势洞察</p>
                    </div>
                    <button 
                      onClick={handleAnalysis}
                      disabled={analyzing}
                      className={`px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm bg-white/20 hover:bg-white/30 transition border border-white/30 ${analyzing ? 'opacity-70 cursor-wait' : ''}`}
                    >
                      {analyzing ? '分析中...' : '生成分析报告'}
                    </button>
                  </div>
                  <div className="mt-4 bg-black/20 rounded-lg p-4 backdrop-blur-md min-h-[100px]">
                    {analysis ? (
                      <div className="space-y-2 text-sm">
                        <p><span className="font-bold text-yellow-300">摘要:</span> {analysis.summary}</p>
                        <p><span className="font-bold text-yellow-300">趋势:</span> {analysis.trend}</p>
                        <p><span className="font-bold text-yellow-300">建议:</span> {analysis.recommendation}</p>
                      </div>
                    ) : (
                      <p className="text-blue-200 text-sm italic flex items-center justify-center h-full">点击右上角按钮生成智能分析...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">近7日报名趋势</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar name="报备人数" dataKey="count" fill="#05A7E2" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                   <h3 className="text-lg font-bold text-gray-800">详细报备列表</h3>
                   <button onClick={() => loadData().catch(console.error)} className="text-gray-400 hover:text-[#05A7E2]" title="刷新"><RefreshCw size={16} /></button>
                   <div className="h-4 w-px bg-gray-300 mx-1"></div>
                   <button 
                     onClick={() => exportToCSV(filteredStudents).catch(console.error)}
                     className="flex items-center gap-1 text-sm text-gray-600 hover:text-[#05A7E2] transition px-2 py-1 rounded-lg hover:bg-gray-50 border border-gray-200"
                     title="仅导出当前列表显示的报备数据"
                   >
                     <Download size={14} /> 导出筛选数据
                   </button>
                </div>
                <div className="relative w-full sm:w-80">
                  <input 
                    type="text" 
                    placeholder="全字段搜索 (姓名/专业/班型/电话...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-[#05A7E2] focus:bg-white transition outline-none text-sm text-gray-900 placeholder-gray-400"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性别</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">身份证号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">专业</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系电话</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">归属</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">报备时间</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">填报人</th>
                      {user.role === 'admin' && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.gender || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">{student.idCard || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.classType || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.major || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.phoneNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.contactType === 'student' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {student.contactType === 'student' ? '学生' : '家长'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(student.reportTime).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                             <div>{student.recruiterName || student.recruiterId}</div>
                             <div className="text-xs">{student.recruiterPhone}</div>
                          </td>
                          {user.role === 'admin' && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button 
                                onClick={() => triggerDeleteStudent(student.id)}
                                className="text-gray-400 hover:text-red-600 transition"
                                title="删除此记录"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={user.role === 'admin' ? 10 : 9} className="px-6 py-12 text-center text-sm text-gray-500">没有找到匹配的数据</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- USERS TAB --- */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
               <div>
                 <h2 className="text-lg font-bold text-gray-900">用户管理</h2>
                 <p className="text-sm text-gray-500">添加其他管理员账号 (子管理员)</p>
               </div>
               <button 
                 onClick={() => setShowUserModal(true)}
                 className="flex items-center gap-2 bg-[#05A7E2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 transition"
               >
                 <Plus size={16} /> 添加管理员
               </button>
             </div>
             
             <table className="min-w-full divide-y divide-gray-100">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名 (登录账号)</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">身份证号 (登录密码)</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-100">
                 {appUsers.length > 0 ? (
                   appUsers.map(user => (
                     <tr key={user.id} className="hover:bg-gray-50">
                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{user.idCard}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                           {user.status === 'active' ? '正常' : '禁用'}
                         </span>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                         <button 
                           onClick={() => triggerDeleteUser(user.id)}
                           className="text-red-600 hover:text-red-900 ml-4 flex items-center gap-1 float-right"
                         >
                           <Trash2 size={16} /> 删除
                         </button>
                       </td>
                     </tr>
                   ))
                 ) : (
                   <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">暂无子管理员，请点击右上角添加</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'SETTINGS' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="max-w-2xl space-y-8">
               
               {/* Cloud Sync Settings */}
               <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Globe className="text-[#05A7E2]" /> 多端数据同步配置
                  </h2>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800">
                    <p>启用后，数据将存储在远程 Firebase Realtime Database，实现不同设备（电脑后台、手机H5）之间的数据实时同步。</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <input 
                        type="checkbox" 
                        id="cloudEnabled"
                        checked={cloudConfig.enabled}
                        onChange={(e) => setCloudConfig({...cloudConfig, enabled: e.target.checked})}
                        className="w-5 h-5 text-[#05A7E2] rounded focus:ring-[#05A7E2] border-gray-300"
                      />
                      <label htmlFor="cloudEnabled" className="font-medium text-gray-800">启用云端同步</label>
                    </div>

                    <div className={!cloudConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
                      {/* Storage Type - Locked to Firebase */}
                      <div className="mb-4">
                         <label className="block text-sm font-medium text-gray-700 mb-2">存储类型</label>
                         <div className="flex gap-4">
                            <div
                               className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition bg-orange-50 border-orange-200 text-orange-700 ring-1 ring-orange-200`}
                            >
                               <Database size={16} /> Firebase Realtime DB
                            </div>
                         </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Firebase Database URL</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-[#05A7E2] text-gray-900 font-mono text-sm"
                          placeholder="https://your-project.firebaseio.com"
                          value={cloudConfig.dbUrl}
                          onChange={(e) => setCloudConfig({...cloudConfig, dbUrl: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Database Secret (Legacy) / Auth Token</label>
                        <input 
                          type="password" 
                          className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-[#05A7E2] text-gray-900 font-mono text-sm"
                          placeholder="Token"
                          value={cloudConfig.dbSecret || ''}
                          onChange={(e) => setCloudConfig({...cloudConfig, dbSecret: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {cloudConfig.enabled && cloudConfig.dbUrl && (
                     <div className="mt-6 bg-green-50 border border-green-100 rounded-xl p-4">
                       <h4 className="font-bold text-green-800 text-sm flex items-center gap-2 mb-2">
                         <LinkIcon size={16}/> H5 报备端分享链接
                       </h4>
                       <p className="text-xs text-green-700 mb-3">
                         将此链接发送给招生老师，他们打开后会自动连接到此数据库。
                       </p>
                       <div className="flex gap-2">
                         <input 
                           readOnly 
                           value={getShareLink()} 
                           className="flex-1 text-xs bg-white border border-green-200 px-3 py-2 rounded text-gray-600 select-all"
                         />
                         <button 
                           onClick={copyShareLink}
                           className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition"
                         >
                           复制
                         </button>
                       </div>
                     </div>
                  )}
               </div>

               <hr className="border-gray-100" />
               
               {/* Time Settings */}
               <div>
                 <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                   <Clock className="text-[#05A7E2]" /> 报备时间设置
                 </h2>
                 <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-6 text-sm text-gray-600">
                   <p>设置报备系统的开放时间窗口。如果在该时间段之外，移动端将无法提交数据。</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">开始时间</label>
                     <input 
                       type="datetime-local" 
                       className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-[#05A7E2] text-gray-900"
                       value={settings?.reportingStartTime || ''}
                       onChange={(e) => setSettings({...settings, reportingStartTime: e.target.value})}
                       style={{colorScheme: 'light'}}
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">截止时间</label>
                     <input 
                       type="datetime-local" 
                       className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-[#05A7E2] text-gray-900"
                       value={settings?.reportingEndTime || ''}
                       onChange={(e) => setSettings({...settings, reportingEndTime: e.target.value})}
                       style={{colorScheme: 'light'}}
                     />
                   </div>
                 </div>
               </div>

               <hr className="border-gray-100" />

               {/* Data Backup & Restore */}
               <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Database className="text-[#05A7E2]" /> 本地数据备份
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export */}
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition">
                      <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <DownloadCloud size={20} className="text-blue-600"/> 导出全量备份
                      </h3>
                      <button 
                        onClick={handleExportBackup}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition shadow-sm mt-4"
                      >
                        导出数据 (JSON)
                      </button>
                    </div>

                    {/* Import */}
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition">
                      <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <UploadCloud size={20} className="text-green-600"/> 恢复全量备份
                      </h3>
                      <div className="flex gap-2 mt-4">
                         <input 
                           type="file" 
                           ref={backupInputRef}
                           accept=".json"
                           onChange={handleImportBackup}
                           className="hidden"
                         />
                         <button 
                           onClick={() => backupInputRef.current?.click()}
                           className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition shadow-sm"
                         >
                           选择文件
                         </button>
                      </div>
                    </div>
                  </div>
               </div>

               <hr className="border-gray-100" />

               {/* Logo Settings */}
               <div>
                 <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                   <ImageIcon className="text-[#05A7E2]" /> 首页 Logo 设置
                 </h2>
                 
                 <div className="mb-6">
                   <label className="block text-sm font-medium text-gray-700 mb-2">当前预览</label>
                   <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-center w-full sm:w-64 h-32">
                     <img 
                        src={settings.logoUrl || DEFAULT_LOGO} 
                        alt="Current Logo" 
                        className="max-h-full max-w-full object-contain"
                      />
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">上传图片</label>
                      <div className="flex gap-3">
                        <button 
                          onClick={triggerFileUpload}
                          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
                        >
                          <Upload size={16} /> 点击上传图片
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                        />
                      </div>
                   </div>
                 </div>
               </div>
               
               <div className="sticky bottom-4 z-40 bg-white/90 backdrop-blur border border-gray-200 shadow-xl rounded-xl p-4 flex items-center justify-between">
                 <span className="text-sm text-gray-500">
                    {settingsSaved ? '所有更改已保存' : '修改后请点击保存'}
                 </span>
                 <button 
                   onClick={handleSaveSettings}
                   className="flex items-center gap-2 bg-[#05A7E2] text-white px-6 py-3 rounded-lg font-bold hover:bg-sky-600 transition shadow-lg shadow-blue-200"
                   >
                   {settingsSaved ? <Check size={20} /> : null}
                   {settingsSaved ? '保存成功' : '保存所有设置'}
                 </button>
               </div>
             </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
             <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle className="text-red-600" size={24} />
             </div>
             <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
               确定要删除吗？
             </h3>
             <p className="text-sm text-gray-500 text-center mb-6">
               此操作将永久删除该{deleteTarget.type === 'student' ? '报备记录' : '管理员账号'}，删除后无法恢复。
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setDeleteTarget(null)}
                 className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
               >
                 取消
               </button>
               <button 
                 onClick={executeDelete}
                 className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-lg shadow-red-200"
               >
                 确认删除
               </button>
             </div>
          </div>
         </div>
      )}

      {/* Password Modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowPwdModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Lock size={18} className="text-[#05A7E2]" /> 修改管理员密码</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">当前密码</label>
                <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">新密码</label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-900" />
              </div>
              {pwdError && <p className="text-red-500 text-xs">{pwdError}</p>}
              {pwdSuccess && <p className="text-green-500 text-xs">{pwdSuccess}</p>}
              <button type="submit" className="w-full bg-[#05A7E2] text-white py-2.5 rounded-lg font-medium hover:bg-sky-600 transition">确认修改</button>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus size={18} className="text-[#05A7E2]" /> 添加子管理员</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">姓名</label>
                <input 
                  type="text" 
                  value={userFormName} 
                  onChange={(e) => setUserFormName(e.target.value)} 
                  className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-900" 
                  placeholder="如: 李四"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">身份证号 (用于登录密码)</label>
                <input 
                  type="text" 
                  value={userFormIdCard} 
                  onChange={(e) => setUserFormIdCard(e.target.value)} 
                  className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-900 font-mono"
                  placeholder="18位身份证号"
                />
              </div>
              {userFormError && <p className="text-red-500 text-xs">{userFormError}</p>}
              <button type="submit" className="w-full bg-[#05A7E2] text-white py-2.5 rounded-lg font-medium hover:bg-sky-600 transition">确认添加</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
