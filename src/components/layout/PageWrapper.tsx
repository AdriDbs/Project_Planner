import React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <main className={`flex-1 overflow-auto p-6 ${className}`}>
      {children}
    </main>
  );
}
