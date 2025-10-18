import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Users, Shield, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">HR DocGen</span>
          </div>
          <div className="flex gap-3">
            <Link to="/auth">
              <Button variant="outline">Log In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Professional HR Documents,
            <span className="text-primary"> Generated Instantly</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Streamline your disciplinary process with automated document generation. 
            Create legally compliant written warnings in minutes, not hours.
          </p>
          <div className="pt-4">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <FileText className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Instant Generation</h3>
            <p className="text-muted-foreground text-sm">
              Create professional written warnings in seconds with our easy-to-use forms.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <Users className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Employee Management</h3>
            <p className="text-muted-foreground text-sm">
              Store employee information and auto-populate documents with saved details.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <Shield className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Legal Compliance</h3>
            <p className="text-muted-foreground text-sm">
              All documents follow South African labour law standards and best practices.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <Clock className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Save Time</h3>
            <p className="text-muted-foreground text-sm">
              Reduce document preparation time from hours to minutes with automation.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary font-bold text-xl">
              1
            </div>
            <h3 className="font-semibold">Sign Up</h3>
            <p className="text-muted-foreground text-sm">
              Create your company account and complete your profile in minutes.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary font-bold text-xl">
              2
            </div>
            <h3 className="font-semibold">Add Employees</h3>
            <p className="text-muted-foreground text-sm">
              Import or manually add employee information to your secure database.
            </p>
          </div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary font-bold text-xl">
              3
            </div>
            <h3 className="font-semibold">Generate Documents</h3>
            <p className="text-muted-foreground text-sm">
              Fill in the form and download professional A4 PDFs ready for printing.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <Card className="p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your HR processes?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join companies across South Africa that trust HR DocGen for their disciplinary documentation needs.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-8">
              Get Started Now
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>&copy; 2025 HR DocGen. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;