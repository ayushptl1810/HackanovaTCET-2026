import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, ExternalLink, Share2, Facebook, Twitter, Linkedin, Mail } from "lucide-react";
import { api } from "../api";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";

export default function SchemeDetails() {
  const { id } = useParams();
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSchemeById(id);
        if (res.success) {
          setScheme(res.scheme);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!scheme) {
    return (
      <div className="min-h-screen flex flex-col">
        <GovHeader />
        <main className="flex-1 flex items-center justify-center flex-col">
          <h2 className="text-2xl font-bold mb-4">Scheme Not Found</h2>
          <Link to="/schemes" className="text-blue-600 hover:underline">Back to schemes</Link>
        </main>
        <GovFooter />
      </div>
    );
  }

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const navItems = [
    { id: 'details', label: 'Details' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'eligibility', label: 'Eligibility' },
    { id: 'application-process', label: 'Application Process' },
    { id: 'documents-required', label: 'Documents Required' },
    { id: 'faqs', label: 'Frequently Asked Questions' },
    { id: 'sources', label: 'Sources And References' }
  ];

  const shareUrl = window.location.href;
  const shareTitle = scheme?.name || 'Government Scheme';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('URL copied to clipboard!');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-blue-100">
      <GovHeader />

      {/* Breadcrumb */}
      <div className="border-b border-[var(--line)] bg-[var(--surface-2)]">
        <div className="wrap py-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link to="/schemes" className="text-blue-600 font-bold hover:underline">&larr; Back</Link>
        </div>
      </div>

      <main className="flex-1 wrap py-8">
        <div className="grid lg:grid-cols-[250px_1fr_300px] gap-10">
          
          {/* Left Navigation */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              {navItems.map(nav => (
                <button
                  key={nav.id}
                  onClick={() => scrollTo(nav.id)}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-[var(--ink)] hover:bg-gray-50 rounded-lg transition-colors border-l-4 border-transparent hover:border-green-600"
                >
                  {nav.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <section className="min-w-0">
            <p className="text-sm text-[var(--muted)] mb-2">{scheme.ministry || "Government of India"}</p>
            <h1 className="text-3xl font-heading font-bold text-[var(--ink)] mb-4">{scheme.name}</h1>
            
            <div className="flex flex-wrap gap-2 mb-8">
               {scheme.category && (
                 <span className="px-4 py-1 text-xs font-bold text-green-700 border border-green-600 rounded-full">
                   {scheme.category}
                 </span>
               )}
            </div>

            <Link to="/login" className="btn btn-outline border-blue-600 text-blue-700 mb-10 hover:bg-blue-50">
              Check Eligibility / Apply
            </Link>

            <div className="space-y-12 text-[15px] leading-relaxed text-[var(--body)]">
              
              <div id="details" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Details</h2>
                <p>{scheme.benefits?.description || "Detailed description is not available."}</p>
              </div>

              <div id="benefits" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Benefits</h2>
                <p><strong>Benefit Type:</strong> <span className="capitalize">{scheme.benefits?.type || "Other"}</span></p>
                <p className="mt-2">{scheme.benefit_amount || scheme.benefits?.description}</p>
              </div>

              <div id="eligibility" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Eligibility</h2>
                <ul className="list-disc pl-5 space-y-2">
                  {scheme.eligibility_rules?.map((rule, idx) => {
                    const opText = rule.operator.replace(/_/g, ' ');
                    return (
                      <li key={idx}>
                        <strong>{rule.profile_field.charAt(0).toUpperCase() + rule.profile_field.slice(1)}:</strong> must be {opText} {rule.value} {rule.is_mandatory && <span className="text-red-500 text-xs ml-1">(Mandatory)</span>}
                      </li>
                    )
                  })}
                  {!scheme.eligibility_rules?.length && <li>Eligibility rules are not explicitly defined in the database.</li>}
                </ul>
              </div>

              <div id="application-process" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Application Process</h2>
                <p><strong>Mode:</strong> <span className="capitalize">{scheme.application_mode || "Online/Offline"}</span></p>
                <div className="mt-4 space-y-2">
                  {scheme.application_process?.length > 0 ? (
                    scheme.application_process.map((step, i) => (
                      <p key={i}><strong>Step {i+1}:</strong> {step}</p>
                    ))
                  ) : (
                    <p>The application can be filled out directly via the Haqq Agent or the official portal.</p>
                  )}
                </div>
              </div>

              <div id="documents-required" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Documents Required</h2>
                <ul className="list-disc pl-5 space-y-2">
                  {scheme.documents_required?.map((doc, idx) => (
                    <li key={idx} className="capitalize">{doc.replace(/_/g, ' ')}</li>
                  ))}
                  {!scheme.documents_required?.length && <li>No specific documents listed.</li>}
                </ul>
              </div>

              <div id="faqs" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {scheme.faqs?.length > 0 ? (
                    scheme.faqs.map((faq, i) => (
                      <details key={i} className="group bg-gray-50 rounded-lg p-4 cursor-pointer">
                        <summary className="font-bold text-[var(--ink)] list-none flex items-center justify-between">
                          {faq.question}
                          <ChevronRight size={16} className="group-open:rotate-90 transition-transform" />
                        </summary>
                        <p className="mt-4 text-sm text-[var(--muted)]">
                          {faq.answer}
                        </p>
                      </details>
                    ))
                  ) : (
                    <p>No FAQs available for this scheme.</p>
                  )}
                </div>
              </div>

              <div id="sources" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">Sources And References</h2>
                {scheme.official_portal_url && (
                  <a href={scheme.official_portal_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    Official Guidelines <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              
              <div className="bg-green-600 text-white text-center font-bold py-3 rounded-lg shadow-sm">
                This scheme is active
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-5">
                <h3 className="font-bold text-sm text-[var(--ink)] mb-3 border-b pb-2">News and Updates</h3>
                <p className="text-xs text-[var(--muted)]">No new news and updates available</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-5">
                <h3 className="font-bold text-sm text-[var(--ink)] mb-3 border-b pb-2">Share</h3>
                <div className="flex items-center gap-2 text-gray-500">
                  <Mail onClick={() => window.open(`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`)} className="cursor-pointer hover:text-blue-500" size={18} />
                  <Facebook onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')} className="cursor-pointer hover:text-blue-600" size={18} />
                  <Twitter onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')} className="cursor-pointer hover:text-blue-400" size={18} />
                  <Linkedin onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank')} className="cursor-pointer hover:text-blue-700" size={18} />
                  <Share2 onClick={handleCopyLink} className="cursor-pointer hover:text-green-500 ml-auto" size={18} />
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>

      <GovFooter />
    </div>
  );
}
