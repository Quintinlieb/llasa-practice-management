import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  Shield,
  FileText,
  Sparkles,
  Users,
  Calendar,
  MessageSquare,
  Lock,
  Scale,
  Timer,
  Download,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const clientLogos = [
  { src: "/logo-citybug.png", alt: "Citybug", imageClassName: "object-contain scale-95" },
  { src: "/logo-east-rand-dental-studio.png", alt: "East Rand Dental Studio", imageClassName: "object-contain scale-95" },
  { src: "/logo-malamala.png", alt: "MalaMala", imageClassName: "object-cover scale-100" },
  { src: "/logo-romans-pizza.jpg", alt: "Roman's Pizza" },
  { src: "/logo-superspar.png", alt: "SUPERSPAR" },
  { src: "/logo-iveco.png", alt: "IVECO", imageClassName: "object-contain scale-125" },
  { src: "/logo-caltex.png", alt: "Caltex", imageClassName: "object-contain scale-[0.85]" },
  { src: "/logo-wimpy.png", alt: "Wimpy" },
];

const heroInfoCards = [
  { title: "Cloud Based", iconify: "ic:outline-cloud" },
  { title: "Legally Compliant", icon: Scale },
  { title: "Quick Results", icon: Timer },
];

const featureCards = [
  {
    title: "Guided document creation",
    copy: "Step-by-step wizards for contracts, policies, and HR letters. No blank-page anxiety.",
    icon: FileText,
  },
  {
    title: "Instant PDF preview",
    copy: "See your document as you build it. Preview, tweak, and download in seconds.",
    icon: Download,
  },
  {
    title: "Employee profiles",
    copy: "Store employee details, documents, and history in one secure place.",
    icon: Users,
  },
  {
    title: "Compliance dashboard",
    copy: "Track document expiry, missing paperwork, and compliance status at a glance.",
    icon: Scale,
  },
  {
    title: "HR assistant chat",
    copy: "Get instant answers to HR questions. Powered by SA labour law knowledge.",
    icon: MessageSquare,
  },
  {
    title: "HR calendar",
    copy: "Never miss a deadline. Automatic reminders for reviews, renewals, and compliance dates.",
    icon: Calendar,
  },
  {
    title: "Payslip generator",
    copy: "Create compliant payslips with UIF, PAYE, and deductions calculated automatically.",
    icon: FileText,
  },
  {
    title: "Secure onboarding",
    copy: "Send document packs to new hires. Collect signatures and ID docs digitally.",
    icon: Lock,
  },
  {
    title: "Template library",
    copy: "Growing library of SA-compliant templates. New documents added monthly.",
    icon: FileText,
    badge: "Coming soon",
  },
];

type HowItWorksStep = {
  title: string;
  copy: string;
  step: string;
  imageSrc?: string;
  icon?: LucideIcon;
};

const steps: HowItWorksStep[] = [
  {
    title: "Add employees",
    copy: "Capture employee details once and keep everything organised in one place.",
    imageSrc: "/add-employees-icon-illustration.png",
    step: "01",
  },
  {
    title: "Choose your document",
    copy: "Select from a library of HR documents or processes you need to draft.",
    imageSrc: "/choose-document-icon-illustration.png",
    step: "02",
  },
  {
    title: "Complete the details",
    copy: "Fill in the required information through a simple guided workflow.",
    imageSrc: "/complete-details-icon-illustration.png",
    step: "03",
  },
  {
    title: "Review and download",
    copy: "Make final edits and download a beautiful, ready-to-use, compliant document instantly.",
    imageSrc: "/review-download-icon-illustration.png",
    step: "04",
  },
];

const employerCards = [
  {
    title: "Employing someone at home?",
    copy: "If you have a domestic worker, gardener, or nanny, you're an employer - even if it doesn't feel that way. nudoc makes it easy to do right by them, without needing a law degree.",
    bullets: [
      "Step-by-step guidance - no HR experience needed",
      "Contracts and payslips written in plain language",
      "Stay compliant without the stress or expense",
    ],
  },
  {
    title: "Running a business or HR team?",
    copy: "Growing a team means more documents, more deadlines, and more risk. nudoc helps you keep everything organised, consistent, and audit-ready - without slowing you down.",
    bullets: [
      "Generate compliant documents in minutes, not days",
      "Cut the cost of consultants and legal delays",
      "Structured records that grow with your team",
    ],
  },
];

