import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Users,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  Menu,
  X,
  BarChart3,
  FileCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg grid place-items-center text-primary-foreground font-bold text-lg">
              n
            </div>
            <span className="text-xl font-bold tracking-tight">nudoc</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("features")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden md:block">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/auth?new=1">
              <Button size="sm" className="shadow-lg">
                Get Started
              </Button>
            </Link>

            {/* Mobile menu button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
            <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
              <button
                onClick={() => scrollToSection("features")}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection("faq")}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </button>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  Log In
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                  HR documents,
                  <span className="text-primary block mt-2">done right</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Generate compliant disciplinary documents in minutes. Built for South African businesses who value speed, accuracy, and legal alignment.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link to="/auth?new=1">
                  <Button size="lg" className="text-base px-8 shadow-lg hover:shadow-xl transition-all">
                    Get Started
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="lg" className="text-base px-8">
                    Log In
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-8 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>SA labour compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>Ready in minutes</span>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative animate-fade-in delay-150">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-3xl" />
              <Card className="relative border-border/50 bg-gradient-to-br from-background to-secondary/30 shadow-2xl overflow-hidden">
                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Document Generator</p>
                      <p className="font-semibold text-lg">Written Warning</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-background/50 p-5 backdrop-blur-sm hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Employee</span>
                        <span className="text-sm font-medium">A. Mokoena</span>
                      </div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Type</span>
                        <span className="text-sm font-medium">Final Warning</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Date</span>
                        <span className="text-sm font-medium">12 Nov 2025</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 backdrop-blur-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-xs text-primary uppercase tracking-wider font-medium">Auto-Generated</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Legal clauses, policy references, and action plans inserted automatically based on SA labour law.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <div className="flex-1 h-10 rounded-lg bg-secondary/50 grid place-items-center text-xs font-medium">
                      Preview
                    </div>
                    <div className="flex-1 h-10 rounded-lg bg-primary/10 grid place-items-center text-xs font-medium text-primary">
                      Export PDF
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4 animate-fade-in">
            <p className="text-sm uppercase tracking-wider text-primary font-semibold">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Everything you need for compliant HR
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From incident capture to signed PDFs, we've built the tools you need to handle disciplinary processes with confidence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Instant Document Generation",
                description: "Create professional written warnings in seconds with guided, validated forms and smart templates.",
              },
              {
                icon: Shield,
                title: "SA Labour Compliant",
                description: "Templates aligned with South African labour law and progressive discipline requirements.",
              },
              {
                icon: Users,
                title: "Employee Management",
                description: "Store employee information once and auto-populate every document with accurate data.",
              },
              {
                icon: Clock,
                title: "Save Hours of Work",
                description: "Reduce document preparation time from hours to minutes with intelligent automation.",
              },
              {
                icon: FileCheck,
                title: "Document History",
                description: "Track all warnings and disciplinary actions with a complete, searchable audit trail.",
              },
              {
                icon: BarChart3,
                title: "Analytics & Insights",
                description: "Monitor trends, track compliance, and identify areas for improvement across your workforce.",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="p-8 border-border/50 bg-background hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16 space-y-4 animate-fade-in">
            <p className="text-sm uppercase tracking-wider text-primary font-semibold">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              One plan that scales with your business. No hidden fees, no surprises.
            </p>
          </div>

          <Card className="p-10 md:p-12 border-border/50 bg-gradient-to-br from-background to-secondary/20 shadow-2xl">
            <div className="text-center space-y-8">
              <div>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl md:text-6xl font-bold tracking-tight">R250</span>
                  <span className="text-2xl text-muted-foreground">/month</span>
                </div>
                <p className="text-lg text-primary font-medium">+ R3.00 per employee added</p>
              </div>

              <div className="max-w-md mx-auto space-y-4 text-left">
                <p className="text-muted-foreground text-center mb-6">
                  Everything you need to manage HR documentation efficiently
                </p>
                {[
                  "Unlimited document generation",
                  "Employee database management",
                  "SA labour law templates",
                  "PDF export and printing",
                  "Document history and audit trail",
                  "Email support",
                  "Regular template updates",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 grid place-items-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <Link to="/auth?new=1" className="block">
                <Button size="lg" className="w-full md:w-auto px-12 text-base shadow-lg hover:shadow-xl transition-all">
                  Get Started Now
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-wider text-primary font-semibold">Why Choose nudoc</p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                  Built for South African businesses
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  We understand the unique challenges of managing HR processes in South Africa. That's why we've built a solution that's specifically designed for local compliance and efficiency.
                </p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    title: "Legally aligned",
                    description: "Every template is crafted to meet SA labour law requirements and progressive discipline standards.",
                  },
                  {
                    title: "Save time and money",
                    description: "Reduce document preparation from hours to minutes, freeing up your team for strategic work.",
                  },
                  {
                    title: "Reduce errors",
                    description: "Guided forms and validation ensure accuracy and completeness in every document.",
                  },
                  {
                    title: "Complete audit trail",
                    description: "Track every warning and disciplinary action with a searchable, secure history.",
                  },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="h-6 w-6 rounded-full bg-primary/10 grid place-items-center flex-shrink-0 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 animate-fade-in delay-150">
              <Card className="p-6 border-border/50 bg-background hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl font-bold mb-1">2 min</div>
                <div className="text-sm text-muted-foreground">Average time to generate a document</div>
              </Card>

              <Card className="p-6 border-border/50 bg-background hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl font-bold mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Labour law compliance</div>
              </Card>

              <Card className="p-6 border-border/50 bg-background hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl font-bold mb-1">Secure</div>
                <div className="text-sm text-muted-foreground">Bank-level data protection</div>
              </Card>

              <Card className="p-6 border-border/50 bg-background hover:shadow-lg transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="text-3xl font-bold mb-1">Easy</div>
                <div className="text-sm text-muted-foreground">No training required</div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16 space-y-4 animate-fade-in">
            <p className="text-sm uppercase tracking-wider text-primary font-semibold">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Frequently asked questions</h2>
            <p className="text-lg text-muted-foreground">
              Got questions? We've got answers.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">Is nudoc compliant with South African labour law?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                Yes, all our templates are designed to meet South African labour law requirements and progressive discipline standards. We regularly update our templates to reflect any changes in legislation.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">How many employees can I add?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                You can add unlimited employees to your account. You'll pay R250/month for the base subscription, plus R3.00 for each employee profile you create in the system.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">Can I export documents to PDF?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                Absolutely. Every document can be exported to PDF with one click, ready for printing, signing, or sharing with employees and stakeholders.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">What types of documents can I generate?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                Currently, nudoc supports the full range of disciplinary documents including first warnings, second warnings, serious warnings, and final warnings. We're continuously adding new document types based on customer feedback.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">Is my data secure?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                Yes, we take security seriously. All data is encrypted in transit and at rest, and we use bank-level security protocols. Your employee information is stored securely and is only accessible by authorized users in your organization.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-border/50 rounded-xl px-6 bg-background">
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold">Can I cancel my subscription anytime?</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. Your data will remain accessible for 30 days after cancellation.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Ready to streamline your HR processes?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join South African businesses that trust nudoc for fast, compliant HR documentation.
          </p>
          <Link to="/auth?new=1">
            <Button size="lg" className="text-base px-12 shadow-lg hover:shadow-xl transition-all">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 grid place-items-center text-primary-foreground font-bold">
              n
            </div>
            <span className="text-lg font-bold">nudoc</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 nudoc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
