import { useState, useEffect } from "react";
import type { DocumentMember } from "@/lib/types";

export function useDocumentMembers(roomId: string, userId: string) {
  const [documentMembers, setDocumentMembers] = useState<DocumentMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/document-members?documentId=${roomId}`);
        if (res.ok) {
          const data = await res.json();
          const members: DocumentMember[] = (data.collaborators || []).map((c: any) => ({
            userId: c.userId,
            name: c.fullName || c.email?.split('@')[0] || 'User',
            email: c.email || '',
            avatarUrl: c.avatarUrl || undefined,
            role: c.role,
          }));
          setDocumentMembers(members);
          setIsOwner(data.isOwner ?? false);
        }
      } catch {
        // API call failed — members will remain empty
      }
    };
    fetchMembers();
  }, [roomId, userId]);

  return { documentMembers, isOwner };
}
