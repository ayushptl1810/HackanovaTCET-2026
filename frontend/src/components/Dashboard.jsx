import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ArrowRight,
  FileText,
  TrendingUp,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
  Bell,
  BadgeCheck,
  Download,
  Upload,
  ExternalLink,
  Shield,
  Home,
  HardDrive,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Zap,
  Target,
  BarChart3,
  Wallet,
  Fingerprint,
  CreditCard,
  Building2,
  Menu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import logoImg from "../assets/portal_in_logo.png";

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAutoApplying, setIsAutoApplying] = useState(false);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- Mock Data ---
  const [appliedSchemes, setAppliedSchemes] = useState([
    {
      id: 1,
      name: "Pradhan Mantri Awas Yojana",
      date: "2024-03-10",
      status: "Approved",
      category: "Housing",
      amount: "₹2,50,000",
    },
    {
      id: 2,
      name: "Atal Pension Yojana",
      date: "2024-02-15",
      status: "Active",
      category: "Pension",
      amount: "₹5,000/mo",
    },
    {
      id: 3,
      name: "Ayushman Bharat",
      date: "2024-01-20",
      status: "Verified",
      category: "Healthcare",
      amount: "₹5,00,000 Cover",
    },
  ]);

  const documents = [
    {
      id: 1,
      name: "Aadhaar Card",
      type: "Identity",
      date: "2023-12-01",
      issuer: "UIDAI",
      icon: Fingerprint,
      color: "text-blue-700",
    },
    {
      id: 2,
      name: "PAN Card",
      type: "Tax",
      date: "2023-12-05",
      issuer: "Income Tax Dept",
      icon: CreditCard,
      color: "text-blue-700",
    },
    {
      id: 3,
      name: "Academic Certificate",
      type: "Education",
      date: "2024-01-12",
      issuer: "CBSE",
      icon: Building2,
      color: "text-blue-700",
    },
  ];

  const investments = {
    totalValue: "₹1,24,500",
    profit: "+12.4%",
    monthlyGrowth: "₹1,420",
    allocation: [
      {
        label: "Rural Infrastructure",
        value: 65,
        color: "#1e40af",
        secondaryColor: "#1d4ed8",
        description: "Gram Sadak & Irrigation",
      },
      {
        label: "Healthcare Systems",
        value: 45,
        color: "#1e3a8a",
        secondaryColor: "#1e40af",
        description: "PMJAY Networks",
      },
      {
        label: "Digital India",
        value: 55,
        color: "#2563eb",
        secondaryColor: "#3b82f6",
        description: "Broadband & UPI",
      },
    ],
  };

  const handleAutoApply = () => {
    setIsAutoApplying(true);
    toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
      loading: "Authenticating eligibility with central registry...",
      success: () => {
        const newScheme = {
          id: Date.now(),
          name: "Lakhpati Didi Scheme",
          date: new Date().toISOString().split("T")[0],
          status: "Processing",
          category: "Skill Dev",
          amount: "₹1,00,000",
        };
        setAppliedSchemes([newScheme, ...appliedSchemes]);
        setIsAutoApplying(false);
        return "Application successfully initiated.";
      },
      error: "System busy. Please try later.",
    });
  };

  const handleLogout = () => {
    toast.success("Successfully logged out");
    onLogout();
    navigate("/login");
  };

  return (
    <div
      className={`flex flex-col min-h-screen ${isDarkMode ? "bg-[#0b0e14] text-white" : "bg-white text-slate-900"} font-sans transition-colors duration-500`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `,
        }}
      />

      {/* Top Header - Official Style */}
      <header
        className={`h-20 px-10 flex items-center justify-between sticky top-0 z-[100] border-b ${isDarkMode ? "bg-[#0b0e14] border-white/10" : "bg-white border-slate-200"}`}
      >
        <div className="flex items-center gap-12">
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => setActiveTab("dashboard")}
          >
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200 shadow-sm overflow-hidden">
              <img
                src={logoImg}
                alt="Logo"
                className="w-full h-full object-cover p-1"
              />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-slate-800">
                PORTAL<span className="text-blue-700">.</span>IN
              </h1>
              <p className="text-[7px] font-black tracking-[0.4em] uppercase text-slate-500 mt-1">
                Government of India
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <span className="text-blue-700 border-b-2 border-blue-700 pb-1 cursor-pointer">
              Dashboard
            </span>
            <span className="hover:text-slate-800 cursor-pointer transition-colors">
              Issued Documents
            </span>
            <span className="hover:text-slate-800 cursor-pointer transition-colors">
              Public Schemes
            </span>
            <span className="hover:text-slate-800 cursor-pointer transition-colors">
              Verification Hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative group hidden lg:block">
            <Search
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-white/20" : "text-slate-400"}`}
              size={16}
            />
            <input
              type="text"
              placeholder="SEARCH SERVICES OR DOCUMENTS"
              className={`w-96 py-2.5 pl-12 pr-4 rounded-lg text-[10px] font-bold tracking-wider outline-none border transition-all ${isDarkMode ? "bg-white/5 border-white/10 focus:bg-white/10" : "bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-400"}`}
            />
          </div>

          <div className="flex items-center gap-5 border-l border-slate-200 pl-6">
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-lg border transition-all ${isDarkMode ? "border-white/10 text-amber-400 hover:bg-white/5" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              {isDarkMode ?
                <Sun size={18} />
              : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-xs text-slate-800">AYUSH PATEL</p>
                <p className="text-[8px] font-black text-blue-700 uppercase tracking-widest">
                  Verified Individual
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 p-0.5 relative cursor-pointer border border-slate-200">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ayush"
                  alt="Profile"
                  className="rounded-[6px]"
                />
                <div className="absolute -bottom-1 -right-1 bg-green-600 rounded-full p-0.5 border-2 border-white shadow-sm">
                  <BadgeCheck size={10} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Simple Professional Style */}
        <aside
          className={`w-64 border-r ${isDarkMode ? "border-white/10 bg-[#0e121a]" : "bg-slate-50 border-slate-200"} flex flex-col`}
        >
          <nav className="p-6 space-y-1.5 mt-2">
            {[
              { id: "dashboard", icon: Home, label: "Home" },
              { id: "documents", icon: HardDrive, label: "Issued Documents" },
              { id: "drive", icon: FileText, label: "DigiLocker Drive" },
              { id: "schemes", icon: Briefcase, label: "Applied Schemes" },
              {
                id: "investments",
                icon: TrendingUp,
                label: "Wealth Portfolio",
              },
              { id: "settings", icon: Settings, label: "Account Settings" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeTab === item.id ?
                    "bg-blue-700 text-white shadow-md"
                  : `hover:bg-slate-200/50 ${isDarkMode ? "text-white/40 hover:text-white" : "text-slate-500 hover:text-blue-700"}`
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto p-6 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all font-bold text-[10px] uppercase tracking-widest"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Official Content Workspace */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc] p-10">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start max-w-[1400px] mx-auto w-full">
            <div className="xl:col-span-8 space-y-8">
              {/* Professional Investment Analytics */}
              <div
                className={`p-10 rounded-3xl border ${isDarkMode ? "bg-[#0e121a] border-white/10" : "bg-white border-slate-200 shadow-sm"}`}
              >
                <div className="space-y-10">
                  <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-slate-800 uppercase italic">
                        Financial Inclusion Overview
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Live Asset Allocation Verification
                      </p>
                    </div>
                    <div className="flex gap-10">
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          Net Portfolio
                        </p>
                        <p className="text-2xl font-black text-slate-800">
                          {investments.totalValue}
                        </p>
                      </div>
                      <div className="text-right border-l pl-10 border-slate-200">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-green-600">
                          Total Return
                        </p>
                        <p className="text-2xl font-black text-green-600">
                          {investments.profit}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-10 h-72 items-end px-4">
                    {investments.allocation.map((item, idx) => (
                      <div
                        key={item.label}
                        className="col-span-4 flex flex-col h-full justify-end"
                      >
                        <div
                          className="w-full rounded-xl transition-all duration-500 shadow-sm flex items-end justify-center"
                          style={{
                            height: `${item.value}%`,
                            background: `linear-gradient(to top, ${item.color}, ${item.secondaryColor})`,
                          }}
                        >
                          <span className="text-white/20 text-[8px] font-bold tracking-widest mb-4">
                            VERIFIED
                          </span>
                        </div>
                        <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-slate-500 text-center">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 border border-slate-100">
                      <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center">
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">
                          Avg. Monthly Yield
                        </p>
                        <p className="text-lg font-black text-blue-700">
                          +{investments.monthlyGrowth}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 border border-slate-100">
                      <div className="w-10 h-10 bg-blue-900 text-white rounded-lg flex items-center justify-center">
                        <Shield size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">
                          Risk Assessment
                        </p>
                        <p className="text-lg font-black text-slate-800">
                          GOVT-SECURED
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Application Tracking */}
              <div className="space-y-6">
                <h3 className="text-lg font-black tracking-tight text-slate-800 uppercase italic px-2">
                  Recent Application Activity
                </h3>
                <div
                  className={`rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm`}
                >
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Scheme Designation
                        </th>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Workflow Status
                        </th>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">
                          Benefit Value
                        </th>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">
                          Certificate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {appliedSchemes.map((scheme) => (
                        <tr
                          key={scheme.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-8 py-6">
                            <p className="text-sm font-bold text-slate-800">
                              {scheme.name}
                            </p>
                            <p className="text-[9px] font-medium text-slate-400 uppercase mt-1">
                              {scheme.category} • {scheme.date}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <div
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${
                                scheme.status === "Approved" ?
                                  "bg-green-600 text-white"
                                : scheme.status === "Verified" ?
                                  "bg-orange-600 text-white"
                                : "bg-blue-700 text-white"
                              }`}
                            >
                              {scheme.status === "Approved" ?
                                <CheckCircle2 size={10} />
                              : <Clock size={10} />}
                              {scheme.status}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center text-xs font-bold text-slate-600">
                            {scheme.amount}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-blue-700 transition-all">
                              <Download size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Side Workflow Actions */}
            <div className="xl:col-span-4 space-y-8">
              {/* ELIGIBILITY SCAN COMPLETED - Official Header at Top */}
              <div className="rounded-3xl bg-blue-700 text-white shadow-lg overflow-hidden flex flex-col">
                <div className="p-8 pb-10 space-y-8 flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-black tracking-tight leading-none uppercase italic">
                      ELIGIBILITY SCAN COMPLETED
                    </h4>
                    <span className="bg-white/10 px-2 py-1 rounded text-[8px] font-bold tracking-[0.2em]">
                      LIVE STATUS
                    </span>
                  </div>

                  <div className="space-y-4">
                    <p className="text-blue-100 text-[11px] leading-relaxed font-bold uppercase tracking-wider">
                      System verification identified 3 public welfare schemes
                      matching your demographic criteria.
                    </p>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-[10px] font-medium text-blue-200">
                        Matched Schemes: 3
                      </p>
                      <p className="text-[10px] font-medium text-blue-200">
                        Processing Mode: 1-Click Sync
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleAutoApply}
                    disabled={isAutoApplying}
                    className="w-full h-14 rounded-xl bg-white text-blue-800 font-black uppercase tracking-[0.2em] text-[10px] shadow-sm hover:bg-blue-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    {isAutoApplying ?
                      <Clock size={16} className="animate-spin" />
                    : <>
                        INITIATE APPLICATIONS <ArrowRight size={16} />
                      </>
                    }
                  </button>
                </div>
              </div>

              {/* Document Vault - Professional Solid IDs */}
              <div
                className={`p-8 rounded-3xl border bg-white border-slate-200 shadow-sm space-y-6`}
              >
                <div className="flex items-center justify-between border-b pb-4 border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">
                    Verified Individual Assets
                  </h3>
                  <p className="text-[8px] font-bold text-blue-700 uppercase tracking-widest cursor-pointer">
                    View Drive
                  </p>
                </div>

                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-blue-300 transition-all cursor-pointer group flex items-center gap-4"
                    >
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-all shadow-sm">
                        <doc.icon size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">
                          {doc.name}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-wider">
                          {doc.issuer}
                        </p>
                      </div>
                      <Download
                        size={14}
                        className="text-slate-300 group-hover:text-blue-700 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400 hover:border-blue-400 hover:text-blue-700 hover:bg-white flex flex-col items-center gap-2 transition-all">
                  <Upload size={18} />
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    Manual Document Upload
                  </span>
                </button>
              </div>

              <div className="flex items-start gap-4 p-6 bg-white border border-slate-200 rounded-3xl">
                <Shield className="text-blue-400 shrink-0" size={20} />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-700">
                    Security Protocol
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed mt-1">
                    System identity verified via 256-bit secure gateway.
                    Transactional integrity is monitored.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
