"use client";

import { useState, useRef, useEffect } from "react";
import { UserPlus, X } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import { getUserColor } from "@/lib/getUserColor";

type AssignDropdownProps = {
  block: IntentBlock;
  currentUser: User;
  documentMembers: readonly DocumentMember[];
  onlineUserIds: Set<string>;
  userAvatarMap: Map<string, string>;
  assignBlock: (blockId: string, userId: string, userName?: string, userEmail?: string) => void;
  unassignBlock: (blockId: string) => void;
  compact?: boolean;
};

export function AssignDropdown({
  block,
  currentUser,
  documentMembers,
  onlineUserIds,
  userAvatarMap,
  assignBlock,
  unassignBlock,
  compact = false,
}: AssignDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (block.assignee) {
    const assigneeAvatar = userAvatarMap.get(block.assignee!) || documentMembers.find(m => m.userId === block.assignee)?.avatarUrl;
    const sizeClass = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

    return (
      <button
        onClick={() => unassignBlock(block.id)}
        className={`flex items-center gap-1.5 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors ${
          compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
        }`}
        title="Click to unassign"
      >
        <div
          className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center text-white font-semibold flex-shrink-0 ${
            compact ? 'text-[6px]' : 'text-[7px]'
          }`}
          style={!assigneeAvatar ? { backgroundColor: getUserColor(block.assignee!) } : undefined}
        >
          {assigneeAvatar ? (
            <img src={assigneeAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            (block.assigneeName || block.assigneeEmail || 'U').substring(0, 2).toUpperCase()
          )}
        </div>
        <span className={`font-medium ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {block.assignee === currentUser.id
            ? 'You'
            : block.assigneeName || block.assigneeEmail?.split('@')[0] || 'User'}
        </span>
        <X className={compact ? 'h-2.5 w-2.5 text-muted-foreground' : 'h-3 w-3 text-muted-foreground'} />
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors ${
          compact ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        <UserPlus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        <span>Assign</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
          {documentMembers.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No members found</div>
          ) : (
            documentMembers.map((member) => {
              const isOnline = onlineUserIds.has(member.userId);
              const avatar = userAvatarMap.get(member.userId) || member.avatarUrl;
              return (
                <button
                  key={member.userId}
                  onClick={() => {
                    assignBlock(block.id, member.userId, member.name, member.email);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors text-left"
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="h-6 w-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold text-white"
                      style={!avatar ? { backgroundColor: getUserColor(member.userId) } : undefined}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (member.name || member.email || 'U').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-popover ${
                        isOnline ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {member.name}
                      {member.userId === currentUser.id && (
                        <span className="text-muted-foreground font-normal ml-1">(You)</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {member.email}
                      {member.role === 'owner' && ' · Owner'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
