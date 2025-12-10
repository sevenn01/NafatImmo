
import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { EditIcon, TrashIcon } from './icons/Icons';

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}

type RentalStatus = 'Complet' | 'Partiellement Loué' | 'Disponible' | 'Vide' | 'Vendu';

const getRentalStatus = (project: Project): RentalStatus => {
    const total = project.total_apartments;
    const rented = project.rented_apartments_count ?? 0;
    const sold = project.sold_apartments_count ?? 0;
    
    // Total available for rent = Total - Sold
    const rentable = total - sold;

    if (total === 0) return 'Vide';
    
    // If all apartments are sold
    if (rentable === 0 && sold > 0) return 'Vendu';
    
    // If we have rentable units
    if (rentable > 0) {
        if (rented === rentable) return 'Complet';
        if (rented > 0) return 'Partiellement Loué';
        return 'Disponible';
    }
    
    // Fallback if no units
    return 'Vide';
};

const getRentalStatusClasses = (status: RentalStatus) => {
    switch (status) {
        case 'Complet':
            return 'bg-blue-100 text-blue-800';
        case 'Partiellement Loué':
            return 'bg-green-100 text-green-800';
        case 'Disponible':
            return 'bg-yellow-100 text-yellow-800';
        case 'Vendu':
            return 'bg-gray-200 text-gray-800';
        case 'Vide':
            return 'bg-gray-100 text-gray-500';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEdit, onDelete }) => {
  const rentalStatus = getRentalStatus(project);
  const rented = project.rented_apartments_count ?? 0;
  const sold = project.sold_apartments_count ?? 0;
  const total = project.total_apartments;
  // Calculate total rentable units for display
  const rentableTotal = total - sold;
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300 border border-gray-200 flex flex-col">
      <Link to={`/projets/${project.id}`} className="p-6 flex-grow block">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-lg leading-tight font-semibold text-gray-900 hover:text-green-600">{project.project_name}</h3>
                <p className="mt-1 text-sm text-gray-500">{project.location}</p>
            </div>
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${getRentalStatusClasses(rentalStatus)}`}>
                {rentalStatus}
            </span>
        </div>
        <p className="mt-4 text-sm text-gray-600 line-clamp-2 flex-grow">{project.description}</p>
      </Link>
      <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div>
            <p className="text-sm font-medium text-gray-800">
                <span className="font-bold">{rented} / {rentableTotal}</span> Loués
                {sold > 0 && <span className="ml-2 text-xs text-gray-500">({sold} Vendus)</span>}
            </p>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                <EditIcon className="w-5 h-5 text-gray-500" />
            </button>
             <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 rounded-full hover:bg-red-100 transition-colors">
                <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
