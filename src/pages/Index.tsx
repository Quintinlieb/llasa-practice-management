import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clearAuthFormDraft } from "@/lib/authFormDraft";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Menu,
  ScanLine,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    nudocDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

let installPromptListenerRegistered = false;
const ensureInstallPromptListener = () => {
  if (installPromptListenerRegistered) return;
  installPromptListenerRegistered = true;
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    window.nudocDeferredPrompt = event as BeforeInstallPromptEvent;
  });
};

ensureInstallPromptListener();

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

const pinnedFeatures = [
  {
    title: "Guided incidents",
    copy: "Capture misconduct with inline hints and policy prompts in under two minutes.",
    icon: ScanLine,
  },
  {
    title: "Smart clauses",
    copy: "SA labour-ready language auto-fills warnings, notices, and contracts.",
    icon: Shield,
  },
  {
    title: "Instant PDFs",
    copy: "Preview, sign, and export branded PDFs without leaving the flow.",
    icon: FileText,
  },
];

const featureGrid = [
  {
    title: "Dynamic doc builder",
    copy: "Warnings, notices, and contracts adapt to your inputs in real time.",
    icon: FileText,
  },
  {
    title: "Employee memory",
    copy: "Profiles carry history, attendance, and contracts into every new doc.",
    icon: Users,
  },
  {
    title: "Compliance guardrails",
    copy: "Progressive discipline steps and SA labour alignment baked in.",
    icon: Shield,
  },
  {
    title: "Audit trail",
    copy: "Every action is time-stamped so HR can trace decisions quickly.",
    icon: Sparkles,
  },
  {
    title: "One-click export",
    copy: "Share, print, or download PDFs with signatures embedded.",
    icon: ArrowRight,
  },
  {
    title: "Template library",
    copy: "Save your best letters and reuse them across locations.",
    icon: CheckCircle2,
  },
];

const faqs = [
  {
    q: "Do I need legal expertise?",
    a: "No. Clause suggestions follow South African labour standards so managers can act confidently.",
  },
  {
    q: "Can I reuse employee data?",
    a: "Yes. Profiles auto-fill every warning, notice, or contract you create.",
  },
  {
    q: "How fast is export?",
    a: "Most teams generate a PDF with signatures in under three minutes.",
  },
  {
    q: "Is my data secure?",
    a: "Secure auth, role-aware access, and encrypted storage keep sensitive data safe.",
  },
  {
    q: "Can we standardise templates?",
    a: "Create, save, and share templates so every manager follows the same playbook.",
  },
];

