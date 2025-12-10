
import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardIcon, BuildingIcon, HomeIcon, UsersIcon, FileTextIcon, PaymentIcon, SettingsIcon } from './icons/Icons';
import { useAuth } from '../auth/AuthContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const commonLinkClass = "flex items-center px-4 py-2.5 text-gray-600 transition-colors duration-200 transform rounded-lg";
  const activeLinkClass = "bg-gray-200 text-gray-800";
  const inactiveLinkClass = "hover:bg-gray-100";
  
  // Safe permission check
  const canView = (section: keyof typeof user.permissions) => {
      if (!user || !user.permissions) return false;
      return user.permissions[section]?.view;
  };

  return (
    <div className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
         <h1 className="text-xl font-bold text-gray-800">Nafat Immobilier</h1>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <nav className="flex-1">
          {canView('dashboard') && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}
              >
                <DashboardIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Tableau de Bord</span>
              </NavLink>
          )}
          {canView('projects') && (
              <NavLink
                to="/projets"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} mt-2`}
              >
                <BuildingIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Projets</span>
              </NavLink>
          )}
          {canView('apartments') && (
              <NavLink
                to="/appartements"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} mt-2`}
              >
                <HomeIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Appartements</span>
              </NavLink>
          )}
          {canView('clients') && (
              <NavLink
                to="/clients"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} mt-2`}
              >
                <UsersIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Clients</span>
              </NavLink>
          )}
          {canView('contracts') && (
              <NavLink
                to="/contrats"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} mt-2`}
              >
                <FileTextIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Contrats</span>
              </NavLink>
          )}
          {canView('payments') && (
              <NavLink
                to="/paiements"
                className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass} mt-2`}
              >
                <PaymentIcon className="w-5 h-5" />
                <span className="ml-3 font-medium">Paiements</span>
              </NavLink>
          )}
        </nav>
        
        <div className="pt-4 border-t border-gray-200">
             {canView('settings') && (
                 <NavLink
                    to="/settings"
                    className={({ isActive }) => `${commonLinkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="ml-3 font-medium">Paramètres</span>
                  </NavLink>
             )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
