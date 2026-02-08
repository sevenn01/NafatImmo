import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getApartments, getProjects, addApartment, updateApartment, deleteApartment, getContracts, getClients } from '../services/api';
import { Apartment, Project, ApartmentStatus, Contract, Client } from '../types';
import { PlusIcon, EditIcon, TrashIcon, HomeIcon, GarageIcon, SearchIcon, XCircleIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ApartmentCard from '../components/ApartmentCard';
import ConfirmationModal from '../components/ConfirmationModal';
import Notification from '../components/Notification';

const translateStatus = (status: ApartmentStatus) => {
    switch (status) {
        case ApartmentStatus.Available: return 'Libre (Loc)';
        case ApartmentStatus.Rented: return 'Loué';
        case ApartmentStatus.Maintenance: return 'En Maintenance';
        case ApartmentStatus.ForSale: return 'À Vendre';
        case ApartmentStatus.Sold: return 'Vendu';
        default: return status;
    }
};

const getStatusBadge = (status: ApartmentStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case ApartmentStatus.Available: return `${baseClasses} bg-green-100 text-green-800`;
    case ApartmentStatus.Rented: return `${baseClasses} bg-blue-100 text-blue-800`;
    case ApartmentStatus.ForSale: return `${baseClasses} bg-purple-100 text-purple-800`;
    case ApartmentStatus.Sold: return `${baseClasses} bg-gray-200 text-gray-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const ApartmentsPage: React.FC = () => {
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
    const [propertyType, setPropertyType] = useState<'apartment' | 'garage'>('apartment');
    const [intendedFor, setIntendedFor] = useState<'sale' | 'rental'>('sale');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedFloor, setSelectedFloor] = useState<string>('');
    const [manualName, setManualName] = useState<string>('');
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ status: 'all', type: 'all', projectId: 'all', floor: 'all' });
    
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [apts, projs, ctrs, cls] = await Promise.all([ getApartments(), getProjects(), getContracts(), getClients() ]);
            setApartments(apts); setProjects(projs); setContracts(ctrs); setClients(cls);
        } catch (error) { console.error(error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const suggestedName = useMemo(() => {
        if (!selectedProjectId || !selectedFloor) return manualName;
        const floorApts = apartments.filter(a => a.project_id === selectedProjectId && a.floor === selectedFloor);
        const floorPrefix = selectedFloor === 'RDC' ? '0' : selectedFloor;
        return `Appart ${floorPrefix}0${floorApts.length + 1}`;
    }, [selectedProjectId, selectedFloor, apartments, manualName]);

    useEffect(() => {
        if (!editingApartment && suggestedName && manualName === '') {
            setManualName(suggestedName);
        }
    }, [suggestedName, editingApartment, manualName]);

    const floorOptions = useMemo(() => {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return [];
        const options: string[] = [];
        if (project.has_rdc) options.push('RDC');
        for (let i = 1; i <= project.num_floors; i++) options.push(`${i}`);
        return options;
    }, [selectedProjectId, projects]);

    const allAvailableFloors = useMemo(() => {
        // FIX: Explicitly cast floors to string[] to resolve 'unknown' type errors in sort callback (line 95)
        const floors = Array.from(new Set(apartments.map(a => a.floor).filter(Boolean))) as string[];
        return floors.sort((a, b) => {
            if (a === 'RDC') return -1;
            if (b === 'RDC') return 1;
            return parseInt(a) - parseInt(b);
        });
    }, [apartments]);

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if(!user) return;
        const formData = new FormData(e.currentTarget);
        const data: Partial<Apartment> = {
            project_id: selectedProjectId,
            name: manualName,
            type: propertyType,
            intended_for: intendedFor,
            floor: selectedFloor,
            surface_m2: Number(formData.get('surface_m2')),
            price_dh: Number(formData.get('price_dh')),
            sale_price_dh: Number(formData.get('sale_price_dh')) || undefined,
            owner_name: formData.get('owner_name') as string,
            description: formData.get('description') as string,
        };
        try {
            if (editingApartment) await updateApartment(editingApartment.id, data, user.user_id);
            else await addApartment(data as any, user.user_id);
            setNotification({ message: "Propriété enregistrée avec succès", type: 'success' });
            fetchData(); closeModal();
        } catch (error: any) { setNotification({ message: error.message, type: 'error' }); }
    };

    const openAddModal = () => {
        setEditingApartment(null); setSelectedProjectId(''); setSelectedFloor(''); setManualName(''); setPropertyType('apartment'); setIntendedFor('sale'); setIsModalOpen(true);
    };

    const openEditModal = (apt: Apartment) => {
        setEditingApartment(apt); setSelectedProjectId(apt.project_id); setSelectedFloor(apt.floor || ''); setManualName(apt.name); setPropertyType(apt.type); setIntendedFor(apt.intended_for || 'sale'); setIsModalOpen(true);
    };

    const closeModal = () => { setIsModalOpen(false); setEditingApartment(null); setManualName(''); setSelectedProjectId(''); setSelectedFloor(''); };

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-gray-900 sm:text-sm font-medium";

    const filteredApartments = useMemo(() => {
        return apartments.filter(a => {
            const projectMatch = filters.projectId === 'all' || a.project_id === filters.projectId;
            const statusMatch = filters.status === 'all' || a.status === filters.status;
            const floorMatch = filters.floor === 'all' || a.floor === filters.floor;
            const searchMatch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
            return projectMatch && statusMatch && floorMatch && searchMatch;
        });
    }, [apartments, filters, searchTerm]);

    if (loading) return <div className="p-6 text-center text-gray-500">Chargement du parc immobilier...</div>;

    return (
        <div>
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Parc Immobilier</h2>
                <button onClick={openAddModal} className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center shadow-lg font-bold transition-all">
                    <PlusIcon className="w-5 h-5 mr-2" /> Ajouter une Unité
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="relative md:col-span-2">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Rechercher une unité (ex: Apt 101)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClasses.replace("mt-1", "mt-0 pl-10")} />
                </div>
                <select value={filters.projectId} onChange={e => setFilters({...filters, projectId: e.target.value})} className={inputClasses.replace("mt-1", "mt-0")}><option value="all">Tous les projets</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
                <select value={filters.floor} onChange={e => setFilters({...filters, floor: e.target.value})} className={inputClasses.replace("mt-1", "mt-0")}><option value="all">Tous les étages</option>{allAvailableFloors.map(f => <option key={f} value={f}>{f === 'RDC' ? 'RDC' : `Étage ${f}`}</option>)}</select>
                <div className="flex space-x-2">
                    <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className={inputClasses.replace("mt-1", "mt-0 flex-1")}><option value="all">Tous statuts</option><option value={ApartmentStatus.Available}>Libre (Location)</option><option value={ApartmentStatus.ForSale}>À Vendre</option><option value={ApartmentStatus.Rented}>Loué</option><option value={ApartmentStatus.Sold}>Vendu</option></select>
                    <button onClick={() => {setSearchTerm(''); setFilters({status:'all', type:'all', projectId:'all', floor: 'all'})}} className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"><XCircleIcon className="w-5 h-5 text-gray-500" /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredApartments.map(apt => (
                    <ApartmentCard 
                        key={apt.id} 
                        apartment={apt} 
                        project={projects.find(p => p.id === apt.project_id)} 
                        onEdit={openEditModal} 
                        onDelete={(a) => { setApartmentToDelete(a); setIsConfirmModalOpen(true); }} 
                        onRent={() => navigate('/contrats')} 
                        onSell={() => navigate('/contrats')} 
                        onViewContractHolder={(a) => navigate(`/clients/${contracts.find(c => c.id === a.current_contract_id)?.client_id}`)} 
                    />
                ))}
            </div>
            
            {filteredApartments.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm mt-6">
                    <HomeIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Aucune propriété ne correspond à vos critères.</p>
                </div>
            )}

            <Modal title={editingApartment ? "Modifier la Propriété" : "Ajouter une Propriété"} isOpen={isModalOpen} onClose={closeModal}>
                <form onSubmit={handleFormSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Usage Prévu</label>
                            <div className="flex bg-gray-100 p-1 rounded-xl w-full">
                                <button type="button" onClick={() => setIntendedFor('sale')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${intendedFor === 'sale' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Vente (Défaut)</button>
                                <button type="button" onClick={() => setIntendedFor('rental')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${intendedFor === 'rental' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>Location</button>
                            </div>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700">Projet</label>
                            <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} required className={inputClasses}><option value="" disabled>Choisir un projet</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700">Étage</label>
                            <select value={selectedFloor} onChange={e => { setSelectedFloor(e.target.value); if (!editingApartment) setManualName(''); }} required className={inputClasses}><option value="" disabled>Choisir l'étage</option>{floorOptions.map(f => <option key={f} value={f}>{f === 'RDC' ? 'Rez-de-chaussée' : `Étage ${f}`}</option>)}</select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700">Référence / Nom de l'unité</label>
                            <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} required className={inputClasses} placeholder="ex: Appart 101" />
                        </div>
                        <div><label className="block text-sm font-bold text-gray-700">Surface (m²)</label><input type="number" name="surface_m2" defaultValue={editingApartment?.surface_m2} required className={inputClasses} /></div>
                        {intendedFor === 'sale' ? (
                            <div><label className="block text-sm font-bold text-gray-700">Prix de Vente (DH)</label><input type="number" name="sale_price_dh" defaultValue={editingApartment?.sale_price_dh} required className={inputClasses} /></div>
                        ) : (
                            <div><label className="block text-sm font-bold text-gray-700">Loyer Indicatif (DH)</label><input type="number" name="price_dh" defaultValue={editingApartment?.price_dh} required className={inputClasses} /></div>
                        )}
                        <div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700">Propriétaire / Société</label><input type="text" name="owner_name" defaultValue={editingApartment?.owner_name || 'Nafat Immobilier'} required className={inputClasses} /></div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-5 border-t border-gray-100">
                        <button type="button" onClick={closeModal} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-all">Annuler</button>
                        <button type="submit" className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">Enregistrer</button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={async () => { if(apartmentToDelete) { try { await deleteApartment(apartmentToDelete); fetchData(); setIsConfirmModalOpen(false); } catch(e:any) { alert(e.message); setIsConfirmModalOpen(false); } } }} title="Supprimer la propriété ?" message="Seules les unités sans historique de contrat peuvent être supprimées." />
        </div>
    );
};

export default ApartmentsPage;