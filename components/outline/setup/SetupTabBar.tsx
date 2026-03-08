"use client";

import { Button } from "@/components/ui/button";
import { ListTree, Users, Link2, Play } from "lucide-react";

export type SetupTab = 'outline' | 'assign' | 'relationships';

type TabConfig = {
  id: SetupTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeType?: 'default' | 'warning' | 'success';
};

type SetupTabBarProps = {
  activeTab: SetupTab;
  onTabChange: (tab: SetupTab) => void;
  rootBlocksCount: number;
  assignedCount: number;
  relationshipCount: number;
  unconfirmedCount: number;
  onStartWriting?: () => void;
};

/**
 * Tab navigation bar for the Setup Phase.
 * Shows Outline, Assign, and Relationships tabs with status badges.
 */
export function SetupTabBar({
  activeTab,
  onTabChange,
  rootBlocksCount,
  assignedCount,
  relationshipCount,
  unconfirmedCount,
  onStartWriting,
}: SetupTabBarProps) {
  const tabs: TabConfig[] = [
    {
      id: 'outline',
      label: 'Outline',
      icon: <ListTree className="h-4 w-4" />,
      badge: `${rootBlocksCount}`,
      badgeType: rootBlocksCount >= 2 ? 'success' : 'default',
    },
    {
      id: 'assign',
      label: 'Assign',
      icon: <Users className="h-4 w-4" />,
      badge: assignedCount === 0 ? 'waiting' : `${assignedCount}/${rootBlocksCount}`,
      badgeType: assignedCount === 0 ? 'warning' : assignedCount === rootBlocksCount ? 'success' : 'default',
    },
    {
      id: 'relationships',
      label: 'Relationships',
      icon: <Link2 className="h-4 w-4" />,
      badge: relationshipCount === 0 ? 'waiting' : unconfirmedCount > 0 ? `${unconfirmedCount} to confirm` : `${relationshipCount}`,
      badgeType: relationshipCount === 0 ? 'warning' : unconfirmedCount > 0 ? 'warning' : 'success',
    },
  ];

  return (
    <div className="flex items-center justify-between px-4 border-b">
      {/* Tabs */}
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                tab.badgeType === 'warning'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  : tab.badgeType === 'success'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {tab.badge}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Start Writing button */}
      {onStartWriting && (
        <Button
          onClick={() => {
            if (confirm('Start writing? This creates a baseline snapshot of your outline.')) {
              onStartWriting();
            }
          }}
          size="sm"
        >
          <Play className="h-4 w-4 mr-1" />
          Start Writing
        </Button>
      )}
    </div>
  );
}
