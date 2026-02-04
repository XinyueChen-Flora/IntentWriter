"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, Mail, X } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";

type Collaborator = {
  id: string;
  userId: string;
  role: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  isOwner: boolean;
};

export default function ShareDialog({ open, onOpenChange, documentId, isOwner: isOwnerProp }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverIsOwner, setServerIsOwner] = useState<boolean | null>(null);

  // Use server-side isOwner when available, fall back to prop
  const isOwner = serverIsOwner ?? isOwnerProp;

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${documentId}` : "";

  const fetchMembers = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/document-members?documentId=${documentId}`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators);
        setPendingInvitations(data.pendingInvitations);
        setServerIsOwner(data.isOwner);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to fetch document members:', res.status, errData);
      }
    } catch (err) {
      console.error('Failed to fetch document members:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      setStatusMessage(null);
      setEmail("");
    }
  }, [open, fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), documentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Failed to send invitation" });
      } else {
        setStatusMessage({ type: "success", text: data.message });
        setEmail("");
        // Refresh members list
        fetchMembers();
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to send invitation" });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      const res = await fetch("/api/remove-collaborator", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, documentId }),
      });

      if (res.ok) {
        setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
      }
    } catch {
      // Ignore
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch("/api/remove-collaborator", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, documentId }),
      });

      if (res.ok) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch {
      // Ignore
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Email invite (owner only) */}
          {isOwner && (
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviting}
                className="flex-1"
              />
              <Button type="submit" disabled={inviting || !email.trim()}>
                {inviting ? "Sending..." : "Invite"}
              </Button>
            </form>
          )}

          {/* Status message */}
          {statusMessage && (
            <div
              className={`rounded-md border p-3 text-sm ${
                statusMessage.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
                  : "border-destructive bg-destructive/10 text-destructive"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* People with access */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">People with access</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collaborators yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        avatarUrl={collab.avatarUrl}
                        name={collab.fullName}
                        email={collab.email}
                        className="h-7 w-7"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {collab.fullName || collab.email.split("@")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {collab.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {collab.role}
                      </Badge>
                      {isOwner && collab.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveCollaborator(collab.userId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invitations (owner only) */}
          {isOwner && pendingInvitations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Pending invitations</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => handleCancelInvitation(invitation.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Share link */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Share link</h4>
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 text-xs"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
