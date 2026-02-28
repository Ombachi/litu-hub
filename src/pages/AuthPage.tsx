import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/");
      }
    } else {
      const { error } = await signUp(email, password, firstName, lastName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Check your email to confirm your account!");
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sidebar-primary mx-auto">
            <BookOpen className="h-8 w-8 text-sidebar-primary-foreground" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold text-primary-foreground">
            Litu Hub
          </h1>
          <p className="mt-3 text-lg text-primary-foreground/80">
            Kenya's premier learning management system. Access courses, assignments, quizzes, and more.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">Litu Hub</span>
          </div>

          <h2 className="font-display text-2xl font-bold">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {isLogin ? "Sign in to continue learning" : "Join Litu Hub to start learning"}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11 w-full rounded-lg border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Juma"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11 w-full rounded-lg border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Kariuki"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
