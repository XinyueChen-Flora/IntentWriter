"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type InviteClientProps = {
  status: "not_found" | "expired" | "already_accepted" | "pending";
  token: string;
  documentId?: string;
  documentTitle?: string;
  inviterName?: string;
  email?: string;
};

export default function InviteClient({
  status,
  token,
  documentId,
  documentTitle,
  inviterName,
  email,
}: InviteClientProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      router.push(`/room/${data.documentId}`);
    } catch (err: any) {
      setError(err.message);
      setAccepting(false);
    }
  };

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has been cancelled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please ask the document owner to send a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "already_accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Already Accepted</CardTitle>
            <CardDescription>
              You have already accepted this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documentId && (
              <Link href={`/room/${documentId}`}>
                <Button className="w-full">Open Document</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // status === "pending"
  const redirectPath = `/invite/${token}`;

  // Still checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            <strong>{inviterName}</strong> has invited you to collaborate on{" "}
            <strong>&ldquo;{documentTitle}&rdquo;</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Invited email: {email}
            </p>
          )}

          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isAuthenticated ? (
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? "Accepting..." : "Accept Invitation"}
            </Button>
          ) : (
            <div className="space-y-3">
              <Link href={`/auth/login?redirect=${encodeURIComponent(redirectPath)}`}>
                <Button className="w-full">Sign In</Button>
              </Link>
              <Link href={`/auth/register?redirect=${encodeURIComponent(redirectPath)}`}>
                <Button variant="outline" className="w-full">
                  Create Account
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
