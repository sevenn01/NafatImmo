import React, { ReactNode } from 'react';

interface DashboardSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({ title, icon, children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-center space-x-3 p-5 border-b border-gray-100">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default DashboardSection;