const pricingPlans = [
  {
    name: "Starter",
    subtitle: "For small teams getting started",
    monthly: 299,
    features: [
      "Up to 10 employees",
      "Core document templates",
      "PDF download",
      "Email support",
      "Basic compliance tracking",
    ],
  },
  {
    name: "Business",
    subtitle: "For growing companies",
    monthly: 799,
    badge: "Most popular",
    features: [
      "Unlimited employees",
      "All document templates",
      "HR assistant chat",
      "Compliance dashboard",
      "Team collaboration",
      "Audit trails",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Domestic",
    subtitle: "For household employers",
    monthly: 99,
    features: [
      "Up to 3 employees",
      "Domestic contracts",
      "Payslip generator",
      "Leave tracking",
      "UIF compliance",
      "Email support",
    ],
  },
];

const complianceCards = [
  {
    title: "SA labour law aligned",
    copy: "Every template follows BCEA, LRA, and relevant sectoral determinations. Updated when laws change.",
    icon: Scale,
  },
  {
    title: "POPIA compliant",
    copy: "Your employee data is protected. We follow strict privacy protocols and never share your information.",
    icon: Lock,
  },
  {
    title: "Bank-grade security",
    copy: "256-bit encryption, secure servers, and regular security audits keep your documents safe.",
    icon: Shield,
  },
  {
    title: "Audit-ready records",
    copy: "Complete document history, version tracking, and timestamps for CCMA or DoL inspections.",
    icon: FileText,
  },
];

const faqs = [
  {
    q: "What types of documents can I create?",
    a: "Warnings, contracts, addendums, notices, and more. New templates are added regularly.",
  },
  {
    q: "Are the documents compliant with South African labour law?",
    a: "Yes. Templates are aligned with BCEA, LRA, and sectoral determinations.",
  },
  {
    q: "Can I use nudoc for domestic workers?",
    a: "Yes. The Domestic plan is built for household employers and includes payslips and UIF support.",
  },
  {
    q: "How secure is my employee data?",
    a: "We use bank-grade encryption and strict access controls to protect your data.",
  },
  {
    q: "Can multiple team members access the account?",
    a: "Yes. The Business plan supports team collaboration and multi-user access.",
  },
];

const formatPrice = (value: number) => `R${value.toLocaleString("en-ZA")}`;

const Index = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [heroEmailFocused, setHeroEmailFocused] = useState(false);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  const handleNavClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  const annualPrice = (monthly: number) => Math.round(monthly * 12 * 0.9);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex flex-1 items-center gap-3">
            <img src="/zappir_logo_black(1).png" alt="zappir logo" className="h-8 w-auto" />
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-slate-600 md:flex">
            {navLinks.map((item) => (
              <a key={item.href} href={item.href} onClick={handleNavClick(item.href)} className="hover:text-blue-700">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
            <Link to="/auth?login=1" className="text-sm font-medium text-slate-600 hover:text-blue-700">
              Sign in
            </Link>
            <Link to="/auth?new=1">
              <Button className="rounded-full bg-blue-600 px-5 text-white hover:bg-blue-700">Get started</Button>
            </Link>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown className={`h-5 w-5 transition ${menuOpen ? "rotate-180" : ""}`} />
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
              <Link to="/auth?login=1" className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100">
                Sign in
              </Link>
              <Link to="/auth?new=1">
                <Button className="w-full rounded-full bg-blue-600 text-white hover:bg-blue-700">Get started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-50 lg:-mb-[157px]">
          <div className="absolute inset-0 bg-slate-50" />
          <div className="relative z-10 mx-auto -mt-5 grid max-w-7xl items-center gap-12 px-6 pb-0 pt-0 text-center sm:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(360px,720px)] lg:text-left">
            <div>
              <h1 className="relative mx-auto max-w-4xl text-5xl font-bold leading-tight text-slate-900 sm:text-6xl lg:mx-0 lg:text-6xl">
                <span className="relative z-10 block">
                  <span className="block">HR paperwork</span>
                  <span className="mt-1 block underline decoration-blue-600 decoration-2 underline-offset-4">shouldn’t</span>
                </span>
                <span className="relative z-10 inline-block">slow you down!</span>
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-sm text-slate-600 sm:text-base lg:mx-0">
                Get your HR documents done in seconds without relying on expensive consultants or lawyers. Simple, reliable and ready when you are.
              </p>
              <div className="mt-12 flex flex-wrap justify-center gap-3 lg:justify-start">
                <div className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
                  <input
                    type="email"
                    placeholder={heroEmailFocused ? "" : "Your business email"}
                    onFocus={() => setHeroEmailFocused(true)}
                    onBlur={() => setHeroEmailFocused(false)}
                    className="h-10 flex-1 rounded-xl border-0 bg-transparent px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                  <Button type="button" className="h-10 rounded-xl bg-blue-600 px-5 text-sm text-white hover:bg-blue-700">
                    Get Started <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-10 flex flex-wrap justify-center gap-2 lg:justify-start">
                {heroInfoCards.map((card) => (
                  <div
                    key={card.title}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      {card.iconify ? (
                        <Icon icon={card.iconify} className="h-4 w-4" />
                      ) : (
                        <card.icon className="h-4 w-4" strokeWidth={card.title === "Legally Compliant" ? 1.5 : 2} />
                      )}
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">{card.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-2xl lg:ml-auto lg:mr-0 lg:max-w-none">
              <img
                src="/hero-zappir-3.png"
                alt="Zappir HR document automation illustration"
                className="relative z-10 mx-auto w-full max-w-[720px] -translate-y-[20px] lg:translate-x-[83px] lg:-translate-y-[20px]"
              />
              <p className="absolute bottom-[135px] left-1/2 z-20 -ml-[60px] -translate-x-1/2 -translate-y-[23px] whitespace-nowrap text-center text-xs text-slate-500">
                Trusted by 1000+ South African users
              </p>
            </div>
          </div>
        </section>

        <div className="relative z-20 px-6 lg:-mt-8 lg:h-[260px]">
          <div
            id="how"
            className="mx-auto max-w-5xl rounded-[28px] bg-white px-6 py-12 shadow-[0_24px_68px_-24px_rgba(15,23,42,0.32),0_-12px_32px_-24px_rgba(15,23,42,0.2)] sm:px-10 sm:py-14 lg:absolute lg:left-1/2 lg:top-[180px] lg:w-[calc(100%-3rem)] lg:-translate-x-1/2"
          >
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                  How it works
                </p>
                <h2 className="mt-3 max-w-xl text-2xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  Simple steps to generate documents
                </h2>
              </div>
              <p className="max-w-md text-xs leading-6 text-slate-600 lg:mt-9 lg:justify-self-end">
                Every step is built to simplify your process, guiding you from employee setup to document generation in a way that is fast, structured and easy to follow. Just simple tools that work when you need them.
              </p>
            </div>

            <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <article key={step.title} className={`${step.imageSrc ? "-mt-[25px]" : ""} max-w-sm`}>
                  {step.imageSrc ? (
                    <img
                      src={step.imageSrc}
                      alt={`${step.title} icon`}
                      className={`${
                        step.step === "02"
                          ? "-ml-[31px]"
                          : step.step === "03"
                            ? "-ml-[35px]"
                            : step.step === "04"
                              ? "-ml-[30px]"
                              : "-ml-[26px]"
                      } block h-32 w-32 object-contain`}
                    />
                  ) : step.icon ? (
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <step.icon className="h-6 w-6" />
                    </span>
                  ) : null}
                  <h3 className={`${step.imageSrc ? "mt-[-17px]" : "mt-2"} text-lg font-semibold text-slate-900`}>
                    {step.title}
                  </h3>
                  <p className="mt-3 text-xs leading-6 text-slate-600">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <section className="bg-white px-6 pb-16 pt-16 lg:pt-[474px] text-center">
          <div className="mx-auto max-w-6xl pt-[50px]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Why us</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">A better way to manage HR</h2>

            <div className="mt-14 grid gap-6 md:grid-cols-2">
              <Card className="rounded-3xl border-0 bg-blue-50/85 px-8 pt-8 pb-5 text-left shadow-sm">
                <div className="flex items-end gap-2">
                  <p className="text-5xl font-bold leading-none tracking-tight text-blue-600">1,000x</p>
                  <p className="pb-2 text-sm font-semibold uppercase tracking-[0.1em] text-slate-900">faster</p>
                </div>
                <p className="mt-8 max-w-sm text-lg font-semibold leading-tight text-slate-900">
                  What usually takes 2-3 days now takes 2-3 minutes
                </p>
              </Card>

              <Card className="rounded-3xl border-0 bg-blue-50/85 p-8 text-left shadow-sm">
                <h3 className="max-w-sm text-lg font-semibold leading-tight text-slate-900">
                  No more high consulting and legal fees for drafting legal documents
                </h3>
                <div className="mt-6 flex items-center gap-4">
                  <span className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Icon icon="mdi:piggy-bank-outline" className="h-8 w-8" />
                  </span>
                  <span className="ml-4 inline-flex flex-col items-center justify-center gap-1 text-slate-400">
                    <span className="relative block h-4 w-16">
                      <span className="absolute left-[7px] right-0 top-1/2 h-px -translate-y-1/2 bg-slate-400" />
                      <span className="absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-y-transparent border-r-[7px] border-r-slate-400" />
                    </span>
                    <span className="relative block h-4 w-16">
                      <span className="absolute left-0 right-[7px] top-1/2 h-px -translate-y-1/2 bg-slate-400" />
                      <span className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-y-transparent border-l-[7px] border-l-slate-400" />
                    </span>
                  </span>
                  <img
                    src="/zappir_logo_black(1).png"
                    alt="Zappir logo"
                    className="ml-4 h-10 w-auto object-contain"
                  />
                </div>
              </Card>
            </div>

            <Card className="mt-6 rounded-3xl border-0 bg-blue-50/85 p-8 text-left shadow-sm">
              <div className="grid gap-8 md:grid-cols-[320px_minmax(0,1fr)] md:items-end">
                <div>
                  <h3 className="text-3xl font-bold leading-tight text-slate-900">No admin overload</h3>
                  <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
                    Generate consistent, compliant documents without getting buried in repetitive manual HR work.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Summary</p>
                      <p className="mt-1 text-4xl font-semibold text-slate-900">R1,876,580</p>
                    </div>
                    <p className="text-xs text-slate-500">6 Months</p>
                  </div>
                  <div className="mt-6 h-36 rounded-xl bg-gradient-to-b from-blue-100/80 to-white" />
                  <div className="mt-4 grid grid-cols-6 text-center text-xs text-slate-400">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="features" className="bg-slate-950 px-6 pb-16 pt-16 lg:pt-24 text-center text-white">
          <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Features</p>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Everything you need to manage HR docs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-300">
            From contracts to compliance, nudoc handles the paperwork so you can focus on your people.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left text-white">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300">
                    <feature.icon className="h-6 w-6" />
                  </span>
                  {feature.badge && (
                    <Badge variant="outline" className="border-blue-300/30 bg-blue-500/10 text-blue-200">
                      {feature.badge}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.copy}</p>
              </Card>
            ))}
          </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="logo-marquee mx-auto max-w-7xl px-6 py-8">
            <div className="logo-marquee-track">
              {[...clientLogos, ...clientLogos].map((logo, index) => (
                <div
                  key={`${logo.alt}-${index}`}
                  className="mx-8 flex h-14 w-40 shrink-0 items-center justify-center overflow-hidden"
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className={`h-full w-full grayscale ${logo.imageClassName ?? "object-contain"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Made for real employers</p>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Whether it&apos;s your home or your business
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            You don't need to be an HR expert. nudoc meets you where you are.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {employerCards.map((card) => (
              <Card key={card.title} className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{card.copy}</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  {card.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-blue-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link to="/auth?new=1" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
                    See how it works <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-16 text-white">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Compliance & security</p>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Built for compliance, secured for peace of mind
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-300">
              Your HR documents are legally sound and your data is protected. Always.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2">
            {complianceCards.map((item) => (
              <Card key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left text-white">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-300">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-300">{item.copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-slate-50 px-6 py-16">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Pricing</p>
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              No hidden fees. No long contracts. Start free and upgrade when you’re ready.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-600">
              <span className={billingCycle === "monthly" ? "text-slate-900" : ""}>Monthly</span>
              <button
                type="button"
                onClick={() => setBillingCycle((prev) => (prev === "monthly" ? "annual" : "monthly"))}
                className="relative h-7 w-12 rounded-full bg-slate-200"
                aria-label="Toggle billing cycle"
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    billingCycle === "monthly" ? "left-1" : "left-6"
                  }`}
                />
              </button>
              <span className={billingCycle === "annual" ? "text-slate-900" : ""}>Annual</span>
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => {
              const price = billingCycle === "monthly" ? plan.monthly : annualPrice(plan.monthly);
              return (
                <Card
                  key={plan.name}
                  className={`relative rounded-2xl border ${
                    plan.featured ? "border-blue-200 shadow-xl" : "border-slate-200"
                  } bg-white p-8 text-left`}
                >
                  {plan.badge && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{plan.subtitle}</p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900">{formatPrice(price)}</span>
                    <span className="text-sm text-slate-500">/month</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-slate-600">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 text-emerald-600">
                          <Check className="h-3 w-3" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link to="/auth?new=1">
                      <Button
                        className={`h-11 w-full rounded-full ${
                          plan.featured ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        Get started
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="faq" className="bg-slate-50 px-6 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">FAQ</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Frequently asked questions</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              Can’t find what you’re looking for? Reach out to our support team.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {faqs.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-slate-900">
                  {item.q}
                  <ChevronDown className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-blue-600 px-6 py-16 text-center text-white">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to simplify your HR paperwork?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-blue-100">
            Join 500+ South African businesses creating compliant HR documents in minutes, not days.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth?new=1">
              <Button className="h-12 rounded-full bg-white px-8 text-base text-blue-700 hover:bg-blue-50">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button className="h-12 rounded-full bg-blue-500 px-7 text-base text-white hover:bg-blue-400">
              Book a demo
            </Button>
          </div>
          <p className="mt-4 text-xs text-blue-100">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto max-w-6xl border-t border-slate-200 px-6 py-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="text-lg font-semibold text-slate-900">nudoc</span>
              </div>
              <p className="text-sm text-slate-600">
                SA HR documents made simple. Built for compliance, designed for humans.
              </p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Product</p>
              <a href="#features" onClick={handleNavClick("#features")} className="block hover:text-blue-700">
                Features
              </a>
              <a href="#pricing" onClick={handleNavClick("#pricing")} className="block hover:text-blue-700">
                Pricing
              </a>
              <a href="#faq" onClick={handleNavClick("#faq")} className="block hover:text-blue-700">
                FAQ
              </a>
              <span className="block">Templates</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Company</p>
              <span className="block">About</span>
              <span className="block">Blog</span>
              <span className="block">Careers</span>
              <span className="block">Contact</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Legal</p>
              <Link to="/terms" className="block hover:text-blue-700">
                Privacy Policy
              </Link>
              <Link to="/terms" className="block hover:text-blue-700">
                Terms of Service
              </Link>
              <span className="block">POPIA Compliance</span>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
            <span>© 2026 nudoc. All rights reserved.</span>
            <span>Made with za in South Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;






