"use client";

import { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { setDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";
import PageWrapper from "@/components/ui/PageWrapper";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Handle theme toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (isRegistering) {
        result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: username });
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: username,
          createdAt: new Date().toISOString(),
        });
        toast.success("🎉 Account created successfully!");
        router.push("/dashboard");
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
        toast.success("✅ Login successful!");
        if (!result.user.displayName) {
          router.push("/profile");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      console.error("auth error:", err);
      if (err.code === "auth/user-not-found") {
        toast.warning("Account not found", {
          description: "Would you like to create an account?",
          action: {
            label: "Create",
            onClick: () => setIsRegistering(true),
          },
        });
      } else if (err.code === "auth/wrong-password") {
        toast.error("Incorrect password", {
          description: "Please double-check your password and try again.",
        });
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email address", {
          description: "Please enter a valid email format.",
        });
      } else {
        toast.error("Login failed", {
          description: err.message || "Something went wrong.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      toast.success("Signed in with Google!");
      if (!result.user.displayName) {
        router.push("/profile");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Google login failed");
    }
  };

  console.log("Logging in with", email, password);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (!user.displayName) {
        router.replace("/profile");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, loading]);

 return (
  <PageWrapper>
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="flex flex-col lg:flex-row w-full max-w-4xl shadow-lg rounded-xl overflow-hidden bg-background border-border">
        {/* Left side: Branding (visible on larger screens) */}
        <div className="hidden lg:flex flex-col justify-center items-center bg-primary text-primary-foreground w-1/2 p-8">
          <h2 className="text-3xl font-bold mb-4">Welcome to the PM<sub className="text-lg">2.5</sub> Dashboard</h2>
          <p className="text-sm text-primary-foreground/80 text-center">
            Monitor, Predict, and Manage air quality using real-time data analytics. <br />
            Log in to access advanced tools and insights.
          </p>
        </div>

        {/* Right side: Login/Register Form */}
        <div className="w-full lg:w-1/2 p-6">
          <CardHeader className="space-y-2 p-0">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold text-foreground">
                {isRegistering ? "Create Account" : "Login"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-foreground hover:bg-muted"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              {isRegistering
                ? "Register to access your dashboard."
                : "Sign in to your account."}
            </CardDescription>
            <Button
              variant="link"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-primary hover:text-primary/80 p-0"
            >
              {isRegistering ? "Already have an account?" : "Create a new account"}
            </Button>
          </CardHeader>

          <CardContent className="p-0 mt-4">
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border text-foreground focus:ring focus:ring-ring"
                />
              </div>

              {isRegistering && (
                <div className="grid gap-2">
                  <Label htmlFor="username" className="text-foreground">Username</Label>
                  <Input
                    id="username"
                    placeholder="your_username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-background border-border text-foreground focus:ring focus:ring-ring"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border text-foreground focus:ring focus:ring-ring"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
              >
                {loading
                  ? isRegistering
                    ? "Creating..."
                    : "Logging in..."
                  : isRegistering
                    ? "Create Account"
                    : "Login"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-2 p-0 mt-6">
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              disabled={loading}
              className="w-full bg-background border-border text-foreground hover:bg-muted"
            >
              Continue with Google
            </Button>
          </CardFooter>
        </div>
      </Card>
    </div>
  </PageWrapper>
);
}