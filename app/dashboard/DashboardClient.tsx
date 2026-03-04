"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, LogIn, Share2, Trash2 } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";
import ShareDialog from "@/components/share/ShareDialog";
import { LogoIcon } from "@/components/common/Logo";

type Document = {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardClientProps = {
  user: User;
  profile: Profile | null;
  initialDocuments: Document[];
};

export default function DashboardClient({ user, profile, initialDocuments }: DashboardClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [joinDocId, setJoinDocId] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  // Track newly created document for post-creation flow
  const [newlyCreatedDoc, setNewlyCreatedDoc] = useState<Document | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleShareClick = (docId: string) => {
    setShareDocId(docId);
    setShareDialogOpen(true);
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("documents")
        .insert([
          {
            title: newDocTitle,
            owner_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Register the owner as a collaborator with "owner" role
        const { error: collabError } = await supabase.from("document_collaborators").insert([
          {
            document_id: data.id,
            user_id: user.id,
            role: "owner",
          },
        ]);
        if (collabError) {
          console.error("Failed to register owner as collaborator:", collabError);
        }

        setDocuments([data, ...documents]);
        setNewDocTitle("");
        // Show post-creation options instead of immediately navigating
        setNewlyCreatedDoc(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create document");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch("/api/delete-document", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete document");
      }

      setDocuments(documents.filter((doc) => doc.id !== docId));
    } catch (err: any) {
      setError(err.message || "Failed to delete document");
    }
  };

  const handleJoinDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinDocId.trim()) return;

    setJoinLoading(true);
    setJoinError(null);

    try {
      const docId = joinDocId.trim();

      // Check if document exists (now allowed by RLS for all authenticated users)
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", docId)
        .single();

      if (docError || !doc) {
        throw new Error("Document not found. Please check the ID and try again.");
      }

      // Check if user is the owner
      if (doc.owner_id === user.id) {
        // Owner can just navigate to the room
        setJoinDocId("");
        setJoinDialogOpen(false);
        router.push(`/room/${docId}`);
        return;
      }

      // Check if user is already a collaborator
      const { data: existingCollab } = await supabase
        .from("document_collaborators")
        .select("id")
        .eq("document_id", docId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingCollab) {
        // Already a collaborator, just navigate
        setJoinDocId("");
        setJoinDialogOpen(false);
        router.push(`/room/${docId}`);
        return;
      }

      // Add user as collaborator (RLS allows users to add themselves)
      const { error: collabError } = await supabase
        .from("document_collaborators")
        .insert([
          {
            document_id: docId,
            user_id: user.id,
            role: "editor",
          },
        ]);

      if (collabError) throw collabError;

      // Add to local state and navigate
      setDocuments([doc, ...documents]);
      setJoinDocId("");
      setJoinDialogOpen(false);
      router.push(`/room/${docId}`);
    } catch (err: any) {
      setJoinError(err.message || "Failed to join document");
    } finally {
      setJoinLoading(false);
    }
  };

  // Separate owned and collaborated documents
  const ownedDocuments = documents.filter((doc) => doc.owner_id === user.id);
  const collaboratedDocuments = documents.filter((doc) => doc.owner_id !== user.id);

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={30} />
            <h1 className="text-primary text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>IntentWriter</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                avatarUrl={profile?.avatar_url || user.user_metadata?.avatar_url}
                name={profile?.full_name || user.user_metadata?.full_name}
                email={user.email}
                className="h-7 w-7"
              />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {profile?.full_name || user.user_metadata?.full_name || user.email}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Dialog
            open={createDialogOpen}
            onOpenChange={(open) => {
              setCreateDialogOpen(open);
              if (!open) {
                setNewlyCreatedDoc(null);
                setNewDocTitle("");
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background border hover:border-primary hover:shadow-sm transition-all group">
                <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="h-5 w-5" />
                </span>
                <div className="text-left">
                  <div className="font-medium text-sm">New Document</div>
                  <div className="text-xs text-muted-foreground">Create your own</div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent>
              {newlyCreatedDoc ? (
                // Post-creation success state with workflow explanation
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">✓</span>
                      Document Created!
                    </DialogTitle>
                  </DialogHeader>

                  {/* Workflow explanation */}
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                    <p className="text-sm font-medium">How IntentWriter works:</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                        <span><strong>Invite Team</strong> — Share the document with collaborators</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                        <span><strong>Build Outline</strong> — Define what your team wants to write</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                        <span><strong>Write Together</strong> — AI keeps everyone aligned</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-4">
                    <Button
                      onClick={() => {
                        setShareDocId(newlyCreatedDoc.id);
                        setCreateDialogOpen(false);
                        setNewlyCreatedDoc(null);
                        setShareDialogOpen(true);
                      }}
                      className="w-full"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Invite Team
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const docId = newlyCreatedDoc.id;
                        setCreateDialogOpen(false);
                        setNewlyCreatedDoc(null);
                        router.push(`/room/${docId}`);
                      }}
                      className="w-full"
                    >
                      Skip for Now
                    </Button>
                  </div>
                </>
              ) : (
                // Initial create form
                <>
                  <DialogHeader>
                    <DialogTitle>Create New Document</DialogTitle>
                    <DialogDescription>
                      Start a new collaborative writing session
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateDocument} className="space-y-4 mt-4">
                    <Input
                      type="text"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      placeholder="Enter document title..."
                      disabled={loading}
                      autoFocus
                    />
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading || !newDocTitle.trim()}>
                        {loading ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background border hover:border-primary hover:shadow-sm transition-all group">
                <span className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <LogIn className="h-5 w-5" />
                </span>
                <div className="text-left">
                  <div className="font-medium text-sm">Join Document</div>
                  <div className="text-xs text-muted-foreground">Via shared link</div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Document</DialogTitle>
                <DialogDescription>
                  Paste the link shared by your collaborator
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinDocument} className="space-y-4 mt-4">
                <Input
                  type="text"
                  value={joinDocId}
                  onChange={(e) => {
                    // Extract ID from URL if user pastes full URL
                    const val = e.target.value.trim();
                    const match = val.match(/\/room\/([a-f0-9-]+)/);
                    setJoinDocId(match ? match[1] : val);
                  }}
                  placeholder="Paste the shared link here..."
                  disabled={joinLoading}
                  autoFocus
                />
                {joinError && (
                  <p className="text-sm text-destructive">{joinError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setJoinDialogOpen(false)}
                    disabled={joinLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={joinLoading || !joinDocId.trim()}>
                    {joinLoading ? "Joining..." : "Join"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Share Dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          documentId={shareDocId}
          isOwner={true}
        />

        {/* Documents List */}
        <div className="bg-background rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="text-lg">Your Documents</h2>
            <p className="text-sm text-muted-foreground">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
          <div className="p-2">
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">No documents yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first document or join an existing room to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ownedDocuments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide px-3 py-2">Owned by You</h3>
                    <div className="space-y-0.5">
                      {ownedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <button
                            onClick={() => router.push(`/room/${doc.id}`)}
                            className="flex-1 text-left"
                          >
                            <div className="font-medium text-sm group-hover:text-primary transition-colors">
                              {doc.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(doc.updated_at).toLocaleDateString()}
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShareClick(doc.id)}
                              className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="h-8 px-2 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {collaboratedDocuments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wide px-3 py-2">Shared with You</h3>
                    <div className="space-y-0.5">
                      {collaboratedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <button
                            onClick={() => router.push(`/room/${doc.id}`)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm group-hover:text-primary transition-colors">
                                {doc.title}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Shared
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(doc.updated_at).toLocaleDateString()}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
