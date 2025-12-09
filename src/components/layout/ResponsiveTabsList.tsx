import React from 'react';
import { TabsList } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ResponsiveTabsListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A mobile-friendly TabsList wrapper with horizontal scrolling
 * and proper touch targets for mobile devices.
 */
export const ResponsiveTabsList = ({ children, className }: ResponsiveTabsListProps) => {
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
      <TabsList 
        className={cn(
          "inline-flex h-auto min-w-max gap-1 p-1",
          "md:flex md:flex-wrap",
          className
        )}
      >
        {children}
      </TabsList>
    </div>
  );
};

export default ResponsiveTabsList;
