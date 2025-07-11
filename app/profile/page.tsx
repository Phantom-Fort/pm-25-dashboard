"use client";

import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState, useEffect } from "react";
import AuthenticatedLayout from "@/components/ui/AuthenticatedLayout";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Populate name field if user has displayName
  useEffect(() => {
    if (user && user.displayName) {
      setName(user.displayName);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: name,
        createdAt: new Date().toISOString(),
      });
      toast.success("Profile updated!", {
        description: "Your profile has been successfully updated.",
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error("Failed to update profile", {
        description: error.message || "Something went wrong.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Generate initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "U";
    const names = name.trim().split(" ");
    return names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];
  };

  return (
    <AuthenticatedLayout>
      <div className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 text-white dark:text-white p-6 rounded-2xl shadow-md">
        <h2 className="text-4xl font-bold mb-2">Welcome to Your PM2.5 Prediction Profile</h2>
        <p className="text-md">
          Manage your user account.
        </p>
      </div>

      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="bg-background border-border shadow-md rounded-xl max-w-md w-full">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-bold text-foreground">Edit Your Profile</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Update your profile information to proceed to the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
                {getInitials(name)}
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-background border-border text-foreground focus:ring focus:ring-ring"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted border-border text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
          </CardContent>
          <CardContent className="p-6 pt-0">
            <Button
              onClick={handleSave}
              disabled={!name || isSaving}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}