const Index = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePin, setActivePin] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const featureRef = useRef<HTMLElement | null>(null);
  const [featurePinned, setFeaturePinned] = useState(false);
  const domesticMonthly = 99;
  const domesticAnnual = Math.round(domesticMonthly * 12 * 0.9);
  const businessMonthly = 249;
  const businessAnnual = Math.round(businessMonthly * 12 * 0.9);
  const formatPrice = (value: number) => `R${value.toLocaleString("en-ZA")}`;

  useEffect(() => {
    clearAuthFormDraft();
  }, []);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const installedCheck = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
      setIsInstalled(isStandalone);
    };

    const onInstalled = () => setIsInstalled(true);
    window.addEventListener("appinstalled", onInstalled);

    // Pick up any cached prompt that may have fired before React mounted
    if (window.nudocDeferredPrompt) {
      setDeferredPrompt(window.nudocDeferredPrompt);
    }

    installedCheck();

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const revealItems = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("show");
        });
      },
      { threshold: 0.14 }
    );
    revealItems.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>(".pin-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const idx = Number(target.dataset.index ?? 0);
            setActivePin(idx);
          }
        });
      },
      { threshold: 0.6, rootMargin: "-10% 0px -10% 0px" }
    );
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!featureRef.current) return;
    const el = featureRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setFeaturePinned(entry.isIntersecting && entry.intersectionRatio > 0.42);
        });
      },
      { threshold: [0.3, 0.42, 0.6], rootMargin: "-10% 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (href: string) => (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt && window.nudocDeferredPrompt) {
      setDeferredPrompt(window.nudocDeferredPrompt);
    }

    if (!deferredPrompt && !window.nudocDeferredPrompt) {
      setShowInstallHint(true);
      return;
    }

    const promptEvent = deferredPrompt ?? window.nudocDeferredPrompt;
    if (!promptEvent) {
      setShowInstallHint(true);
      return;
    }

    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      window.nudocDeferredPrompt = null;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex flex-1 items-center gap-3">
            <img src="/logo.png.png" alt="nudoc full logo" className="h-12 w-auto" />
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-slate-700 md:flex">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleNavClick(item.href)}
                className="transition-colors hover:text-blue-700"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
            <Link to="/auth?login=1">
              <Button variant="outline" className="border-blue-200 text-blue-700">
                Log in
              </Button>
            </Link>
            <Link to="/auth?new=1">
              <Button className="bg-blue-600 text-white hover:bg-blue-700">Get started</Button>
            </Link>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-6 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-slate-700">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick(item.href)}
                  className="rounded-lg px-3 py-2 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  {item.label}
                </a>
              ))}
              <Link to="/auth?login=1">
                <Button variant="outline" className="w-full border-blue-200 text-blue-700">
                  Log in
                </Button>
              </Link>
              <Link to="/auth?new=1">
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">Get started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center sm:pt-20">
            <div className="mx-auto mb-6 w-fit rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">
              HR documents, simplified
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Generate compliant HR documents with clarity and speed.
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-600 sm:text-xl">
              Guided flows, smart clauses, and instant PDFs keep managers on-policy and employees informed.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth?new=1">
                <Button className="h-12 rounded-full bg-blue-600 px-7 text-base text-white hover:bg-blue-700">
                  Get started
                </Button>
              </Link>
              {!isInstalled && (
                <Button
                  variant="outline"
                  onClick={handleInstallClick}
                  className="h-12 rounded-full border-emerald-200 bg-white px-7 text-base text-emerald-700 hover:border-emerald-300 disabled:opacity-70"
                  disabled={isInstalled}
                >
                  {deferredPrompt ? "Install app" : "Install app"}
                </Button>
              )}
            </div>
            {!isInstalled && showInstallHint && (
              <p className="mt-2 text-xs text-emerald-700">
                If the button stays disabled, open your browser menu and choose Install/Add to Home Screen.
              </p>
            )}
          </div>
        </section>

        <section
          ref={featureRef}
          className={`feature-highlight relative overflow-hidden border-y border-slate-200 bg-gradient-to-b from-white via-blue-50/30 to-white ${featurePinned ? "feature-pinned" : ""}`}
        >
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-10 left-[-6%] h-48 w-48 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute bottom-4 right-[-4%] h-52 w-52 rounded-full bg-emerald-100/60 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-16">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Feature highlight</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">See how adding an employee works</h2>
              <p className="mt-3 text-lg text-slate-600">
                A quick, looping illustration: open the list, click add, and start capturing details without leaving the flow.
              </p>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className={`feature-visual relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl ${featurePinned ? "is-pinned" : ""}`}>
                <img
                  src="/employee-list.png"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                  alt="Employee list screen"
                  className="demo-image"
                />
              </div>
              <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-blue-800">1) Start from your employee list</p>
                  <p className="text-sm text-slate-700">Browse, search, or filter to find people in seconds.</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-800">2) Click “Add Employee”</p>
                  <p className="text-sm text-slate-700">The guided modal keeps the basics upfront and ready.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">3) Capture details, save, and attach docs</p>
                  <p className="text-sm text-slate-700">Stay in flow—no redirects, instant records, and ready for contracts.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-12 reveal">
          <Card className="mx-auto max-w-5xl border-blue-100 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="text-left sm:text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">The easiest way</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                Generate HR documents without the admin drag
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                A simple, repeatable flow for warnings, notices, contracts, and more.
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-left sm:text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Step 1</p>
                <p className="text-sm text-slate-600">Add employee</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-left sm:text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <ScanLine className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Step 2</p>
                <p className="text-sm text-slate-600">Fill basic details</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-left sm:text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Step 3</p>
                <p className="text-sm text-slate-600">Choose HR document</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-left sm:text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Step 4</p>
                <p className="text-sm text-slate-600">Preview or print</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="border-y border-slate-200 bg-white/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-600">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Trusted by teams who need compliant HR docs fast
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-blue-700">3 min to PDF</div>
              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-emerald-700">Progressive discipline baked in</div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700">300+ employees tracked</div>
            </div>
          </div>
        </section>

        <section
          id="product"
          className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="reveal lg:sticky lg:top-28 lg:self-start">
            <Badge className="bg-blue-100 text-blue-800">Product</Badge>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Pinned view of your core flows</h2>
            <p className="mt-3 text-lg text-slate-600">
              Keep the overview fixed while you scroll through guided workflows. Every step is clear, compliant, and ready to export.
            </p>
            <div className="mt-6 space-y-3">
              {pinnedFeatures.map((item, idx) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                    activePin === idx ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <item.icon
                    className={`mt-1 h-5 w-5 ${activePin === idx ? "text-blue-700" : "text-slate-500"}`}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {pinnedFeatures.map((item, idx) => (
              <Card
                key={item.title}
                data-index={idx}
                className={`pin-card border ${activePin === idx ? "border-blue-200 shadow-lg" : "border-slate-200 shadow-sm"} bg-white/90 backdrop-blur transition`}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-3 text-blue-700">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Guided</p>
                        <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Step</Badge>
                  </div>
                  <p className="mt-3 text-slate-600">{item.copy}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">Inline policy hints</div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">Auto clauses added</div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-700">Export + audit trail</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-6xl px-6 pb-14 reveal"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge className="bg-blue-100 text-blue-800">Features</Badge>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Built for modern HR teams</h2>
              <p className="text-lg text-slate-600">Everything you need to stay compliant without slowing down.</p>
            </div>
            <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              Secure, accurate, fast
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureGrid.map((item) => (
              <Card key={item.title} className="border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className="relative w-full px-6 pb-14 pt-6 reveal"
        >
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-blue-50/60 to-blue-50/20"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mx-auto mt-4 w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Best Pricing
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">Transparent Pricing</h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
                Choose the plan that fits your goals. No hidden fees, just powerful features.
              </p>
              <div className="mt-10 flex justify-center">
                <div className="inline-flex items-center rounded-full border border-blue-100 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      billingCycle === "monthly"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("annual")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      billingCycle === "annual"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Annually
                  </button>
                </div>
              </div>
            </div>
            <div className="mx-auto mt-16 max-w-5xl">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 pt-10 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  <span className="inline-flex items-center rounded-full border border-blue-700 bg-blue-600 px-5 py-2 text-base font-semibold text-white shadow-lg ring-4 ring-white/70">
                    Free
                  </span>
                  <span className="sr-only">Trial plan</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">{formatPrice(0)}</span>
                  <span className="text-sm text-slate-500">/ {billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                <div className="mt-6 h-px w-full bg-slate-200" />
                <p className="mt-4 text-xs uppercase text-slate-400">Starter plan includes :</p>
                <ul className="mt-3 space-y-2 text-left text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Up to 50 patient records.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Scheduling and appointment
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Analytics & Reporting
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Limited report and analytics.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Email support
                  </li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/auth?new=1">
                    <Button variant="outline" className="h-10 w-full rounded-full border-slate-300 text-slate-700 hover:border-slate-400">
                      Start free trial
                    </Button>
                  </Link>
                </div>
                </div>
                <div className="relative flex h-full flex-col rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 pt-10 text-white shadow-[0_22px_50px_rgba(15,23,42,0.2)]">
                <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  <span className="inline-flex items-center rounded-full border border-white bg-white px-5 py-2 text-base font-semibold text-blue-700 shadow-lg ring-4 ring-blue-500/20">
                    Domestic
                  </span>
                  <span className="sr-only">Domestic plan</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    {billingCycle === "monthly" ? formatPrice(domesticMonthly) : formatPrice(domesticAnnual)}
                  </span>
                  <span className="text-sm text-white/80">/ {billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                {billingCycle === "annual" && (
                  <p className="mt-1 text-xs font-semibold text-white/90">Save 10% on annual</p>
                )}
                <div className="mt-6 h-px w-full bg-white/30" />
                <p className="mt-4 text-xs uppercase text-white/70">Pro plan includes :</p>
                <ul className="mt-3 space-y-2 text-left text-sm text-white/90">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Up to 5,000 patient records.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Advanced scheduling with waitlist management
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Comprehensive analytics
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Data portal for self-service scheduling
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Integration with third-party tools
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-blue-700" />
                    </span>
                    Phone and email support
                  </li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/auth?new=1">
                    <Button className="h-10 w-full rounded-full bg-white text-blue-700 hover:bg-blue-50">
                      Start with Domestic
                    </Button>
                  </Link>
                </div>
                </div>
                <div className="relative flex h-full flex-col rounded-2xl border border-blue-100 bg-white p-6 pt-10 shadow-[0_22px_50px_rgba(15,23,42,0.16)]">
                <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  <span className="inline-flex items-center rounded-full border border-blue-700 bg-blue-600 px-5 py-2 text-base font-semibold text-white shadow-lg ring-4 ring-white/70">
                    Business
                  </span>
                  <span className="sr-only">Business plan</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">
                    {billingCycle === "monthly" ? formatPrice(businessMonthly) : formatPrice(businessAnnual)}
                  </span>
                  <span className="text-sm text-slate-500">/ {billingCycle === "monthly" ? "month" : "year"}</span>
                </div>
                {billingCycle === "annual" && (
                  <p className="mt-1 text-xs font-semibold text-blue-600">Save 10% on annual</p>
                )}
                <div className="mt-6 h-px w-full bg-slate-200" />
                <p className="mt-4 text-xs uppercase text-slate-400">Custom plan includes :</p>
                <ul className="mt-3 space-y-2 text-left text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Unlimited patient records
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Fully customizable workflows and reports.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    Dedicated account manager for setup and support.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    On-site training and implementation assistance.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                    24/7 premium support.
                  </li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/auth?new=1">
                    <Button className="h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700">
                      Start with Business
                    </Button>
                  </Link>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="why"
          className="mx-auto max-w-6xl grid gap-10 px-6 pb-14 reveal lg:grid-cols-2"
        >
          <div className="space-y-4">
            <Badge className="bg-blue-100 text-blue-800">Why nudoc</Badge>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Built for HR leads, loved by managers</h2>
            <p className="text-lg text-slate-600">Clarity, compliance, and calm for every disciplinary or contract workflow.</p>
            <ul className="space-y-3 text-slate-700">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-blue-700" />
                <div>
                  <p className="font-semibold text-slate-900">Consistent every time</p>
                  <p className="text-sm text-slate-600">Templates and clause packs aligned to your policy.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-orange-700" />
                <div>
                  <p className="font-semibold text-slate-900">Fast for busy teams</p>
                  <p className="text-sm text-slate-600">Auto-fill profiles and export-ready PDFs cut admin to minutes.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700" />
                <div>
                  <p className="font-semibold text-slate-900">Transparent for HR</p>
                  <p className="text-sm text-slate-600">Audit trails keep evidence, notes, and signatures in one place.</p>
                </div>
              </li>
            </ul>
          </div>

          <Card className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Control room</p>
                <h3 className="text-xl font-semibold text-slate-900">Today</h3>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">All clear</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {["Absenteeism warning ready", "Performance review drafted", "New permanent contract"].map((item, idx) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${idx === 0 ? "bg-blue-600" : idx === 1 ? "bg-orange-500" : "bg-emerald-600"}`} />
                  <div>
                    <p className="font-semibold text-slate-900">{item}</p>
                    <p className="text-sm text-slate-600">Policy aligned | Evidence attached | Signature ready</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section
          id="faq"
          className="mx-auto max-w-6xl px-6 pb-14 reveal"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge className="bg-blue-100 text-blue-800">FAQ</Badge>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Questions, answered</h2>
              <p className="text-lg text-slate-600">Everything you need to know before rolling out nudoc.</p>
            </div>
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:border-blue-300">
              Talk to us
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-slate-900">
                  {item.q}
                  <ArrowRight className="h-4 w-4 text-blue-700 transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <Card className="reveal border border-blue-200 bg-blue-50/60 p-8 text-center shadow-sm">
            <h3 className="text-3xl font-bold text-slate-900">Ready to simplify HR documents?</h3>
            <p className="mt-2 text-lg text-slate-600">
              Guided flows, compliant clauses, and beautiful exports your team will actually use.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/auth?new=1">
                <Button className="bg-blue-600 text-white hover:bg-blue-700">Get started</Button>
              </Link>
              <Link to="/auth?login=1">
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:border-blue-300">
                  Log in
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/85">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">nudoc</p>
            <p>Guided HR documentation for teams that value compliance.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <a href="#pricing" onClick={handleNavClick("#pricing")}>
              Pricing
            </a>
            <a href="#faq" onClick={handleNavClick("#faq")}>
              Support
            </a>
            <a href="#product" onClick={handleNavClick("#product")}>
              Privacy & Terms
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        .reveal { opacity: 0; transform: translateY(18px); transition: opacity 360ms ease, transform 360ms ease; }
        .reveal.show { opacity: 1; transform: translateY(0); }
        .feature-highlight { scroll-margin-top: 96px; }
        .feature-visual { transition: transform 420ms ease, box-shadow 420ms ease, border-radius 420ms ease; }
        .feature-highlight.feature-pinned .feature-visual { position: sticky; top: clamp(72px, 12vh, 120px); transform: scale(1.08); box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18), 0 6px 24px rgba(15, 23, 42, 0.14); border-radius: 12px; z-index: 10; }
        .demo-image { display: block; width: 100%; height: auto; object-fit: contain; }
      `}</style>
    </div>
  );
};

export default Index;











