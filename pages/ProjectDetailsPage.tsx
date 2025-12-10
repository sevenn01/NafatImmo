
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProjects, getApartments, addApartment, deleteApartment, updateApartment, getContracts, getClients, addContract } from '../services/api';
import { Project, Apartment, ApartmentStatus, Contract, Client, ContractStatus } from '../types';
import { PlusIcon, EditIcon, TrashIcon, HomeIcon, GarageIcon, GridIcon, ListIcon, LockIcon, UnlockIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ApartmentCard from '../components/ApartmentCard';
import Notification from '../components/Notification';

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

const getStatusBadge = (status: ApartmentStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case ApartmentStatus.Available: return `${baseClasses} bg-green-100 text-green-800`;
    case ApartmentStatus.Rented: return `${baseClasses} bg-blue-100 text-blue-800`;
    case ApartmentStatus.Maintenance: return `${baseClasses} bg-yellow-100 text-yellow-800`;
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
  const { user } = useAuth();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('projectDetailViewMode') as 'list' | 'grid') || 'list'
  );
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedApartmentForContract, setSelectedApartmentForContract] = useState<Apartment | null>(null);
  const [contractType, setContractType] = useState<'rental' | 'sale'>('rental');

  // Manual lock state persistence (Shared with ApartmentsPage logic concept)
  const [manualLockStates, setManualLockStates] = useState<Record<string, boolean>>(() => {
      const saved = localStorage.getItem('apartmentLockStates');
      return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
      localStorage.setItem('apartmentLockStates', JSON.stringify(manualLockStates));
  }, [manualLockStates]);


  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectsData, apartmentsData, contractsData, clientsData] = await Promise.all([
          getProjects(),
          getApartments(),
          getContracts(),
          getClients()
      ]);
      
      const currentProject = projectsData.find(p => p.id === projectId) || null;
      const projectApartments = apartmentsData.filter(a => a.project_id === projectId);

      setProject(currentProject);
      setApartments(projectApartments);
      setContracts(contractsData);
      setClients(clientsData);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    localStorage.setItem('projectDetailViewMode', viewMode);
  }, [viewMode]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if(!user || !projectId) return;

      const formData = new FormData(e.currentTarget);
      const propertyData: Partial<Apartment> = {
          project_id: projectId,
          name: formData.get('name') as string,
          type: propertyType,
          surface_m2: Number(formData.get('surface_m2')),
          price_dh: Number(formData.get('price_dh')),
          sale_price_dh: Number(formData.get('sale_price_dh')) || undefined,
          owner_name: formData.get('owner_name') as string,
          description: formData.get('description') as string,
      };

      if (propertyType === 'apartment') {
          propertyData.floor = formData.get('floor') as string;
          propertyData.rooms = Number(formData.get('rooms'));
          propertyData.balcony = (formData.get('balcony') as string) === 'on';
          propertyData.bathroom = Number(formData.get('bathroom'));
          propertyData.kitchen = (formData.get('kitchen') as string) === 'on';
      }
      
      try {
          if (editingApartment) {
              await updateApartment(editingApartment.id, propertyData, user.user_id);
              setNotification({ message: "Propriété mise à jour avec succès", type: 'success' });
          } else {
              await addApartment(propertyData as Omit<Apartment, 'id' | 'apartment_id' | 'created_at' | 'updated_at' | 'status'>, user.user_id);
              setNotification({ message: "Propriété ajoutée avec succès", type: 'success' });
          }
          fetchData();
          closeModal();
      } catch(error: any) {
          console.error("Failed to save property:", error);
          setNotification({ message: "Erreur lors de la sauvegarde de la propriété.", type: 'error' });
      }
  }

  const handleContractFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedApartmentForContract) return;

    const formData = new FormData(e.currentTarget);
    const contractData: Partial<Contract> = {
        client_id: formData.get('client_id') as string,
        apartment_id: selectedApartmentForContract.id,
        project_id: selectedApartmentForContract.project_id,
        type: contractType,
        notes: formData.get('notes') as string,
    };

    if (!contractData.client_id) {
        alert("Veuillez sélectionner un client.");
        return;
    }

    if (contractType === 'rental') {
        const startDate = new Date(formData.get('start_date') as string);
        const duration = Number(formData.get('duration_months') as string);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + duration);
        
        contractData.amount_dh = Number(formData.get('amount_dh') as string);
        contractData.duration_months = duration;
        contractData.start_date = startDate.toISOString().split('T')[0];
        contractData.end_date = endDate.toISOString().split('T')[0];
        contractData.months_left = duration; 
        contractData.status = ContractStatus.Active;
    } else { // Sale
        contractData.amount_dh = Number(formData.get('amount_dh') as string);
        contractData.start_date = formData.get('start_date') as string;
        contractData.status = ContractStatus.SaleCompleted;
    }

    try {
        await addContract(contractData as Omit<Contract, 'id' | 'contract_id' | 'created_at' | 'updated_at'>, user.user_id);
        fetchData();
        closeContractModal();
        setNotification({ message: "Contrat créé avec succès", type: 'success' });
    } catch(error: any) {
        console.error("Failed to add contract", error);
        setNotification({ message: "Erreur lors de l'ajout du contrat.", type: 'error' });
    }
  }

  const handleDelete = (apartment: Apartment) => {
    setApartmentToDelete(apartment);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!apartmentToDelete) return;
    try {
        await deleteApartment(apartmentToDelete);
        setNotification({ message: "Propriété supprimée avec succès.", type: 'success' });
        fetchData();
    } catch (error: any) {
        setNotification({ message: error.message, type: 'error' });
    } finally {
        setIsConfirmModalOpen(false);
        setApartmentToDelete(null);
    }
  };

  const handleViewContractHolder = (apartment: Apartment) => {
    const contract = contracts.find(c => c.id === apartment.current_contract_id);
    if (contract) {
        navigate(`/clients/${contract.client_id}`);
    } else {
        setNotification({ message: "Impossible de trouver les informations du locataire/propriétaire.", type: 'error' });
    }
  };
  
  const openContractModal = (apartment: Apartment, type: 'rental' | 'sale') => {
    setContractType(type);
    setSelectedApartmentForContract(apartment);
    setIsContractModalOpen(true);
  };

  const openAddModal = () => {
    setEditingApartment(null);
    setPropertyType('apartment');
    setIsModalOpen(true);
  }

  const openEditModal = (apartment: Apartment) => {
      setEditingApartment(apartment);
      setPropertyType(apartment.type);
      setIsModalOpen(true);
  }
  
  const closeModal = () => {
      setIsModalOpen(false);
      setEditingApartment(null);
  }

  const closeContractModal = () => {
    setIsContractModalOpen(false);
    setSelectedApartmentForContract(null);
  }

   // Toggle Lock status
   const toggleLock = (apartment: Apartment) => {
    const isRentedOrSold = apartment.status === ApartmentStatus.Rented || apartment.status === ApartmentStatus.Sold;
    const defaultState = isRentedOrSold;
    
    setManualLockStates(prev => {
        const currentManual = prev[apartment.id];
        const currentState = currentManual !== undefined ? currentManual : defaultState;
        return { ...prev, [apartment.id]: !currentState };
    });
  };

  if (loading) return <div>Chargement des détails du projet...</div>;
  if (!project) return <div>Projet non trouvé.</div>;

  return (
    <div>
        {notification && (
            <Notification 
                message={notification.message} 
                type={notification.type} 
                onClose={() => setNotification(null)} 
            />
        )}
        <div className="mb-6">
            <Link to="/projets" className="text-sm text-green-600 hover:underline mb-2 block">&larr; Retour aux projets</Link>
            <h2 className="text-3xl font-bold text-gray-800">{project.project_name}</h2>
            <p className="text-gray-600">{project.location}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
            <p className="text-gray-600">{project.description}</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
            <h3 className="text-2xl font-bold text-gray-800">Propriétés ({apartments.length})</h3>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="flex items-center bg-gray-200 rounded-lg p-1">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-600'}`} aria-label="List view">
                        <ListIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-600'}`} aria-label="Grid view">
                        <GridIcon className="w-5 h-5" />
                    </button>
                </div>
                <button onClick={openAddModal} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Ajouter
                </button>
            </div>
        </div>

        {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Locataire/Acheteur</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loyer/Prix (DH)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {apartments.map(apt => {
                                let contractHolderName = 'N/A';
                                let contractHolderId = null;
                                if(apt.status === ApartmentStatus.Rented || apt.status === ApartmentStatus.Sold) {
                                    const contract = contracts.find(c => c.id === apt.current_contract_id);
                                    if(contract) {
                                        const client = clients.find(cl => cl.id === contract.client_id);
                                        if(client) {
                                            contractHolderName = client.full_name;
                                            contractHolderId = client.id;
                                        }
                                    }
                                }

                                const isRentedOrSold = apt.status === ApartmentStatus.Rented || apt.status === ApartmentStatus.Sold;
                                const defaultLocked = isRentedOrSold;
                                const isLocked = manualLockStates[apt.id] !== undefined ? manualLockStates[apt.id] : defaultLocked;

                                // Update price text logic to include 'sold' status
                                const priceText = (apt.status === ApartmentStatus.Sold || apt.status === ApartmentStatus.ForSale) && apt.sale_price_dh 
                                    ? `${apt.sale_price_dh.toLocaleString()} (Vente)` 
                                    : `${apt.price_dh.toLocaleString()}`;

                                return (
                                    <tr key={apt.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{apt.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center">{apt.type === 'apartment' ? <HomeIcon className="w-5 h-5 text-gray-400 mr-2" /> : <GarageIcon className="w-5 h-5 text-gray-400 mr-2" />} {apt.type === 'apartment' ? 'Appartement' : 'Garage'}</div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {contractHolderId ? <Link to={`/clients/${contractHolderId}`} className="hover:text-green-600 hover:underline">{contractHolderName}</Link> : contractHolderName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{priceText}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={getStatusBadge(apt.status)}>{translateStatus(apt.status)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-1">
                                                {isLocked ? (
                                                    <button type="button" onClick={() => toggleLock(apt)} title="Cliquer pour déverrouiller" className="p-1 hover:bg-gray-100 rounded">
                                                        <LockIcon className="w-5 h-5 text-gray-400 cursor-pointer hover:text-green-600" />
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => openEditModal(apt)} className="p-1 hover:bg-gray-100 rounded" title="Modifier">
                                                            <EditIcon className="w-5 h-5 text-gray-500 hover:text-green-600 cursor-pointer" />
                                                        </button>
                                                        <button type="button" onClick={() => handleDelete(apt)} className="p-1 hover:bg-gray-100 rounded" title="Supprimer">
                                                            <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600 cursor-pointer" />
                                                        </button>
                                                        <button type="button" onClick={() => toggleLock(apt)} className="p-1 hover:bg-gray-100 rounded" title="Verrouiller">
                                                            <UnlockIcon className="w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {apartments.map((apt) => {
                     const isRentedOrSold = apt.status === ApartmentStatus.Rented || apt.status === ApartmentStatus.Sold;
                     const defaultLocked = isRentedOrSold;
                     const isLocked = manualLockStates[apt.id] !== undefined ? manualLockStates[apt.id] : defaultLocked;
                    return (
                        <ApartmentCard 
                            key={apt.id} 
                            apartment={apt} 
                            project={project}
                            isLocked={isLocked}
                            onToggleLock={() => toggleLock(apt)}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                            onRent={() => openContractModal(apt, 'rental')}
                            onSell={() => openContractModal(apt, 'sale')}
                            onViewContractHolder={handleViewContractHolder}
                        />
                    )
                })}
            </div>
        )}

        <Modal title={editingApartment ? `Modifier la Propriété` : `Ajouter une Propriété à ${project.project_name}`} isOpen={isModalOpen} onClose={closeModal}>
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Type de Propriété</label><div className="mt-2 flex rounded-md shadow-sm"><button type="button" onClick={() => setPropertyType('apartment')} className={`px-4 py-2 border text-sm font-medium ${propertyType === 'apartment' ? 'bg-green-600 text-white border-green-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} rounded-l-md focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500`}>Appartement</button><button type="button" onClick={() => setPropertyType('garage')} className={`-ml-px px-4 py-2 border text-sm font-medium ${propertyType === 'garage' ? 'bg-green-600 text-white border-green-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} rounded-r-md focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500`}>Garage</button></div></div>
                <div className="md:col-span-2"><label htmlFor="name" className="block text-sm font-medium text-gray-700">Nom / N°</label><input type="text" name="name" id="name" required defaultValue={editingApartment?.name || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                {propertyType === 'apartment' && (<>
                    <div><label htmlFor="floor" className="block text-sm font-medium text-gray-700">Étage</label><input type="text" name="floor" id="floor" required defaultValue={editingApartment?.floor || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    <div><label htmlFor="rooms" className="block text-sm font-medium text-gray-700">Pièces</label><input type="number" name="rooms" id="rooms" required defaultValue={editingApartment?.rooms || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    <div><label htmlFor="bathroom" className="block text-sm font-medium text-gray-700">Salles de bain</label><input type="number" name="bathroom" id="bathroom" required defaultValue={editingApartment?.bathroom || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    <div className="flex items-end space-x-4 pb-1"><div className="flex items-center"><input id="balcony" name="balcony" type="checkbox" defaultChecked={editingApartment?.balcony || false} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" /><label htmlFor="balcony" className="ml-2 block text-sm text-gray-900">Balcon</label></div><div className="flex items-center"><input id="kitchen" name="kitchen" type="checkbox" defaultChecked={editingApartment?.kitchen || false} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" /><label htmlFor="kitchen" className="ml-2 block text-sm text-gray-900">Cuisine</label></div></div>
                </>)}
                <div><label htmlFor="surface_m2" className="block text-sm font-medium text-gray-700">Surface (m²)</label><input type="number" name="surface_m2" id="surface_m2" required defaultValue={editingApartment?.surface_m2 || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                <div><label htmlFor="price_dh" className="block text-sm font-medium text-gray-700">Loyer Mensuel (DH)</label><input type="number" name="price_dh" id="price_dh" required defaultValue={editingApartment?.price_dh || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                <div><label htmlFor="sale_price_dh" className="block text-sm font-medium text-gray-700">Prix de Vente (DH)</label><input type="number" name="sale_price_dh" id="sale_price_dh" defaultValue={editingApartment?.sale_price_dh || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                <div className="md:col-span-2"><label htmlFor="owner_name" className="block text-sm font-medium text-gray-700">Propriétaire</label><input type="text" name="owner_name" id="owner_name" required defaultValue={editingApartment?.owner_name || 'Nafat Immobilier'} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                <div className="md:col-span-2"><label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label><textarea name="description" id="description" rows={3} defaultValue={editingApartment?.description || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"></textarea></div>
              </div>
              <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Sauvegarder</button></div>
            </form>
        </Modal>

        <Modal title={`Créer un contrat de ${contractType === 'rental' ? 'Location' : 'Vente'} pour: ${selectedApartmentForContract?.name}`} isOpen={isContractModalOpen} onClose={closeContractModal}>
            <form onSubmit={handleContractFormSubmit} className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-800">Propriété: {selectedApartmentForContract?.name}</p>
                    <p className="text-sm text-gray-600">Projet: {project?.project_name}</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">{contractType === 'rental' ? 'Loyer' : 'Prix de Vente'}: {contractType === 'rental' ? selectedApartmentForContract?.price_dh.toLocaleString() : selectedApartmentForContract?.sale_price_dh?.toLocaleString()} DH</p>
                </div>
                <div>
                    <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">{contractType === 'rental' ? 'Locataire' : 'Acheteur'}</label>
                    <select name="client_id" id="client_id" required defaultValue="" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                        <option value="" disabled>Sélectionner un client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                </div>
                 {contractType === 'rental' ? (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Loyer Mensuel (DH)</label><input type="number" name="amount_dh" id="amount_dh" required defaultValue={selectedApartmentForContract?.price_dh} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                            <div><label htmlFor="duration_months" className="block text-sm font-medium text-gray-700">Durée (mois)</label><input type="number" name="duration_months" id="duration_months" required defaultValue="12" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                        </div>
                        <div><label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Date de début</label><input type="date" name="start_date" id="start_date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    </>
                ) : (
                    <>
                        <div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Prix de Vente Final (DH)</label><input type="number" name="amount_dh" id="amount_dh" required defaultValue={selectedApartmentForContract?.sale_price_dh} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                        <div><label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Date de Vente</label><input type="date" name="start_date" id="start_date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    </>
                )}
                <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" id="notes" rows={3} placeholder="ex: 2 mois de caution payés..." className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"></textarea></div>
                <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={closeContractModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Créer le Contrat</button></div>
            </form>
        </Modal>

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={confirmDelete}
            title="Confirmer la suppression"
            message={`Êtes-vous sûr de vouloir supprimer la propriété "${apartmentToDelete?.name}" ? Cette action est irréversible.`}
        />
    </div>
  );
};

export default ProjectDetailsPage;
