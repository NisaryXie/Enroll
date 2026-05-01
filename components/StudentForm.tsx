import React, { useState, useEffect } from 'react';
import { User, CheckCircle, Smartphone, LogOut, PlusCircle, Send, AlertTriangle, CreditCard, Users, BookOpen, GraduationCap } from 'lucide-react';
import { saveStudent, isReportingTimeValid } from '../services/dataService';
import { Recruiter } from '../types';

interface Props {
  user: Recruiter;
  onLogout: () => void;
  onBack?: () => void;
}

const CLASS_TYPES = ['凌云班', '职教高考班', '综合高中班'];
const MAJORS = [
  '护理', '幼儿教育', '多媒体制作', '旅游服务与管理', '汽车维修服务', 
  '建筑施工', '消防技术', '影视制作与表演', '航空服务（无人机技术）'
];

const StudentForm: React.FC<Props> = ({ user, onLogout, onBack }) => {
  // Field States
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'男' | '女' | ''>('');
  const [idCard, setIdCard] = useState('');
  const [noIdCard, setNoIdCard] = useState(false);
  const [classType, setClassType] = useState('');
  const [major, setMajor] = useState('');
  const [phone, setPhone] = useState('');
  const [contactType, setContactType] = useState<'student' | 'parent'>('student');

  // System States
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle No ID Card Toggle
  useEffect(() => {
    if (noIdCard) {
      setIdCard('暂无');
    } else if (idCard === '暂无') {
      setIdCard('');
    }
  }, [noIdCard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Time Window Validation (Async)
      const timeCheck = await isReportingTimeValid();
      if (!timeCheck.valid) {
        setError(timeCheck.message || '当前不在报备时间内');
        setLoading(false);
        return;
      }

      // 2. Input Validation
      if (!name || !gender || !idCard || !classType || !major || !phone) {
        setError('请填写所有必填项');
        setLoading(false);
        return;
      }

      // 3. Save
      await saveStudent({
        name,
        gender: gender as string,
        idCard,
        classType,
        major,
        phoneNumber: phone,
        contactType,
        recruiterId: user.id, // For reporters, this is the phone number
        recruiterName: user.username, // This is the name entered on login screen
        recruiterPhone: user.id // Explicitly save the phone number for display columns
      });
      setSubmitted(true);
    } catch (err) {
      setError('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setSubmitted(false);
    setName('');
    setGender('');
    setIdCard('');
    setNoIdCard(false);
    setClassType('');
    setMajor('');
    setPhone('');
    setContactType('student');
    setError('');
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-school-50 p-6 animate-in fade-in duration-300">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
             <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">报备成功!</h2>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between items-center">
               <p className="text-lg font-bold text-gray-900">{name} <span className="text-sm font-normal text-gray-500">({gender})</span></p>
            </div>
            <p className="text-sm text-gray-600">专业: {major}</p>
            <p className="text-sm text-gray-600">班型: {classType}</p>
            <div className="pt-2 border-t border-gray-200 mt-2 flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {contactType === 'student' ? '学生电话' : '家长电话'}
              </span>
              <span className="text-sm text-gray-600">{phone}</span>
            </div>
          </div>
          <button
            onClick={handleNext}
            className="w-full bg-school-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-school-700 transition duration-200 flex items-center justify-center gap-2"
          >
            <PlusCircle size={20} /> 报备下一位
          </button>
          
          <button
            onClick={onLogout}
            className="w-full mt-4 text-gray-500 py-3 text-sm font-medium hover:text-gray-700 hover:bg-gray-50 rounded-xl transition flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> 退出
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Mobile App Header */}
      <div className="bg-school-600 text-white pt-safe sticky top-0 z-30 shadow-md">
        <div className="px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">成都城市建设技工学校</h1>
            <p className="text-xs text-blue-100 opacity-90">信息报备 • {user.username}</p>
          </div>
          <button 
            onClick={onLogout}
            className="text-xs bg-school-700/50 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-school-700 transition flex items-center gap-1 border border-white/20"
          >
            <LogOut size={12} /> 退出
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-school-500"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">录入学生信息</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Name & Gender Row */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User size={18} className="text-school-500" /> 学生姓名 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  className="flex-1 min-w-0 px-4 py-3.5 rounded-xl bg-gray-100 border-0 focus:ring-2 focus:ring-school-500 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400"
                />
                <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGender('男')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${gender === '男' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    男
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('女')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${gender === '女' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    女
                  </button>
                </div>
              </div>
            </div>

            {/* 2. ID Card */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CreditCard size={18} className="text-school-500" /> 身份证号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={idCard}
                onChange={(e) => setIdCard(e.target.value)}
                disabled={noIdCard}
                placeholder={noIdCard ? "暂无身份证号" : "请输入身份证号"}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-100 border-0 focus:ring-2 focus:ring-school-500 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="noIdCard" 
                  checked={noIdCard} 
                  onChange={(e) => setNoIdCard(e.target.checked)}
                  className="w-4 h-4 rounded text-school-600 focus:ring-school-500"
                />
                <label htmlFor="noIdCard" className="text-sm text-gray-600">暂无身份证号</label>
              </div>
            </div>

            {/* 3. Class Type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users size={18} className="text-school-500" /> 班型选择 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={classType}
                  onChange={(e) => setClassType(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-gray-100 border-0 focus:ring-2 focus:ring-school-500 focus:bg-white outline-none transition text-gray-900 appearance-none"
                >
                  <option value="" disabled>请选择班型</option>
                  {CLASS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>

            {/* 4. Major */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <GraduationCap size={18} className="text-school-500" /> 报读专业 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-gray-100 border-0 focus:ring-2 focus:ring-school-500 focus:bg-white outline-none transition text-gray-900 appearance-none"
                >
                  <option value="" disabled>请选择专业</option>
                  {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>

            {/* 5. Phone Input with Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Smartphone size={18} className="text-school-500" /> 联系电话 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setContactType('student')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${contactType === 'student' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-100 border-transparent text-gray-500'}`}
                >
                  学生本人
                </button>
                <button
                  type="button"
                  onClick={() => setContactType('parent')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${contactType === 'parent' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-100 border-transparent text-gray-500'}`}
                >
                  家长
                </button>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={contactType === 'student' ? "请输入学生电话" : "请输入家长电话"}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-100 border-0 focus:ring-2 focus:ring-school-500 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2">
                 <AlertTriangle size={16} className="mt-0.5 shrink-0" /> 
                 <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-school-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-school-700 transition duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              <Send size={20} /> {loading ? '提交中...' : '立即报备'}
            </button>
          </form>
        </div>
        
        <p className="text-center text-[#05A7E2] text-xs mt-6">
          成都城市建设技工学校 • 报备系统
        </p>
      </div>
    </div>
  );
};

export default StudentForm;