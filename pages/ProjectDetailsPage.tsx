
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProjects, getApartments, addApartment, deleteApartment, updateApartment, getContracts, getClients, addContract } from '../services/api';
import { Project, Apartment, ApartmentStatus, Contract, Client, ContractStatus } from '../types';
import { PlusIcon, EditIcon, TrashIcon, HomeIcon, GarageIcon, GridIcon, ListIcon, BuildingIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ApartmentCard from '../components/ApartmentCard';
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

const ProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [propertyType, setPropertyType] = useState<'apartment' | 'garage'>('apartment');
  const [intendedFor, setIntendedFor] = useState<'sale' | 'rental'>('sale');
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const { user } = useAuth();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('projectDetailViewMode') as 'list' | 'grid') || 'grid'
  );

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectsData, apartmentsData, contractsData, clientsData] = await Promise.all([
          getProjects(), getApartments(), getContracts(), getClients()
      ]);
      setProject(projectsData.find(p => p.id === projectId) || null);
      setApartments(apartmentsData.filter(a => a.project_id === projectId));
      setContracts(contractsData); setClients(clientsData);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  const suggestedName = useMemo(() => {
    if (!projectId || !selectedFloor) return manualName;
    const countInFloor = apartments.filter(a => a.floor === selectedFloor).length;
    const floorPrefix = selectedFloor === 'RDC' ? '0' : selectedFloor;
    return `Appart ${floorPrefix}0${countInFloor + 1}`;
  }, [projectId, selectedFloor, apartments, manualName]);

  useEffect(() => {
      if (!editingApartment && suggestedName && manualName === '') {
          setManualName(suggestedName);
      }
  }, [suggestedName, editingApartment, manualName]);

  const floorOptions = useMemo(() => {
    if (!project) return [];
    const options: string[] = [];
    if (project.has_rdc) options.push('RDC');
    for (let i = 1; i <= (project.num_floors || 0); i++) options.push(`${i}`);
    return options;
  }, [project]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if(!user || !projectId) return;
      const formData = new FormData(e.currentTarget);
      const data: Partial<Apartment> = {
          project_id: projectId, name: manualName, type: propertyType, intended_for: intendedFor, floor: selectedFloor,
          surface_m2: Number(formData.get('surface_m2')),
          price_dh: Number(formData.get('price_dh')) || 0,
          sale_price_dh: Number(formData.get('sale_price_dh')) || undefined,
          owner_name: formData.get('owner_name') as string,
          description: formData.get('description') as string,
      };
      try {
          if (editingApartment) await updateApartment(editingApartment.id, data, user.user_id);
          else await addApartment(data as any, user.user_id);
          setNotification({ message: "Succès", type: 'success' });
          fetchData(); closeModal();
      } catch(error: any) { setNotification({ message: "Erreur", type: 'error' }); }
  }

  const openAddModal = () => { setEditingApartment(null); setPropertyType('apartment'); setIntendedFor('sale'); setSelectedFloor(''); setManualName(''); setIsModalOpen(true); }
  const openEditModal = (apt: Apartment) => { setEditingApartment(apt); setPropertyType(apt.type); setIntendedFor(apt.intended_for || 'sale'); setSelectedFloor(apt.floor || ''); setManualName(apt.name); setIsModalOpen(true); }
  const closeModal = () => { setIsModalOpen(false); setEditingApartment(null); setManualName(''); setSelectedFloor(''); }

  const groupedByFloor = useMemo(() => {
    const groups: Record<string, Apartment[]> = {};
    apartments.forEach(apt => {
        const key = apt.floor || 'N/A';
        if (!groups[key]) groups[key] = [];
        groups[key].push(apt);
    });
    return Object.entries(groups).sort(([a], [b]) => {
        if (a === 'RDC') return -1;
        if (b === 'RDC') return 1;
        return parseInt(a) - parseInt(b);
    });
  }, [apartments]);

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-gray-900 sm:text-sm font-bold";

  if (loading) return <div className="p-12 text-center text-gray-500">Chargement...</div>;
  if (!project) return <div className="p-8 text-center bg-white rounded-xl shadow-sm border">Projet non trouvé.</div>;

  return (
    <div>
        {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
        <div className="mb-6">
            <Link to="/projets" className="text-sm font-bold text-green-600 hover:underline mb-2 block">&larr; Retour</Link>
            <div className="flex justify-between items-start">
                <div><h2 className="text-3xl font-bold text-gray-800">{project.project_name}</h2><p className="text-gray-600 mt-1">{project.location}</p></div>
                <div className="flex bg-gray-200 rounded-lg p-1">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><ListIcon className="w-5 h-5"/></button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}><GridIcon className="w-5 h-5"/></button>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Détails</h3><p className="text-gray-600 leading-relaxed">{project.description}</p></div>
            <button onClick={openAddModal} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold shadow-lg flex items-center"><PlusIcon className="w-5 h-5 mr-2" /> Ajouter Propriété</button>
        </div>

        {groupedByFloor.map(([floor, floorApts]) => (
            <div key={floor} className="mb-8">
                <div className="flex items-center space-x-3 bg-gray-100/50 px-4 py-3 rounded-lg border border-gray-200 mb-4">
                    <BuildingIcon className="w-5 h-5 text-gray-500" />
                    <h4 className="text-lg font-bold text-gray-700">{floor === 'RDC' ? 'Rez-de-chaussée' : `Étage ${floor}`}</h4>
                </div>
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {floorApts.map(apt => <ApartmentCard key={apt.id} apartment={apt} project={project} onEdit={openEditModal} onDelete={(a) => { setApartmentToDelete(a); setIsConfirmModalOpen(true); }} onRent={() => navigate('/contrats')} onSell={() => navigate('/contrats')} onViewContractHolder={(a) => navigate(`/clients/${contracts.find(c => c.id === a.current_contract_id)?.client_id}`)} />)}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr><th className="px-6 py-3 text-left font-bold text-xs uppercase text-gray-500">Nom</th><th className="px-6 py-3 text-left font-bold text-xs uppercase text-gray-500">Usage</th><th className="px-6 py-3 text-left font-bold text-xs uppercase text-gray-500">Statut</th><th className="px-6 py-3 text-center font-bold text-xs uppercase text-gray-500">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {floorApts.map(apt => (
                                    <tr key={apt.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-900">{apt.name}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-500 uppercase">{apt.intended_for === 'sale' ? 'Vente' : 'Loc'}</td>
                                        <td className="px-6 py-4"><span className={getStatusBadge(apt.status)}>{translateStatus(apt.status)}</span></td>
                                        <td className="px-6 py-4 flex justify-center space-x-3">
                                            <EditIcon className="w-5 h-5 text-gray-400 cursor-pointer hover:text-green-600" onClick={() => openEditModal(apt)} />
                                            <TrashIcon className="w-5 h-5 text-gray-400 cursor-pointer hover:text-red-600" onClick={() => { setApartmentToDelete(apt); setIsConfirmModalOpen(true); }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        ))}

        <Modal title={editingApartment ? "Modifier Propriété" : "Ajouter Propriété"} isOpen={isModalOpen} onClose={closeModal}>
            <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700">Usage Prévu</label>
                        <div className="flex space-x-4 mt-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" value="sale" checked={intendedFor === 'sale'} onChange={() => setIntendedFor('sale')} className="text-green-600 focus:ring-green-500" />
                                <span className="text-sm font-medium">Vente (Par défaut)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="radio" value="rental" checked={intendedFor === 'rental'} onChange={() => setIntendedFor('rental')} className="text-green-600 focus:ring-green-500" />
                                <span className="text-sm font-medium">Location</span>
                            </label>
                        </div>
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700">Étage</label>
                        <select value={selectedFloor} onChange={e => { setSelectedFloor(e.target.value); if(!editingApartment) setManualName(''); }} required className={inputClasses}><option value="" disabled>Choisir</option>{floorOptions.map(f => <option key={f} value={f}>{f === 'RDC' ? 'RDC' : `Étage ${f}`}</option>)}</select>
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700">Nom / N°</label>
                        <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} required className={inputClasses} placeholder="ex: Appart 101" />
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700">Surface (m²)</label><input type="number" name="surface_m2" defaultValue={editingApartment?.surface_m2} required className={inputClasses} /></div>
                    {intendedFor === 'sale' ? (
                        <div><label className="block text-sm font-bold text-gray-700">Prix de Vente (DH)</label><input type="number" name="sale_price_dh" defaultValue={editingApartment?.sale_price_dh} required className={inputClasses} /></div>
                    ) : (
                        <div><label className="block text-sm font-bold text-gray-700">Loyer Indicatif (DH)</label><input type="number" name="price_dh" defaultValue={editingApartment?.price_dh} required className={inputClasses} /></div>
                    )}
                </div>
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold">Annuler</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold shadow-lg">Confirmer</button>
                </div>
            </form>
        </Modal>

        <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={async () => { if(apartmentToDelete) { try { await deleteApartment(apartmentToDelete); fetchData(); setIsConfirmModalOpen(false); } catch(e:any) { alert(e.message); setIsConfirmModalOpen(false); } } }} title="Supprimer ?" message="Seules les unités sans historique peuvent être supprimées." />
    </div>
  );
};

export default ProjectDetailsPage;
