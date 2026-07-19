import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronDown, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";

export default function SchemeBrowser() {
  const [schemes, setSchemes] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState({
    state: "",
    category: "",
    gender: "",
    age: "",
    caste: "",
    residence: ""
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.publicSchemes();
        setSchemes(res.schemes || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const displayedSchemes = useMemo(() => {
    return schemes.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.category && s.category !== filters.category) return false;
      if (filters.state && !(s.state_applicable || []).includes("ALL") && !(s.state_applicable || []).includes(filters.state)) return false;
      if (activeTab === "state" && s.level !== "State") return false;
      if (activeTab === "central" && s.level !== "Central") return false;
      return true;
    });
  }, [schemes, search, filters, activeTab]);

  const categories = useMemo(() => {
    return Array.from(new Set(schemes.map(s => s.category).filter(Boolean)));
  }, [schemes]);

  const states = useMemo(() => {
    const allStates = new Set();
    schemes.forEach(s => (s.state_applicable || []).forEach(st => allStates.add(st)));
    return Array.from(allStates).filter(s => s !== "ALL");
  }, [schemes]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] selection:bg-blue-100">
      <GovHeader />

      <main className="flex-1 wrap py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/" className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1">
             &larr; Back
          </Link>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-8">
          
          {/* Sidebar */}
          <aside className="bg-white border border-[var(--line)] rounded-xl p-6 h-max sticky top-24 shadow-sm hidden lg:block">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4 mb-4">
              <h3 className="font-heading font-bold text-[var(--ink)]">Filter By</h3>
              <button 
                onClick={() => setFilters({state:"", category:"", gender:"", age:"", caste:"", residence:""})}
                className="text-xs font-bold text-green-700 hover:underline"
              >
                Reset Filters
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-[var(--ink)] block mb-2">State/UT</label>
                <select 
                  className="w-full field py-2 text-sm"
                  value={filters.state}
                  onChange={e => setFilters({...filters, state: e.target.value})}
                >
                  <option value="">Select</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-[var(--ink)] block mb-2">Scheme Category</label>
                <select 
                  className="w-full field py-2 text-sm"
                  value={filters.category}
                  onChange={e => setFilters({...filters, category: e.target.value})}
                >
                  <option value="">Select</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

            </div>
          </aside>

          {/* Main List */}
          <section>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Enter scheme name to search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full field py-3 pl-10 pr-4 text-[15px] border-gray-300 rounded-full shadow-sm"
              />
            </div>

            <div className="flex border-b border-[var(--line)] mb-6 gap-6">
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'all' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('all')}
              >All Schemes</button>
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'state' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('state')}
              >State/UT Schemes</button>
              <button 
                className={`font-bold pb-2 text-sm ${activeTab === 'central' ? 'border-b-2 border-green-700 text-green-800' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                onClick={() => setActiveTab('central')}
              >Central Schemes</button>
            </div>

            <p className="text-sm font-bold text-[var(--muted)] mb-6">
              Total <span className="text-[var(--ink)]">{displayedSchemes.length}</span> schemes available
            </p>

            <div className="space-y-4">
              {displayedSchemes.map(s => (
                <Link to={`/schemes/${s.scheme_id}`} key={s.scheme_id} className="block card p-6 bg-white border border-[var(--line)] rounded-xl hover:border-green-600 hover:shadow-md transition-all">
                  <h2 className="text-xl font-heading font-bold text-[var(--ink)]">{s.name}</h2>
                  <p className="text-sm text-[var(--muted)] mt-1">{s.ministry || "Government of India"}</p>
                  
                  <p className="mt-4 text-sm text-[var(--ink)] line-clamp-2">
                    {s.benefits?.description || "A scheme provided by the government to offer financial and social assistance to eligible citizens."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {s.category && (
                       <span className="px-3 py-1 text-xs font-bold text-green-700 border border-green-600 rounded-full">
                         {s.category}
                       </span>
                    )}
                    {s.level && (
                       <span className="px-3 py-1 text-xs font-bold text-green-700 border border-green-600 rounded-full">
                         {s.level}
                       </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            
            {displayedSchemes.length === 0 && (
              <div className="text-center py-20 text-[var(--muted)]">
                No schemes found matching your filters.
              </div>
            )}
          </section>
        </div>
      </main>

      <GovFooter />
    </div>
  );
}
