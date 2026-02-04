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
        setCreateDialogOpen(false);
        router.push(`/room/${data.id}`);
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
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={profile?.avatar_url || user.user_metadata?.avatar_url}
              name={profile?.full_name || user.user_metadata?.full_name}
              email={user.email}
              className="h-10 w-10"
            />
            <div>
              <h1 className="text-2xl font-bold">Intent Writer</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.full_name || user.user_metadata?.full_name || user.email}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-4">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </DialogTrigger>
            <DialogContent>
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
            </DialogContent>
          </Dialog>

          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                <LogIn className="h-4 w-4 mr-2" />
                Join Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Writing Room</DialogTitle>
                <DialogDescription>
                  Enter a document ID or paste a shared link
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
                  placeholder="Paste document ID or link..."
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
        <Card>
          <CardHeader>
            <CardTitle>Your Documents</CardTitle>
            <CardDescription>
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">No documents yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first document or join an existing room to get started
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {ownedDocuments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Owned by You</h3>
                    <div className="space-y-2">
                      {ownedDocuments.map((doc, index) => (
                        <div key={doc.id}>
                          {index > 0 && <Separator className="my-2" />}
                          <div className="flex items-center justify-between py-2">
                            <button
                              onClick={() => router.push(`/room/${doc.id}`)}
                              className="flex-1 text-left group"
                            >
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium group-hover:underline">
                                  {doc.title}
                                </h3>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Last updated: {new Date(doc.updated_at).toLocaleDateString()}
                              </p>
                            </button>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShareClick(doc.id)}
                              >
                                <Share2 className="h-4 w-4 mr-1" />
                                Share
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {collaboratedDocuments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Collaborated</h3>
                    <div className="space-y-2">
                      {collaboratedDocuments.map((doc, index) => (
                        <div key={doc.id}>
                          {index > 0 && <Separator className="my-2" />}
                          <div className="flex items-center justify-between py-2">
                            <button
                              onClick={() => router.push(`/room/${doc.id}`)}
                              className="flex-1 text-left group"
                            >
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium group-hover:underline">
                                  {doc.title}
                                </h3>
                                <Badge variant="secondary" className="text-xs">
                                  Collaborator
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Last updated: {new Date(doc.updated_at).toLocaleDateString()}
                              </p>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
