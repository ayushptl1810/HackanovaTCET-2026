import React, { useState, useEffect, useRef } from "react";
import { User, ShieldCheck, Smartphone, Lock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import loginVid from "../assets/login_bounce.mp4";

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("citizen"); // 'citizen' or 'csc'
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mobile_number: "",
    pin: "",
    csc_id: "",
    password: "",
  });
  const videoRef = useRef(null);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const endpoint =
      activeTab === "citizen" ?
        "http://localhost:8000/api/login/citizen"
      : "http://localhost:8000/api/login/csc";

    const payload =
      activeTab === "citizen" ?
        { mobile_number: formData.mobile_number, pin: formData.pin }
      : { csc_id: formData.csc_id, password: formData.password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Welcome back, ${activeTab === "citizen" ? "Citizen" : "Partner"}!`,
        );
        onLoginSuccess();
        navigate("/citizen-dashboard");
      } else {
        toast.error(data.detail || "Login failed. Please try again.");
      }
    } catch (err) {
      toast.error("Unable to connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSpeed = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5;
    }
  };

  useEffect(() => {
    handleVideoSpeed();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#05070a] font-sans text-white overflow-hidden selection:bg-orange-500/30">
      {/* Left side: Background video for 3D model/graphic */}
      <div className="hidden lg:flex lg:flex-1 relative items-center justify-center bg-black overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 z-0 scale-105">
          <video
            ref={videoRef}
            src={loginVid}
            autoPlay
            loop
            muted
            playsInline
            onPlay={handleVideoSpeed}
            onLoadedMetadata={handleVideoSpeed}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-transparent to-green-500/10 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        </div>
        <div className="relative z-10 w-full h-full"></div>
      </div>

      {/* Right side: Login form container */}
      <div className="w-full lg:w-[540px] flex flex-col bg-[#07090e] z-10 p-8 md:p-16 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <div className="mb-12 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">
                Portal<span className="text-orange-500">.</span>IN
              </h1>
              <div className="flex gap-1 h-0.5 mt-1">
                <div className="w-4 bg-orange-500"></div>
                <div className="w-4 bg-white/20"></div>
                <div className="w-4 bg-green-600"></div>
              </div>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            Welcome Back
          </h2>
          <p className="text-white/50 font-medium">Sign in to your account</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl mb-10 overflow-hidden">
          <button
            onClick={() => setActiveTab("citizen")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 relative ${
              activeTab === "citizen" ? "text-white" : (
                "text-white/30 hover:text-white/60"
              )
            }`}
          >
            {activeTab === "citizen" && (
              <div className="absolute inset-0 bg-orange-500 rounded-xl shadow-[0_0_20px_rgba(255,153,51,0.2)] z-0"></div>
            )}
            <User size={16} className="relative z-10" />
            <span className="relative z-10">Citizen</span>
          </button>
          <button
            onClick={() => setActiveTab("csc")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 relative ${
              activeTab === "csc" ? "text-white" : (
                "text-white/30 hover:text-white/60"
              )
            }`}
          >
            {activeTab === "csc" && (
              <div className="absolute inset-0 bg-blue-700 rounded-xl shadow-[0_0_20px_rgba(0,0,128,0.2)] z-0"></div>
            )}
            <ShieldCheck size={16} className="relative z-10" />
            <span className="relative z-10">CSC User</span>
          </button>
        </div>

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="space-y-8 flex-1">
          {activeTab === "citizen" ?
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
                  Mobile Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-orange-500 transition-colors">
                    <Smartphone size={18} />
                  </div>
                  <input
                    type="tel"
                    name="mobile_number"
                    value={formData.mobile_number}
                    onChange={handleInputChange}
                    placeholder="Enter mobile number"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-orange-500/50 focus:bg-white/[0.04] transition-all text-white placeholder:text-white/10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                    Security PIN
                  </label>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase tracking-widest transition-colors"
                  >
                    Forgot PIN?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-orange-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    name="pin"
                    value={formData.pin}
                    onChange={handleInputChange}
                    maxLength={6}
                    placeholder="••••••"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-orange-500/50 focus:bg-white/[0.04] transition-all text-white tracking-[0.6em] placeholder:tracking-normal placeholder:text-white/10 font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          : <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
                  CSC ID
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-blue-500 transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    name="csc_id"
                    value={formData.csc_id}
                    onChange={handleInputChange}
                    placeholder="Enter CSC ID"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all text-white placeholder:text-white/10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                  >
                    Reset?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-blue-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-blue-500/50 focus:bg-white/[0.04] transition-all text-white placeholder:text-white/10"
                    required
                  />
                </div>
              </div>
            </div>
          }

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full relative py-5 rounded-2xl font-bold text-white uppercase tracking-[.2em] transition-all duration-300 transform active:scale-[0.98] group overflow-hidden ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              <div
                className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                style={{
                  backgroundColor:
                    activeTab === "citizen" ? "#FF9933" : "#000080",
                  boxShadow:
                    activeTab === "citizen" ?
                      "0 15px 30px -5px rgba(255,153,51,0.3)"
                    : "0 15px 30px -5px rgba(0, 0, 128, 0.3)",
                }}
              ></div>
              <span className="relative z-10 flex items-center justify-center gap-3">
                {loading ?
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Authenticating...
                  </div>
                : <>
                    Sign In
                    <ArrowRight
                      size={20}
                      className="group-hover:translate-x-1.5 transition-transform duration-300"
                    />
                  </>
                }
              </span>
            </button>
          </div>
        </form>

        <div className="mt-12 text-center text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">
          <div className="flex items-center justify-center gap-10 mb-6">
            <button className="hover:text-white transition-colors">Help</button>
            <button className="hover:text-white transition-colors">
              Privacy
            </button>
            <button className="hover:text-white transition-colors">
              Security
            </button>
          </div>
          <p className="tracking-[0.4em] leading-relaxed">
            NIC Portal Infrastructure <br />
            <span className="text-[9px] text-white/40 font-medium tracking-normal">
              Copyright © 2026 Ministry of IT, India
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
