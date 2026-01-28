import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Download,
  Building2,
  Home,
  ChevronDown,
} from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const trustItems = [
  {
    title: "3 min to PDF",
    copy: "From blank to compliant document",
    icon: Sparkles,
  },
  {
    title: "SA labour aligned",
    copy: "BCEA, LRA & sectoral compliance",
    icon: Shield,
  },
  {
    title: "Audit-ready",
    copy: "Full document history & trails",
    icon: FileText,
  },
  {
    title: "No legal speak",
    copy: "Plain language, clear terms",
    icon: MessageSquare,
  },
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

const steps = [
  {
    title: "Add your employee",
    copy: "Enter basic details or import from an existing profile. Takes 30 seconds.",
    icon: Users,
    step: "01",
  },
  {
    title: "Choose your document",
    copy: "Select from contracts, policies, letters, or forms. All SA-compliant templates.",
    icon: FileText,
    step: "02",
  },
  {
    title: "Answer guided questions",
    copy: "Simple prompts fill in the blanks. No legal jargon, just plain questions.",
    icon: Sparkles,
    step: "03",
  },
  {
    title: "Download & send",
    copy: "Preview instantly, download as PDF, or send for e-signature.",
    icon: Download,
    step: "04",
  },
];

const planTypes = [
  {
    title: "For businesses",
    subtitle: "SMEs & HR teams",
    copy: "Full-featured HR document management for growing companies. Handle multiple employees, track compliance, and scale with confidence.",
    icon: Building2,
    badge: "Most popular",
    features: [
      "Unlimited employee profiles",
      "Bulk document generation",
      "Compliance dashboards",
      "Team collaboration",
      "Audit trails & history",
      "Priority support",
    ],
    cta: "Get started",
    primary: true,
  },
  {
    title: "For households",
    subtitle: "Domestic employers",
    copy: "Simple, affordable HR compliance for domestic workers. Contracts, payslips, and leave tracking made easy.",
    icon: Home,
    features: [
      "Up to 3 employee profiles",
      "Domestic worker contracts",
      "Monthly payslip generator",
      "Leave & UIF tracking",
      "Compliance reminders",
      "Email support",
    ],
    cta: "Get started",
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex flex-1 items-center gap-3">
            <img src="/mainlogo5 .png" alt="nudoc full logo" className="h-8 w-auto" />
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
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-50" />
          <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-16 text-center sm:pt-24">
            <div className="mx-auto mb-6 w-fit rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-blue-700">
              SA labour law aligned
            </div>
            <h1 className="relative mx-auto max-w-4xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              <span className="pointer-events-none absolute -right-12 top-0 z-0 h-64 w-64 rounded-full bg-blue-200/70 blur-3xl sm:h-72 sm:w-72" />
              <span className="relative z-10 block">HR paperwork shouldn’t</span>
              <span className="relative z-10 inline-block">slow you down</span>
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600 sm:text-xl">
              Generate compliant HR documents instantly and avoid the delays and high costs of consultants or lawyers.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth?new=1">
                <Button className="h-12 rounded-full bg-blue-600 px-8 text-base text-white hover:bg-blue-700">
                  Get started free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" className="h-12 rounded-full px-7 text-base text-slate-700">
                Book a demo
              </Button>
            </div>
            <p className="mt-6 text-sm text-slate-500">Trusted by 500+ South African businesses</p>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-12 text-center md:grid-cols-4">
            {trustItems.map((item) => (
              <div key={item.title} className="space-y-3">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <item.icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="bg-slate-50 px-6 py-16">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">How it works</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              From blank to compliant in four steps
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              No templates to decipher. No lawyers to consult. Just answer simple questions and get professional documents.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <Card key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
                  <span className="absolute -top-6 right-6 text-5xl font-bold text-slate-100">{step.step}</span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{step.copy}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Features</p>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Everything you need to manage HR docs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            From contracts to compliance, nudoc handles the paperwork so you can focus on your people.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <feature.icon className="h-6 w-6" />
                  </span>
                  {feature.badge && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-600">
                      {feature.badge}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Choose your plan type</p>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
            Built for businesses and households alike
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            Whether you’re running a company or employing a domestic worker, nudoc has you covered.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {planTypes.map((plan) => (
              <Card
                key={plan.title}
                className={`relative rounded-2xl border ${plan.primary ? "border-blue-200 shadow-lg" : "border-slate-200"} bg-white p-8 text-left`}
              >
                {plan.badge && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center gap-4">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${plan.primary ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                    <plan.icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{plan.title}</h3>
                    <p className="text-sm text-slate-500">{plan.subtitle}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm text-slate-600">{plan.copy}</p>
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
                      className={`h-11 w-full rounded-full ${plan.primary ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-50 text-slate-900 hover:bg-slate-100"}`}
                    >
                      {plan.cta}
                    </Button>
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
