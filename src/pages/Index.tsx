import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Users,
  Shield,
  Clock,
  Sparkles,
  ScanLine,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/80 to-primary shadow-elegant grid place-items-center text-primary-foreground font-semibold">
              n
            </div>
            <span className="text-lg font-semibold tracking-tight">nudoc</span>
          </div>
          <div className="flex gap-3">
            <Link to="/auth">
              <Button variant="outline">Log In</Button>
            </Link>
            <Link to="/auth?new=1">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pb-12 pt-16 md:pt-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary px-3 py-1 rounded-full">
              Faster, compliant HR docs
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Generate disciplinary documents
                <span className="text-primary block">in minutes, beautifully.</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Guided flows, compliant templates, and dynamic previews so you can finalize written warnings without spreadsheets or legal
                guesswork.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Link to="/auth?new=1">
                <Button size="lg" className="text-lg px-7">
                  Start free trial
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="lg" className="px-6">
                  View dashboard
                </Button>
              </Link>
            </div>
            <div className="flex gap-6 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Legally aligned</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Instant PDFs</span>
              </div>
            </div>
          </div>

          {/* Animated hero visualization */}
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/50 shadow-elegant">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsla(var(--primary),0.12),transparent_35%),radial-gradient(circle_at_80%_0%,hsla(var(--primary),0.12),transparent_30%),radial-gradient(circle_at_50%_80%,hsla(var(--primary),0.14),transparent_28%)]" />
            <div className="relative p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Live preview</p>
                  <p className="font-semibold">Written warning PDF</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur p-4 shadow-card animate-floating">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Form</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Guided
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Employee</span>
                      <span className="font-semibold">A. Mokoena</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Infraction</span>
                      <span className="font-semibold">Absenteeism</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-semibold">Final Warning</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-semibold">12 Nov 2025</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-card animate-floating delay-150">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Smart clauses</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <p className="text-muted-foreground">Preamble</p>
                      <p className="font-semibold">Context auto-filled from prior warnings and policy.</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <p className="text-muted-foreground">Action plan</p>
                      <p className="font-semibold">Next check-in scheduled. Signatures ready.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>SA labour aligned</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Auto employee data</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Ready in seconds</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Interactive capabilities */}
      <section className="container mx-auto px-6 py-16">
        <div className="flex items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">What you can do</p>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">Animated workflows, zero guesswork</h2>
          </div>
          <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/30">
            Live demo
          </Badge>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-background to-secondary/60 shadow-elegant">
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_10%_20%,hsla(var(--primary-glow),0.25),transparent_30%),radial-gradient(circle_at_80%_30%,hsla(var(--primary),0.15),transparent_28%),radial-gradient(circle_at_50%_90%,hsla(var(--primary),0.18),transparent_35%)]" />
            <div className="relative p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Flow demo</p>
                    <p className="font-semibold">From incident to signed PDF</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                  Try it
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border/60 bg-background/80 p-4 backdrop-blur animate-floating">
                  <p className="text-xs text-muted-foreground mb-2">Step 1</p>
                  <h3 className="font-semibold">Capture incident</h3>
                  <p className="text-sm text-muted-foreground">Guided form with policy hints and completion checks.</p>
                  <div className="mt-4 h-2 w-full rounded-full bg-secondary">
                    <div className="h-full w-4/5 rounded-full bg-primary animate-gradient" />
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 animate-floating delay-150">
                  <p className="text-xs text-primary mb-2">Step 2</p>
                  <h3 className="font-semibold">Smart clauses</h3>
                  <p className="text-sm text-muted-foreground">Auto-inserted legal language aligned to SA labour law.</p>
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Preamble</span>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Prior warnings</span>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Action plan</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 p-4 animate-floating delay-300">
                  <p className="text-xs text-muted-foreground mb-2">Step 3</p>
                  <h3 className="font-semibold">Preview & sign</h3>
                  <p className="text-sm text-muted-foreground">One-click PDF export or share for signatures instantly.</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-secondary py-2">PDF</div>
                    <div className="rounded-lg bg-secondary py-2">Share</div>
                    <div className="rounded-lg bg-secondary py-2">Print</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="p-5 border-border/60 bg-background/80 backdrop-blur shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Compliance</p>
                  <p className="font-semibold">South African labour ready</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Progressive discipline baked in</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Evidence and context capture</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Clear instructions for managers</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border/60 bg-gradient-to-br from-primary/5 via-background to-secondary/60 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">People</p>
                  <p className="font-semibold">Employee single source</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">Centralised profiles auto-populate forms and PDFs.</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-secondary px-3 py-2 text-center">Records</div>
                  <div className="rounded-lg bg-secondary px-3 py-2 text-center">Warnings</div>
                  <div className="rounded-lg bg-secondary px-3 py-2 text-center">Reviews</div>
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border/60 bg-background/90 backdrop-blur shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Efficiency</p>
                  <p className="font-semibold">Minutes, not hours</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Avg. time to PDF</p>
                  <p className="text-xl font-semibold">00:02:19</p>
                </div>
                <div className="h-16 w-16 rounded-full border border-primary/30 grid place-items-center bg-primary/5 animate-pulse-slow">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="container mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/70">
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Instant generation</h3>
            <p className="text-muted-foreground text-sm">
              Create professional written warnings in seconds with our guided, validated forms.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/70">
            <Users className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Employee memory</h3>
            <p className="text-muted-foreground text-sm">
              Store employee information once and auto-populate every document with context.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/70">
            <Shield className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Labour compliant</h3>
            <p className="text-muted-foreground text-sm">
              Templates align with South African labour law and progressive discipline.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/70">
            <Clock className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Save hours</h3>
            <p className="text-muted-foreground text-sm">
              Reduce document preparation time from hours to minutes with automation.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-20">
        <Card className="p-12 text-center bg-gradient-to-br from-primary/6 via-primary/10 to-primary/5 border-primary/20 shadow-elegant">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your HR processes?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join companies across South Africa that trust nudoc for disciplinary documentation and employee clarity.
          </p>
          <Link to="/auth?new=1">
            <Button size="lg" className="text-lg px-8">
              Get Started Now
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>© 2025 nudoc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
