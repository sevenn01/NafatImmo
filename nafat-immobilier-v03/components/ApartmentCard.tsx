
import React from 'react';
import { Apartment, ApartmentStatus, Project } from '../types';
import { HomeIcon, GarageIcon, EditIcon, TrashIcon, BedIcon, BathIcon, SunIcon, FlameIcon, LockIcon, UnlockIcon } from './icons/Icons';

interface ApartmentCardProps {
  apartment: Apartment;
  project?: Project;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onEdit: (apartment: Apartment) => void;
  onDelete: (apartment: Apartment) => void;
  onRent: (apartment: Apartment) => void;
  onSell: (apartment: Apartment) => void;
  onViewContractHolder: (apartment: Apartment) => void;
}

const translateStatus = (status: ApartmentStatus) => {
    switch (status) {
        case ApartmentStatus.Available: return 'Disponible';
        case ApartmentStatus.Rented: return 'Loué';
        case ApartmentStatus.Maintenance: return 'En Maintenance';
        case ApartmentStatus.ForSale: return 'À Vendre';
        case ApartmentStatus.Sold: return 'Vendu';
        default: return status;
    }
};

const getStatusClasses = (status: ApartmentStatus) => {
  switch (status) {
    case ApartmentStatus.Available: return 'bg-green-100 text-green-800';
    case ApartmentStatus.Rented: return 'bg-blue-100 text-blue-800';
    case ApartmentStatus.Maintenance: return 'bg-yellow-100 text-yellow-800';
    case ApartmentStatus.ForSale: return 'bg-purple-100 text-purple-800';
    case ApartmentStatus.Sold: return 'bg-gray-200 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const ApartmentInfo: React.FC<{ icon: React.ReactNode; label: string; value: string | number | undefined }> = ({ icon, label, value }) => (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
        {icon}
        <span><strong className="font-medium text-gray-800">{label}:</strong> {value}</span>
    </div>
);

const ApartmentAmenity: React.FC<{ icon: React.ReactNode; label: string; available: boolean | undefined }> = ({ icon, label, available }) => {
    if (!available) return null;
    return (
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
            {icon}
            <span>{label}</span>
        </div>
    );
}

const ApartmentCard: React.FC<ApartmentCardProps> = ({ apartment, project, isLocked = false, onToggleLock, onEdit, onDelete, onRent, onSell, onViewContractHolder }) => {

  const handleToggleLock = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(onToggleLock) onToggleLock();
  };

  const renderFooter = () => {
    switch(apartment.status) {
        case ApartmentStatus.Rented:
        case ApartmentStatus.Sold:
            return (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-800">{apartment.status === 'sold' && apartment.sale_price_dh ? apartment.sale_price_dh.toLocaleString() : apartment.price_dh.toLocaleString()} DH</p>
                    <p className="text-xs text-gray-500">Contrat: {apartment.current_contract_id?.substring(0,8)}...</p>
                  </div>
                  <button type="button" onClick={() => onViewContractHolder(apartment)} className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                    Détails
                  </button>
                </div>
            );
        case ApartmentStatus.Available:
             return (
                 <div className="flex items-center justify-between">
                  <div>
                     <p className="text-lg font-bold text-gray-800">{apartment.price_dh.toLocaleString()} DH <span className="text-sm font-normal text-gray-500">/ mois</span></p>
                  </div>
                  <button type="button" onClick={() => onRent(apartment)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                    Louer
                  </button>
                </div>
             );
        case ApartmentStatus.ForSale:
             return (
                 <div className="flex items-center justify-between">
                  <div>
                     <p className="text-lg font-bold text-gray-800">{apartment.sale_price_dh?.toLocaleString()} DH</p>
                  </div>
                  <button type="button" onClick={() => onSell(apartment)} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                    Vendre
                  </button>
                </div>
             );
        default:
             return (
                 <div className="text-center">
                    <p className="text-sm text-gray-500">Aucune action disponible</p>
                 </div>
             );
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-200 flex flex-col">
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start">
          <div>
            <div className="uppercase tracking-wide text-xs text-green-600 font-bold flex items-center">
              {apartment.type === 'apartment' ? <HomeIcon className="w-4 h-4 mr-1"/> : <GarageIcon className="w-4 h-4 mr-1" />}
              {project?.project_name || 'N/A'}
            </div>
            <h3 className="block mt-1 text-lg leading-tight font-semibold text-gray-900">{apartment.name}</h3>
          </div>
          
          <div className="flex items-center space-x-1">
             {isLocked ? (
                 <button type="button" onClick={handleToggleLock} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors" title="Propriété verrouillée. Cliquer pour déverrouiller.">
                     <LockIcon className="w-5 h-5" />
                 </button>
             ) : (
                 <>
                    <button type="button" onClick={() => onEdit(apartment)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-green-600" title="Modifier">
                        <EditIcon className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => onDelete(apartment)} className="p-2 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600" title="Supprimer">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={handleToggleLock} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Verrouiller">
                        <UnlockIcon className="w-5 h-5" />
                    </button>
                 </>
             )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${getStatusClasses(apartment.status)}`}>
              {translateStatus(apartment.status)}
            </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-gray-600">
            <ApartmentInfo icon={<span className="font-bold text-lg">m²</span>} label="Surface" value={`${apartment.surface_m2}`} />
            <ApartmentInfo icon={<HomeIcon className="w-4 h-4" />} label="Étage" value={apartment.floor} />
            {apartment.type === 'apartment' && <>
                <ApartmentInfo icon={<BedIcon className="w-4 h-4"/>} label="Pièces" value={apartment.rooms} />
                <ApartmentInfo icon={<BathIcon className="w-4 h-4"/>} label="S. Bains" value={apartment.bathroom} />
            </>}
        </div>

        {apartment.type === 'apartment' && (
            <div className="mt-4 flex items-center space-x-2">
                <ApartmentAmenity icon={<SunIcon className="w-4 h-4 text-yellow-500" />} label="Balcon" available={apartment.balcony} />
                <ApartmentAmenity icon={<FlameIcon className="w-4 h-4 text-orange-500" />} label="Cuisine" available={apartment.kitchen} />
            </div>
        )}

      </div>
      <div className="p-6 bg-gray-50 border-t border-gray-200">
          {renderFooter()}
        </div>
    </div>
  );
};

export default ApartmentCard;
