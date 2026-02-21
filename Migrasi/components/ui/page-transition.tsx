import React from 'react';

export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}

export function PageHeader({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
}
