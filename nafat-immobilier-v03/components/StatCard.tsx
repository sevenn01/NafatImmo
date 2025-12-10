import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  // FIX: Specified that the icon element accepts a className prop to resolve cloneElement type error.
  icon: React.ReactElement<{ className?: string }>;
  color?: 'green' | 'blue' | 'red' | 'indigo' | 'yellow' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = 'gray' }) => {
    const colorClasses = {
        green: 'bg-green-100 text-green-600',
        blue: 'bg-blue-100 text-blue-600',
        red: 'bg-red-100 text-red-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
        gray: 'bg-gray-100 text-gray-600'
    };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center space-x-4">
      <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg ${colorClasses[color]}`}>
        {/* FIX: Removed 'as React.ReactElement' cast as it is no longer needed with the updated prop type */}
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;