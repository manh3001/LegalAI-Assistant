import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  LayoutDashboard,
  Database,
  Users,
  Activity,
  Settings,
  ShieldCheck,
  Zap,
  MoreVertical,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardEdit,
  Scale,
  MessageSquare,
  Search
} from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
import { API_URL, SOCKET_URL } from '../../config/api';
const backendBase = API_URL;


export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [totalUsers, setTotalUsers] = useState(0);
  const [aiRecords, setAiRecords] = useState(0);

  const [vectorQuota, setVectorQuota] = useState({ used: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const [timeframe, setTimeframe] = useState('week');
  const [featureUsage, setFeatureUsage] = useState([]);
  const [featureUsageLoading, setFeatureUsageLoading] = useState(false);

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [crawlerStatus, setCrawlerStatus] = useState({
    isRunning: false,
    current: 0,
    total: 0,
    title: '',
    step: ''
  });




  useEffect(() => {
    fetchDashboardData();
    fetchAiHistory();
  }, []);

  useEffect(() => {
    fetchFeatureUsage(timeframe);
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const statsRes = await axios.get(`${backendBase}/admin/stats`, { headers });
      if (statsRes.data?.success) {
        setTotalUsers(statsRes.data.data.totalUsers || 0);
        setAiRecords(statsRes.data.data.aiRecords || 0);
        setVectorQuota(statsRes.data.data.vectorQuota || { used: 0, total: 0 });
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu Admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatureUsage = async (tf) => {
    setFeatureUsageLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${backendBase}/admin/feature-usage`, {
        headers,
        params: { timeframe: tf }
      });
      setFeatureUsage(res.data.data || []);
    } catch (error) {
      console.error('Lỗi khi lấy tính năng hot:', error);
      setFeatureUsage([]);
    } finally {
      setFeatureUsageLoading(false);
    }
  };

  const fetchAiHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${backendBase}/admin/history-analytics`, {
        headers,
        params: { page, limit: 8 }
      });
      setHistoryItems(res.data.data || []);
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử AI:', error);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchCrawlerStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${backendBase}/admin/crawler/status`, { headers });
      if (res.data.success) {
        setCrawlerStatus(res.data.data);
      }
    } catch (error) {
      console.error('Lỗi khi lấy trạng thái crawler:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socketUrl = SOCKET_URL; // Cùng URL với backend
    const newSocket = io(socketUrl, {
      //auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected', newSocket.id);
    });

    newSocket.on('crawl-progress', (data) => {
      setCrawlerStatus(data);
    });

    // 1. Lắng nghe các tính năng AI  (Hợp đồng, Biểu mẫu, Video...)
    newSocket.on('new_activity', (data) => {
      console.log(' AI Feature vừa được sử dụng:', data);
      fetchFeatureUsage(timeframe);
    });

    // 2. LẮNG NGHE SỰ KIỆN CHATBOT TỪ BACKEND
    newSocket.on('new_chat_message', (data) => {
      console.log(' Chatbot vừa có tin nhắn mới:', data);
      // Gọi lại API thống kê để cột Chatbot nhảy số real-time
      fetchFeatureUsage(timeframe);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect error', err);
    });

    fetchCrawlerStatus();

    // 3. Dọn dẹp 
    return () => {
      newSocket.off('connect');
      newSocket.off('crawl-progress');
      newSocket.off('new_activity');
      newSocket.off('new_chat_message');
      newSocket.disconnect();
    };
  }, [timeframe]);
  const getStepIcon = (step) => {
    switch (step) {
      case 'check':
        return <Clock size={18} className="text-blue-400" />;
      case 'crawl':
        return <Play size={18} className="text-yellow-400 animate-spin" />;
      case 'classify':
        return <Clock size={18} className="text-purple-400" />;
      case 'sql':
        return <Play size={18} className="text-green-400" />;
      case 'pinecone':
        return <CheckCircle2 size={18} className="text-cyan-400" />;
      case 'done':
        return <CheckCircle2 size={18} className="text-green-400" />;
      case 'error':
        return <XCircle size={18} className="text-red-400" />;
      default:
        return <Clock size={18} className="text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (crawlerStatus.isRunning) {
      return `Đang tự động thu thập: ${crawlerStatus.current}/${crawlerStatus.total} văn bản`;
    }


    if (crawlerStatus.step === 'done') {
      return 'Hoàn thành thu thập';
    }

    return 'Hệ thống đang nghỉ';
  };

  const handleTimeframeChange = (value) => {
    setTimeframe(value);
  };

  const maxUsageCount = useMemo(() => {
    return featureUsage.reduce((max, item) => Math.max(max, item.UsageCount || 0), 1);
  }, [featureUsage]);

  const glassClass = 'bg-white/80 backdrop-blur-xl border border-amber-200 shadow-2xl overflow-hidden';
  const cardClass = 'bg-gray-50 rounded-3xl border border-gray-200 p-5 shadow-xl';

  const stepOrder = (() => {
    switch (crawlerStatus.step) {
      case 'check':
      case 'crawl':
      case 'classify':
        return 1;
      case 'sql':
        return 2;
      case 'pinecone':
      case 'done':
        return 3;
      default:
        return 0;
    }
  })();

  return (

    <div className="fixed inset-0 z-[200] w-full h-screen bg-white text-gray-900 font-sans selection:bg-amber-500/30 flex">

      {/*  SIDEBAR ADMIN */}
      <AdminSidebar />

      {/* 🔵 MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">

        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Trung tâm Điều khiển Pháp lý</h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-[0.2em]">Giám sát Hoạt động & Nhập liệu Dữ liệu</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-amber-600 uppercase">Trạng thái Hệ thống</span>
              <span className="text-xs text-gray-900 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-ping" /> Tất cả Hệ thống Hoạt động</span>
            </div>
          </div>
        </header>

        {/* --- GRID CHÍNH --- */}
        <div className="grid grid-cols-12 gap-6">

          {/* BÊN TRÁI (8 CỘT): KPI & BIỂU ĐỒ (Dùng Flex Column để ép sát layout) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

            {/* Hàng KPI */}
            <div className="grid grid-cols-3 gap-6">
              <KPICard label="Tổng số Người dùng" value={loading ? "..." : totalUsers.toLocaleString()} change="+12%" icon={Users} color="cyan" />
              <KPICard label="Hồ sơ Pháp lý AI" value={loading ? "..." : aiRecords.toLocaleString()} change="+8%" icon={Zap} color="indigo" />
              <div className={`${glassClass} p-5 rounded-3xl flex flex-col justify-between`}>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Dung lượng Vector</span>
                  <Database size={16} className="text-amber-600" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-bold text-gray-900 mb-2">
                    <span>{loading ? "..." : `${vectorQuota.used.toLocaleString()} / ${vectorQuota.total.toLocaleString()}`}</span>
                    <span className="text-amber-600">{loading ? "..." : `${Math.round((vectorQuota.used / vectorQuota.total) * 100)}%`}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: loading ? '0%' : `${(vectorQuota.used / vectorQuota.total) * 100}%` }} className="h-full bg-gradient-to-r from-amber-500 to-amber-600" />
                  </div>
                </div>
              </div>
            </div>
            {/* Hàng Biểu Đồ */}
            <div className={`${glassClass} h-[260px] rounded-[2.5rem] p-5 flex flex-col`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-900">Tính năng Sử dụng Nhiều nhất</span>
                  <p className="text-[10px] text-gray-600 mt-0.5">Xem theo {timeframe === 'week' ? 'Tuần' : timeframe === 'month' ? 'Tháng' : 'Năm'}</p>
                </div>
                <select
                  value={timeframe}
                  onChange={(e) => handleTimeframeChange(e.target.value)}
                  className="bg-white border border-gray-200 text-[10px] text-gray-900 px-3 py-1.5 rounded-xl outline-none focus:border-amber-500"
                >
                  <option value="week">Tuần</option>
                  <option value="month">Tháng</option>
                  <option value="year">Năm</option>
                </select>
              </div>

              {/* Thay đổi class justify-center để khi biểu đồ thu gọn lại nó vẫn nằm giữa khung */}
              <div className="flex-1 flex items-end justify-center gap-4 md:gap-8 px-2 pb-1 mt-2">
                {featureUsageLoading ? (
                  <div className="flex items-center justify-center w-full h-full text-xs text-gray-500">Đang tải thông kê tính năng...</div>
                ) : (
                  /* --- LOGIC MERGE BASELINE: ĐẢM BẢO LUÔN HIỆN 5 CỘT --- */
                  (() => {
                    // 1. Danh sách tính năng cốt lõi (Gắn cứng)
                    const CORE_FEATURES = [
                      'VIDEO_ANALYSIS',
                      'CONTRACT_REVIEW',
                      'FORM_GENERATOR',
                      'PLANNING',
                      'CHATBOT'
                    ];
                    // 2. Map data: Tìm trong API, có thì lấy số, không có thì ép về 0
                    const displayFeatures = CORE_FEATURES.map(featName => {
                      const found = featureUsage.find(item => item.FeatureName === featName);
                      return {
                        FeatureName: featName,
                        UsageCount: found ? found.UsageCount : 0
                      };
                    });

                    // 3. Tìm mốc cao nhất để chia phần trăm (dùng Math.max với 1 để không bao giờ chia cho 0)
                    const currentMaxUsage = Math.max(...displayFeatures.map(item => item.UsageCount), 1);

                    return displayFeatures.map((item, idx) => {
                      const percent = Math.min(100, (item.UsageCount / currentMaxUsage) * 100);

                      return (
                        // Ép max-w-[80px] để cột thon thả, không bị phình to
                        <div key={`${item.FeatureName}-${idx}`} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end max-w-[80px]">

                          {/* Cột biểu đồ */}
                          <div className="w-full relative flex flex-col justify-end h-24">
                            <motion.div
                              initial={{ height: 0 }}
                              // Cột 0 lượt sẽ cao 2% để chừa lại vạch xám mỏng
                              animate={{ height: item.UsageCount === 0 ? '2%' : `${percent}%` }}
                              className={`w-full rounded-t-md relative transition-all duration-300 ${item.UsageCount === 0
                                ? 'bg-gray-200' // Màu xám chìm cho cột 0
                                : 'bg-gradient-to-t from-amber-500/40 to-amber-600/80 group-hover:from-amber-500/60 group-hover:to-amber-700'
                                }`}
                            >
                              {/* Tooltip */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black text-amber-600 bg-white/80 border border-amber-200 px-2 py-0.5 rounded backdrop-blur-md whitespace-nowrap z-10 pointer-events-none">
                                {item.UsageCount} lượt
                              </div>
                            </motion.div>
                          </div>

                          {/* Tên tính năng (0 lượt thì chữ chìm đi) */}
                          <span className={`text-[9px] font-bold uppercase tracking-tighter text-center transition-colors h-8 w-full break-words leading-tight ${item.UsageCount === 0 ? 'text-gray-500' : 'text-gray-700 group-hover:text-gray-900'}`}>
                            {item.FeatureName.replace('_', ' ')}
                          </span>

                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            <div className={`${glassClass} rounded-[2.5rem] p-6 flex flex-col gap-5`}>
              <div className={`${cardClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Giám sát Pipeline</span>
                    <div className="mt-3 text-2xl font-black text-gray-900 tracking-tight">{getStatusText()}</div>
                    {crawlerStatus.title && <p className="mt-2 text-sm text-gray-600">{crawlerStatus.title}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-3xl bg-amber-50 flex items-center justify-center">
                      <Clock size={20} className="text-amber-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-gray-600">Tiến độ</div>
                      <div className="text-sm font-semibold text-gray-900">{crawlerStatus.current}/{crawlerStatus.total}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${cardClass}`}>
                <div className="flex items-center gap-3">
                  <PipelineStep
                    icon={CloudArrowUpIcon}
                    label="Thu thập"
                    status={stepOrder === 0 ? 'pending' : stepOrder === 1 ? 'active' : 'complete'}
                    active={stepOrder === 1}
                  />

                  {/* THANH NỐI 1: TỪ THU THẬP -> SSMS */}
                  <div className="relative flex-1 h-0.5 bg-gray-200">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-amber-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.min(100, Math.max(0, ((stepOrder || 0) - 1) * 100))}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>

                  <PipelineStep
                    icon={Database}
                    label="DỒNG BỘ SSMS"
                    status={stepOrder < 2 ? 'pending' : stepOrder === 2 ? 'active' : 'complete'}
                    active={stepOrder === 2}
                  />

                  {/* THANH NỐI 2: TỪ SSMS -> PINECONE */}
                  <div className="relative flex-1 h-0.5 bg-gray-200">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-amber-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.min(100, Math.max(0, ((stepOrder || 0) - 2) * 100))}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>

                  <PipelineStep
                    icon={Zap}
                    label="Đồng bộ Pinecone"
                    status={stepOrder < 3 ? 'pending' : stepOrder === 3 ? 'active' : 'complete'}
                    active={stepOrder === 3}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* BÊN PHẢI (4 CỘT): LỊCH SỬ PHÂN TÍCH AI */}
          <div className={`${glassClass} col-span-12 lg:col-span-4 rounded-[2.5rem] p-6 flex flex-col`}>
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md -mx-6 -mt-6 px-6 py-4 mb-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Lịch sử Phân tích AI</h3>
                <Activity size={16} className="text-amber-600" />
              </div>
            </div>

            {/* Vùng chứa danh sách với chiều cao cố định */}
            <div className="h-[580px] overflow-y-auto custom-scrollbar">
              {historyLoading ? (
                <div className="text-center py-10 text-gray-500">Đang tải lịch sử phân tích...</div>
              ) : historyItems.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Search size={48} className="text-gray-100 mb-4" />
                  <p className="text-[11px] italic text-gray-400">Hệ thống chưa ghi nhận hoạt động nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyItems.map((item, index) => {
                    const prevItem = historyItems[index - 1];
                    const isSameUser = prevItem && prevItem.FullName === item.FullName;
                    const getIcon = (recordType) => {
                      switch (recordType) {
                        case 'CONTRACT':
                          return { icon: Scale, bg: 'bg-amber-50', text: 'text-amber-600' };
                        case 'CHATBOT':
                          return { icon: MessageSquare, bg: 'bg-purple-50', text: 'text-purple-600' };
                        case 'PLANNING':
                          return { icon: Zap, bg: 'bg-amber-50', text: 'text-amber-600' };
                        case 'FORM_GEN':
                          return { icon: Database, bg: 'bg-cyan-50', text: 'text-cyan-600' };
                        case 'VIDEO_ANALYSIS':
                          return { icon: Play, bg: 'bg-rose-50', text: 'text-rose-600' };
                        default:
                          return { icon: Activity, bg: 'bg-gray-50', text: 'text-gray-600' };
                      }
                    };
                    const { icon: IconComponent, bg, text } = getIcon(item.RecordType);
                    const isSuccess = item.Outcome === 'Success' || item.Outcome === 'Completed' || item.Outcome === 'Thành công';

                    return (
                      <div
                        key={item.Id}
                        className={`group rounded-[2rem] bg-gray-50/50 border border-gray-100 p-4 hover:bg-white/80 hover:backdrop-blur-sm hover:border-amber-200/40 hover:shadow-xl hover:shadow-amber-500/5 hover:translate-x-1 transition-all duration-300 ${isSameUser ? 'border-l-2 border-gray-50 pl-6' : ''}`}
                      >
                        {/* Hàng 1: Thời gian & Status Dot */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">
                              {new Date(item.EventTime).toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>

                        {/* Hàng 2: Nội dung chính với Icon */}
                        <div className="flex items-start gap-4">
                          {/* Soft Glow Badge */}
                          <div className={`p-2.5 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${bg} ${text}`}>
                            <IconComponent size={18} />
                          </div>

                          <div className="flex-1 min-w-0">
                            {!isSameUser && (
                              <p className="text-sm font-bold text-gray-900 leading-tight mb-1">
                                {item.FullName || 'Người dùng'}
                              </p>
                            )}
                            <p className="text-sm text-gray-900 leading-tight">
                              <span className="text-gray-500 font-medium">đã dùng </span>
                              <span className="font-black text-amber-600 underline underline-offset-4 decoration-amber-200">
                                {item.DisplayName}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>


        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.1); border-radius: 10px; }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// --- SUB COMPONENTS ---

function KPICard({ label, value, change, icon: Icon, color }) {
  return (
    <div className={`bg-white/80 backdrop-blur-xl border border-amber-200 p-5 rounded-3xl flex flex-col justify-between shadow-xl`}>
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">{label}</span>
        <Icon size={18} className={`text-amber-600`} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-black text-gray-900 tracking-tighter">{value}</span>
        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{change}</span>
      </div>
    </div>
  );
}
function PipelineStep({ icon: Icon, label, status, active }) {
  return (

    <div className="flex flex-col items-center gap-2 group w-24 text-center">

      {/* Tăng hộp Icon từ w-8/h-8 lên w-10/h-10 */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${status === 'complete' ? 'bg-amber-50 border-amber-500 text-amber-600' :
        status === 'active' ? 'bg-amber-500 border-amber-600 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]' :
          'bg-gray-50 border-gray-200 text-gray-400'
        }`}>
        <Icon size={16} /> {/* Tăng size icon bên trong từ 14 lên 16 */}
      </div>


      <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${active ? 'text-amber-600' : 'text-gray-600'}`}>
        {label}
      </span>

    </div>
  );
}
const CloudArrowUpIcon = (props) => (
  <motion.svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </motion.svg>
);