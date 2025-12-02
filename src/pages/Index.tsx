import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
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
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png.png" alt="nudoc full logo" className="h-12 w-auto" />
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
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
            <Link to="/auth">
              <Button variant="outline" className="border-blue-200 text-blue-700">
                Log in
              </Button>
            </Link>
            <Link to="/auth?new=1">
              <Button className="bg-blue-600 text-white hover:bg-blue-700">Get started</Button>
            </Link>
          </nav>
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
              <Link to="/auth">
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
              <Link to="/auth">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-blue-200 bg-white px-7 text-base text-blue-700 hover:border-blue-300"
                >
                  Log in
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
            <p className="mt-4 text-sm text-slate-500">
              Progressive discipline ready | Instant PDF export | Secure by design
            </p>
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
          className="mx-auto max-w-6xl px-6 pb-14 reveal"
        >
          <Card className="overflow-hidden border border-blue-200 bg-white shadow-md">
            <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <Badge className="bg-orange-100 text-orange-800">Recommended</Badge>
                <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Simple pricing</h2>
                <p className="text-lg text-slate-600">Straightforward billing so you always know the cost.</p>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <Badge variant="outline" className="border-blue-200 text-blue-700">Unlimited warnings</Badge>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">Contracts & letters</Badge>
                  <Badge variant="outline" className="border-orange-200 text-orange-700">Live preview</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Pricing</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">R250</span>
                  <span className="text-slate-600">per month</span>
                </div>
                <p className="text-slate-700">+ R3 per employee</p>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Guided flows for warnings and contracts
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Clause suggestions and live preview
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Employee records and audit trail
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Instant PDF export and sharing
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/auth?new=1">
                    <Button className="bg-blue-600 text-white hover:bg-blue-700">Choose nudoc</Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" className="border-blue-200 text-blue-700 hover:border-blue-300">Log in</Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
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
              <Link to="/auth">
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
      `}</style>
    </div>
  );
};

export default Index;











