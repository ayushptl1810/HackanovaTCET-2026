import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronRight, ExternalLink, Share2, Facebook, Twitter, Linkedin, Mail } from "lucide-react";
import { api } from "../api";
import GovHeader from "./GovHeader";
import GovFooter from "./GovFooter";
import { useLang } from "../lib/i18n";

export default function SchemeDetails() {
  const { t } = useLang();
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
    return <div className="min-h-screen flex items-center justify-center">{t("common.loading")}</div>;
  }

  if (!scheme) {
    return (
      <div className="min-h-screen flex flex-col">
        <GovHeader />
        <main className="flex-1 flex items-center justify-center flex-col">
          <h2 className="text-2xl font-bold mb-4">{t("det.notFound")}</h2>
          <Link to="/schemes" className="text-blue-600 hover:underline">{t("det.backToSchemes")}</Link>
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
    { id: 'details', label: t("det.details") },
    { id: 'benefits', label: t("det.benefits") },
    { id: 'eligibility', label: t("det.eligibility") },
    { id: 'application-process', label: t("det.appProcess") },
    { id: 'documents-required', label: t("det.docsRequired") },
    { id: 'faqs', label: t("det.faqs") },
    { id: 'sources', label: t("det.sources") }
  ];

  const shareUrl = window.location.href;
  const shareTitle = scheme?.name || 'Government Scheme';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => toast.success(t("det.copied")))
      .catch(() => toast.error(t("det.copyFailed")));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-blue-100">
      <GovHeader />

      {/* Breadcrumb */}
      <div className="border-b border-[var(--line)] bg-[var(--surface-2)]">
        <div className="wrap py-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link to="/schemes" className="text-blue-600 font-bold hover:underline">&larr; {t("common.back")}</Link>
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
              {t("det.checkApply")}
            </Link>

            <div className="space-y-12 text-[15px] leading-relaxed text-[var(--body)]">
              
              <div id="details" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.details")}</h2>
                <p>{scheme.benefits?.description || t("det.noDescription")}</p>
              </div>

              <div id="benefits" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.benefits")}</h2>
                <p><strong>{t("det.benefitType")}</strong> <span className="capitalize">{scheme.benefits?.type || "Other"}</span></p>
                <p className="mt-2">{scheme.benefit_amount || scheme.benefits?.description}</p>
              </div>

              <div id="eligibility" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.eligibility")}</h2>
                <ul className="list-disc pl-5 space-y-2">
                  {scheme.eligibility_rules?.map((rule, idx) => {
                    const opText = rule.operator.replace(/_/g, ' ');
                    return (
                      <li key={idx}>
                        <strong>{rule.profile_field.charAt(0).toUpperCase() + rule.profile_field.slice(1)}:</strong> {t("det.mustBe")} {opText} {rule.value} {rule.is_mandatory && <span className="text-red-500 text-xs ml-1">{t("det.mandatory")}</span>}
                      </li>
                    )
                  })}
                  {!scheme.eligibility_rules?.length && <li>{t("det.noRules")}</li>}
                </ul>
              </div>

              <div id="application-process" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.appProcess")}</h2>
                <p><strong>{t("det.mode")}</strong> <span className="capitalize">{scheme.application_mode || "Online/Offline"}</span></p>
                <div className="mt-4 space-y-2">
                  {scheme.application_process?.length > 0 ? (
                    scheme.application_process.map((step, i) => (
                      <p key={i}><strong>{t("det.step")} {i+1}:</strong> {step}</p>
                    ))
                  ) : (
                    <p>{t("det.appFallback")}</p>
                  )}
                </div>
              </div>

              <div id="documents-required" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.docsRequired")}</h2>
                <ul className="list-disc pl-5 space-y-2">
                  {scheme.documents_required?.map((doc, idx) => (
                    <li key={idx} className="capitalize">{doc.replace(/_/g, ' ')}</li>
                  ))}
                  {!scheme.documents_required?.length && <li>{t("det.noDocs")}</li>}
                </ul>
              </div>

              <div id="faqs" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.faqs")}</h2>
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
                    <p>{t("det.noFaqs")}</p>
                  )}
                </div>
              </div>

              <div id="sources" className="scroll-mt-24">
                <h2 className="text-xl font-heading font-bold text-[var(--navy)] mb-4 border-b pb-2">{t("det.sources")}</h2>
                {scheme.official_portal_url && (
                  <a href={scheme.official_portal_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    {t("det.officialGuidelines")} <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              
              <div className="bg-green-600 text-white text-center font-bold py-3 rounded-lg shadow-sm">
                {t("det.active")}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-5">
                <h3 className="font-bold text-sm text-[var(--ink)] mb-3 border-b pb-2">{t("det.news")}</h3>
                <p className="text-xs text-[var(--muted)]">{t("det.noNews")}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-5">
                <h3 className="font-bold text-sm text-[var(--ink)] mb-3 border-b pb-2">{t("det.share")}</h3>
                <div className="flex items-center gap-2 text-gray-500">
                  <button type="button" aria-label="Share by email" title="Share by email"
                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`)}
                    className="p-1 rounded hover:text-blue-500 hover:bg-gray-100 transition-colors">
                    <Mail size={18} />
                  </button>
                  <button type="button" aria-label="Share on Facebook" title="Share on Facebook"
                    onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener')}
                    className="p-1 rounded hover:text-blue-600 hover:bg-gray-100 transition-colors">
                    <Facebook size={18} />
                  </button>
                  <button type="button" aria-label="Share on X (Twitter)" title="Share on X (Twitter)"
                    onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank', 'noopener')}
                    className="p-1 rounded hover:text-blue-400 hover:bg-gray-100 transition-colors">
                    <Twitter size={18} />
                  </button>
                  <button type="button" aria-label="Share on LinkedIn" title="Share on LinkedIn"
                    onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener')}
                    className="p-1 rounded hover:text-blue-700 hover:bg-gray-100 transition-colors">
                    <Linkedin size={18} />
                  </button>
                  <button type="button" aria-label="Copy link" title="Copy link"
                    onClick={handleCopyLink}
                    className="p-1 rounded hover:text-green-500 hover:bg-gray-100 transition-colors ml-auto">
                    <Share2 size={18} />
                  </button>
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
