
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getContracts, getClients, getApartments, addContract, updateContract, cancelContract, getProjects, renewContract, getPayments, endContract, deleteContract } from '../services/api';
import { Contract, Client, Apartment, ContractStatus, ApartmentStatus, Project, Payment, PaymentStatus, PaymentMethod } from '../types';
import { PlusIcon, EyeIcon, EditIcon, TrashIcon, SearchIcon, XCircleIcon, RefreshCwIcon, FileTextIcon, HomeIcon, PrinterIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptPage from './ReceiptPage';
import ReservationFormPage from './ReservationFormPage';

const translateApartmentStatus = (status: ApartmentStatus) => {
    switch (status) {
        case ApartmentStatus.Available: return 'Disponible';
        case ApartmentStatus.Rented: return 'Loué';
        case ApartmentStatus.Maintenance: return 'En Maintenance';
        case ApartmentStatus.ForSale: return 'À Vendre';
        case ApartmentStatus.Sold: return 'Vendu';
        default: return status;
    }
};

const translateStatus = (status: ContractStatus) => {
    switch (status) {
        case ContractStatus.Active: return 'Actif';
        case ContractStatus.Ended: return 'Terminé';
        case ContractStatus.Pending: return 'En attente';
        case ContractStatus.Canceled: return 'Annulé';
        case ContractStatus.Renewed: return 'Renouvelé';
        case ContractStatus.SaleInProgress: return 'Vente en cours';
        case ContractStatus.SaleCompleted: return 'Vente Terminée';
        case ContractStatus.SaleCanceled: return 'Vente Annulée';
        default: return status;
    }
}

const getStatusBadge = (status: ContractStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case ContractStatus.Active: return `${baseClasses} bg-green-100 text-green-800`;
    case ContractStatus.Ended: return `${baseClasses} bg-gray-200 text-gray-800`;
    case ContractStatus.Canceled: return `${baseClasses} bg-red-100 text-red-800`;
    case ContractStatus.Pending: return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case ContractStatus.Renewed: return `${baseClasses} bg-blue-100 text-blue-800`;
    case ContractStatus.SaleCompleted: return `${baseClasses} bg-indigo-100 text-indigo-800`;
    case ContractStatus.SaleCanceled: return `${baseClasses} bg-red-100 text-red-800`;
    case ContractStatus.SaleInProgress: return `${baseClasses} bg-yellow-100 text-yellow-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const ContractsPage: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);
    const { user } = useAuth();
    
    const [isTypeSelectionModalOpen, setIsTypeSelectionModalOpen] = useState(false);
    const [newContractType, setNewContractType] = useState<'rental' | 'sale'>('rental');
    
    // State for new sale contract form
    const [recordInitialPayment, setRecordInitialPayment] = useState(false);
    const [initialPaymentMethod, setInitialPaymentMethod] = useState<PaymentMethod>('especes');
    const [selectedApartmentId, setSelectedApartmentId] = useState('');
    const [salePrice, setSalePrice] = useState(0);
    const [amountPaid, setAmountPaid] = useState(0);

    const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
    const [reservationContractId, setReservationContractId] = useState<string | null>(null);


    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [contractToRenew, setContractToRenew] = useState<Contract | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [contractToCancel, setContractToCancel] = useState<Contract | null>(null);
    const [isEndModalOpen, setIsEndModalOpen] = useState(false);
    const [contractToEnd, setContractToEnd] = useState<Contract | null>(null);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    // Default status is now 'Active' to hide terminated contracts by default
    const [filters, setFilters] = useState({ status: ContractStatus.Active, projectId: 'all' });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [contractsData, clientsData, apartmentsData, projectsData, paymentsData] = await Promise.all([ getContracts(), getClients(), getApartments(), getProjects(), getPayments() ]);
            setContracts(contractsData);
            setClients(clientsData);
            setApartments(apartmentsData);
            setProjects(projectsData);
            setPayments(paymentsData);
        } catch (error) { console.error("Failed to fetch data:", error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const resetFilters = () => {
        setSearchTerm('');
        // Clean filters completely to show all
        setFilters({ status: 'all', projectId: 'all' });
    };

    const filteredContracts = useMemo(() => {
        return contracts.filter(contract => {
            const client = clients.find(c => c.id === contract.client_id);
            const apartment = apartments.find(a => a.id === contract.apartment_id);

            // FIX: Add safety checks for undefined client/apartment names
            const clientNameMatch = client ? (client.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) : false;
            const apartmentNameMatch = apartment ? (apartment.name || '').toLowerCase().includes(searchTerm.toLowerCase()) : false;
            const searchMatch = !searchTerm || clientNameMatch || apartmentNameMatch;

            // Handle "all" case separately, otherwise match specific status
            const statusMatch = filters.status === 'all' || contract.status === filters.status;
            const projectMatch = filters.projectId === 'all' || contract.project_id === filters.projectId;
            
            return searchMatch && statusMatch && projectMatch;
        });
    }, [contracts, clients, apartments, searchTerm, filters]);

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        const formData = new FormData(e.currentTarget);
        if (editingContract) {
            const startDateString = formData.get('start_date') as string;
            const duration = Number(formData.get('duration_months') as string);
            
            const startDate = new Date(startDateString + 'T00:00:00Z');
            const endDate = new Date(startDate.getTime());
            endDate.setUTCMonth(endDate.getUTCMonth() + duration);
    
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            let monthsLeft = 0;
            if (endDate > today) {
                let diffYear = endDate.getUTCFullYear() - today.getUTCFullYear();
                let diffMonth = endDate.getUTCMonth() - today.getUTCMonth();
                monthsLeft = diffYear * 12 + diffMonth;
                if (endDate.getUTCDate() < today.getUTCDate()) {
                    monthsLeft--;
                }
            }
            
            const contractData: Partial<Contract> = {
                amount_dh: Number(formData.get('amount_dh') as string),
                duration_months: duration,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                months_left: Math.max(0, monthsLeft),
                notes: formData.get('notes') as string,
            };

            if (endDate < today) {
                contractData.status = ContractStatus.Ended;
            } else {
                contractData.status = ContractStatus.Active;
            }
            
            try {
                await updateContract(editingContract.id, contractData, user.user_id);
                fetchData();
                closeModal();
            } catch (error) {
                console.error("Failed to update contract:", error);
                alert("Erreur lors de la mise à jour du contrat.");
            }
        } else {
            const apartmentId = formData.get('apartment_id') as string;
            const selectedApartment = apartments.find(a => a.id === apartmentId);
            if (!selectedApartment) { alert("Appartement sélectionné invalide."); return; }
            
            let initialPaymentData: Omit<Payment, 'id' | 'payment_id' | 'created_at' | 'updated_at' | 'contract_id' | 'client_id'> | undefined;
            
            const contractData: Partial<Contract> = {
                client_id: formData.get('client_id') as string,
                apartment_id: apartmentId,
                project_id: selectedApartment.project_id,
                type: newContractType,
                notes: formData.get('notes') as string,
            };

            if (newContractType === 'rental') {
                const startDate = new Date(formData.get('start_date') as string + 'T00:00:00Z');
                const duration = Number(formData.get('duration_months') as string);
                const endDate = new Date(startDate.getTime());
                endDate.setUTCMonth(endDate.getUTCMonth() + duration);
                
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

                if (recordInitialPayment) {
                    const paidAmount = Number(formData.get('initial_amount_paid') as string);
                    if (paidAmount > 0) {
                        initialPaymentData = {
                            amount_dh: paidAmount,
                            payment_date: formData.get('initial_payment_date') as string,
                            payment_for: formData.get('initial_payment_description') as string || `Acompte vente ${selectedApartment.name}`,
                            status: PaymentStatus.Paid,
                            payment_method: initialPaymentMethod,
                            cheque_number: formData.get('cheque_number') as string | undefined,
                            bank_name: formData.get('bank_name') as string | undefined,
                            transfer_series: formData.get('transfer_series') as string | undefined,
                            effect_number: formData.get('effect_number') as string | undefined,
                        }
                    }
                }
            }

            try {
                await addContract(
                    contractData as Omit<Contract, 'id' | 'contract_id' | 'created_at' | 'updated_at'>, 
                    user.user_id,
                    initialPaymentData
                );
                fetchData();
                closeModal();
            } catch(error) {
                console.error("Failed to add contract", error);
                alert("Erreur lors de l'ajout du contract.");
            }
        }
    }

    const handleRenewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user || !contractToRenew) return;

        const formData = new FormData(e.currentTarget);
        const startDate = new Date(formData.get('start_date') as string);
        const duration = Number(formData.get('duration_months') as string);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + duration);

        const newContractData = {
            client_id: contractToRenew.client_id,
            apartment_id: contractToRenew.apartment_id,
            project_id: contractToRenew.project_id,
            amount_dh: Number(formData.get('amount_dh') as string),
            type: 'rental' as const,
            duration_months: duration,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            months_left: duration,
            status: ContractStatus.Active,
            notes: formData.get('notes') as string,
        };

        try {
            await renewContract(contractToRenew, newContractData, user.user_id);
            fetchData();
            closeRenewModal();
        } catch (error) {
            console.error("Failed to renew contract:", error);
            alert("Erreur lors du renouvellement du contrat.");
        }
    };

    const confirmCancelContract = async () => {
        if (!contractToCancel || !user) return;
        try {
            await cancelContract(contractToCancel, user.user_id);
            fetchData();
        } catch (error) {
            console.error("Failed to cancel contract:", error);
            alert("Erreur lors de l'annulation du contrat.");
        } finally {
            setIsConfirmModalOpen(false);
            setContractToCancel(null);
        }
    }

    const confirmEndContract = async () => {
        if (!contractToEnd || !user) return;
        try {
            await endContract(contractToEnd, user.user_id);
            fetchData();
        } catch (error) {
            console.error("Failed to end contract:", error);
            alert("Erreur lors de la clôture du contrat.");
        } finally {
            setIsEndModalOpen(false);
            setContractToEnd(null);
        }
    }
    
    const confirmDeleteContract = async () => {
        if (!contractToDelete) return;
        try {
            await deleteContract(contractToDelete.id);
            fetchData();
        } catch (error: any) {
            console.error("Failed to delete contract:", error);
            alert(`Erreur lors de la suppression: ${error.message}`);
        } finally {
            setIsDeleteModalOpen(false);
            setContractToDelete(null);
        }
    };

    const handleTypeSelection = (type: 'rental' | 'sale') => {
        setNewContractType(type);
        setIsTypeSelectionModalOpen(false);
        openAddModal();
    };
    
    const openAddModal = () => { setEditingContract(null); setRecordInitialPayment(false); setAmountPaid(0); setSelectedApartmentId(''); setSalePrice(0); setIsModalOpen(true); }
    const openEditModal = (contract: Contract) => { setEditingContract(contract); setIsModalOpen(true); }
    const openRenewModal = (contract: Contract) => { setContractToRenew(contract); setIsModalOpen(false); setIsRenewModalOpen(true); }
    const openCancelModal = (contract: Contract) => { setContractToCancel(contract); setIsConfirmModalOpen(true); }
    const openEndModal = (contract: Contract) => { setContractToEnd(contract); setIsEndModalOpen(true); }
    const openDeleteModal = (contract: Contract) => { setContractToDelete(contract); setIsDeleteModalOpen(true); }
    
    const closeModal = () => { setIsModalOpen(false); setEditingContract(null); }
    const closeRenewModal = () => { setIsRenewModalOpen(false); setContractToRenew(null); }

    const availableProperties = useMemo(() => {
        return apartments.filter(a => 
            a.status !== ApartmentStatus.Rented && a.status !== ApartmentStatus.Sold
        );
    }, [apartments]);
    
    useEffect(() => {
        const apt = apartments.find(a => a.id === selectedApartmentId);
        if (apt && apt.sale_price_dh) {
            setSalePrice(apt.sale_price_dh);
        } else {
            setSalePrice(0);
        }
    }, [selectedApartmentId, apartments]);

    const renderDurationText = (contract: Contract) => {
        if (contract.type === 'sale') return 'Vente';
        if (contract.status === ContractStatus.Active) {
            const today = new Date();
            const endDate = new Date(contract.end_date!);
            if (endDate < today) return `Expiré`;
            
            const endYear = endDate.getFullYear();
            const endMonth = endDate.getMonth();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth();

            let monthsLeft = (endYear - todayYear) * 12 + (endMonth - todayMonth);
            
            if (endDate.getDate() > today.getDate() && endYear === todayYear && endMonth === todayMonth) {
                return `Moins d'un mois`;
            }

            if (monthsLeft <= 0) return `Expire ce mois-ci`;

            return `${monthsLeft} mois restants`;
        }
        return `${contract.duration_months} mois`;
    }

    const FilterButton = ({ label, value }: { label: string, value: string }) => {
        const isActive = filters.status === value;
        return (
            <button
                onClick={() => handleFilterChange('status', value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
            >
                {label}
            </button>
        );
    };


    if (loading) return <div>Chargement des contrats...</div>;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Contrats</h2>
            <button onClick={() => setIsTypeSelectionModalOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center">
                <PlusIcon className="w-5 h-5 mr-2" />
                Ajouter un Contrat
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="Rechercher par client ou appartement..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" />
                    </div>
                    {/* Mobile Select */}
                    <div className="md:hidden">
                        <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500">
                            <option value={ContractStatus.Active}>Actif</option>
                            <option value="all">Tous les statuts</option>
                            <option value={ContractStatus.Ended}>Terminé</option>
                            <option value={ContractStatus.Renewed}>Renouvelé</option>
                            <option value={ContractStatus.Canceled}>Annulé</option>
                            <option value={ContractStatus.SaleCompleted}>Vente Terminée</option>
                        </select>
                    </div>
                    
                    <select value={filters.projectId} onChange={e => handleFilterChange('projectId', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500">
                        <option value="all">Tous les projets</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                    <button onClick={resetFilters} className="md:col-start-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center text-sm">
                        <XCircleIcon className="w-5 h-5 mr-2" /> Réinitialiser
                    </button>
                </div>

                {/* Desktop Buttons */}
                <div className="hidden md:flex flex-wrap gap-2">
                    <FilterButton label="Tous" value="all" />
                    <FilterButton label="Actifs" value={ContractStatus.Active} />
                    <FilterButton label="Terminés" value={ContractStatus.Ended} />
                    <FilterButton label="Renouvelés" value={ContractStatus.Renewed} />
                    <FilterButton label="Annulés" value={ContractStatus.Canceled} />
                    <FilterButton label="Ventes" value={ContractStatus.SaleCompleted} />
                </div>
            </div>
        </div>

      {filteredContracts.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appartement</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant (DH)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durée / Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts.map((contract) => {
                    const client = clients.find(c => c.id === contract.client_id);
                    const apartment = apartments.find(a => a.id === contract.apartment_id);
                    const totalPaid = payments
                        .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid)
                        .reduce((sum, p) => sum + p.amount_dh, 0);
                    
                    const latestPayment = payments
                        .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid)
                        .sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                        [0] || null;

                    // Dynamic Status Calculation for Active Contracts
                    let statusLabel = translateStatus(contract.status);
                    let statusClass = getStatusBadge(contract.status);

                    if (contract.status === ContractStatus.Active && contract.type === 'rental' && contract.end_date) {
                        const endDate = new Date(contract.end_date);
                        const today = new Date();
                        // Normalize to midnight for accurate day comparison
                        today.setHours(0,0,0,0);
                        
                        const diffTime = endDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays < 0) {
                             statusLabel = 'Expiré (Action Requise)';
                             statusClass = 'px-2 py-1 text-xs font-semibold rounded-full capitalize bg-orange-100 text-orange-800 border border-orange-200';
                        } else if (diffDays <= 30) {
                             statusLabel = 'Expire Bientôt';
                             statusClass = 'px-2 py-1 text-xs font-semibold rounded-full capitalize bg-yellow-100 text-yellow-800 border border-yellow-200';
                        }
                    }

                    return (
                    <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{apartment?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                           {contract.amount_dh.toLocaleString()}
                           {contract.type === 'sale' && (
                                <div className="text-xs text-gray-500 font-normal">
                                    ({totalPaid.toLocaleString()} payé)
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{renderDurationText(contract)}</div>
                            <div className="text-sm text-gray-500">{new Date(contract.start_date).toLocaleDateString('fr-FR')} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString('fr-FR') : ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className={statusClass}>{statusLabel}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-3">
                                {latestPayment && (
                                     <button 
                                        onClick={() => setReceiptPaymentId(latestPayment.id)}
                                        title="Imprimer le dernier reçu"
                                    >
                                        <PrinterIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 cursor-pointer" />
                                    </button>
                                )}
                                {/* Add Reservation Form Button */}
                                <button
                                    onClick={() => setReservationContractId(contract.id)}
                                    title="Imprimer Bon de Réservation"
                                >
                                    <FileTextIcon className="w-5 h-5 text-gray-500 hover:text-purple-600 cursor-pointer" />
                                </button>
                                <Link to={`/clients/${contract.client_id}`}><EyeIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 cursor-pointer" title="Voir l'historique du client" /></Link>
                                {contract.type === 'rental' && <EditIcon className="w-5 h-5 text-gray-500 hover:text-green-600 cursor-pointer" onClick={() => openEditModal(contract)} />}
                                {contract.status === ContractStatus.Active && contract.type === 'rental' && (
                                    <>
                                        <RefreshCwIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 cursor-pointer" onClick={() => openRenewModal(contract)} title="Renouveler le contrat"/>
                                        <XCircleIcon className="w-5 h-5 text-gray-500 hover:text-red-600 cursor-pointer" onClick={() => openEndModal(contract)} title="Mettre fin au contrat (Clôturer)" />
                                    </>
                                )}
                                <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600 cursor-pointer" onClick={() => openDeleteModal(contract)} title="Supprimer le contrat" />
                            </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-800">Aucun contrat trouvé</h3>
            <p className="text-gray-500 mt-1">Essayez d'ajuster vos filtres.</p>
        </div>
      )}

       <Modal title={editingContract ? "Modifier le Contrat" : `Nouveau Contrat de ${newContractType === 'rental' ? 'Location' : 'Vente'}`} isOpen={isModalOpen} onClose={closeModal}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
            {!editingContract && (<><div><label htmlFor="client_id" className="block text-sm font-medium text-gray-700">Client</label><select name="client_id" id="client_id" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"><option value="" disabled>Sélectionner un client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div><div><label htmlFor="apartment_id" className="block text-sm font-medium text-gray-700">Propriété</label><select name="apartment_id" id="apartment_id" required onChange={(e) => setSelectedApartmentId(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"><option value="" disabled>Sélectionner une propriété</option>{apartments.filter(a => a.status !== ApartmentStatus.Rented && a.status !== ApartmentStatus.Sold).map(a => <option key={a.id} value={a.id}>{a.name} ({translateApartmentStatus(a.status)}) - {(newContractType === 'rental' ? a.price_dh : a.sale_price_dh)?.toLocaleString()} DH</option>)}</select></div></>)}
            {editingContract && (<div className="p-4 bg-gray-50 rounded-lg"><p className="text-sm font-medium text-gray-800">Client: {clients.find(c => c.id === editingContract.client_id)?.full_name}</p><p className="text-sm text-gray-600">Propriété: {apartments.find(a => a.id === editingContract.apartment_id)?.name}</p></div>)}
            
            { (editingContract?.type === 'rental' || (!editingContract && newContractType === 'rental')) && (<>
                <div className="grid grid-cols-2 gap-4"><div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Loyer Mensuel (DH)</label><input type="number" step="0.01" name="amount_dh" id="amount_dh" required defaultValue={editingContract?.amount_dh || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div><div><label htmlFor="duration_months" className="block text-sm font-medium text-gray-700">Durée (mois)</label><input type="number" name="duration_months" id="duration_months" required defaultValue={editingContract?.duration_months || ''} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div></div>
                <div><label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Date de début</label><input type="date" name="start_date" id="start_date" required defaultValue={editingContract?.start_date} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
            </>)}

             { (!editingContract && newContractType === 'sale') && (<>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Prix de Vente Final (DH)</label><input type="number" step="0.01" name="amount_dh" id="amount_dh" required value={salePrice} onChange={e => setSalePrice(Number(e.target.value))} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                  <div><label htmlFor="start_date" className="block text-sm font-medium text-gray-700">Date de Vente</label><input type="date" name="start_date" id="start_date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                </div>

                <div className="border-t pt-4 mt-4">
                    <div className="relative flex items-start">
                        <div className="flex items-center h-5"><input id="record_payment" name="record_payment" type="checkbox" checked={recordInitialPayment} onChange={e => setRecordInitialPayment(e.target.checked)} className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded" /></div>
                        <div className="ml-3 text-sm"><label htmlFor="record_payment" className="font-medium text-gray-700">Enregistrer un acompte initial ?</label></div>
                    </div>

                    {recordInitialPayment && (
                        <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg border">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div><label htmlFor="initial_amount_paid" className="block text-sm font-medium text-gray-700">Montant Payé (DH)</label><input type="number" step="0.01" name="initial_amount_paid" id="initial_amount_paid" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} className="mt-1 block w-full" /></div>
                             <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Montant Restant</label><p className="mt-1 block w-full px-3 py-2 bg-gray-200 text-gray-800 rounded-md">{(salePrice - amountPaid).toLocaleString()} DH</p></div>
                           </div>
                            <div><label htmlFor="initial_payment_description" className="block text-sm font-medium text-gray-700">Description</label><input type="text" name="initial_payment_description" id="initial_payment_description" placeholder={`Acompte vente ${apartments.find(a=>a.id === selectedApartmentId)?.name || ''}`} className="mt-1 block w-full" /></div>
                            <div><label htmlFor="initial_payment_date" className="block text-sm font-medium text-gray-700">Date de paiement</label><input type="date" name="initial_payment_date" id="initial_payment_date" required defaultValue={new Date().toISOString().substring(0, 10)} className="mt-1 block w-full" /></div>
                            <div><label className="block text-sm font-medium text-gray-700">Méthode de paiement</label><select onChange={(e) => setInitialPaymentMethod(e.target.value as PaymentMethod)} value={initialPaymentMethod} className="mt-1 block w-full"><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="effet">Effet</option></select></div>
                            {initialPaymentMethod === 'cheque' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="cheque_number" className="block text-sm font-medium text-gray-700">N° de chèque</label><input type="text" name="cheque_number" id="cheque_number" className="mt-1 block w-full" /></div><div><label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">Nom de la banque</label><input type="text" name="bank_name" id="bank_name" className="mt-1 block w-full" /></div></div>)}
                            {initialPaymentMethod === 'virement' && (<div><label htmlFor="transfer_series" className="block text-sm font-medium text-gray-700">Série de virement</label><input type="text" name="transfer_series" id="transfer_series" className="mt-1 block w-full" /></div>)}
                            {initialPaymentMethod === 'effet' && (<div><label htmlFor="effect_number" className="block text-sm font-medium text-gray-700">N° d'effet</label><input type="text" name="effect_number" id="effect_number" className="mt-1 block w-full" /></div>)}
                        </div>
                    )}
                </div>
            </>)}

            <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" id="notes" defaultValue={editingContract?.notes || ''} rows={3} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"></textarea></div>
            <div className="mt-6 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                {editingContract && (editingContract.status === 'active' || editingContract.status === 'ended') && (
                    <button type="button" onClick={() => openRenewModal(editingContract)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <RefreshCwIcon className="w-5 h-5 mr-2"/>
                        Renouveler
                    </button>
                )}
                 {editingContract && editingContract.status === 'active' && (
                    <button type="button" onClick={() => { closeModal(); openCancelModal(editingContract); }} className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                        <TrashIcon className="w-5 h-5 mr-2"/>
                        Annuler Contrat
                    </button>
                )}
                </div>
                <div className="flex space-x-3"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Sauvegarder</button></div>
            </div>
        </form>
      </Modal>

       <Modal title={`Renouveler le contrat pour ${apartments.find(a => a.id === contractToRenew?.apartment_id)?.name}`} isOpen={isRenewModalOpen} onClose={closeRenewModal}>
            <form onSubmit={handleRenewSubmit} className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-800">Client: {clients.find(c => c.id === contractToRenew?.client_id)?.full_name}</p>
                    <p className="text-sm text-gray-600">Propriété: {apartments.find(a => a.id === contractToRenew?.apartment_id)?.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label htmlFor="renew_amount_dh" className="block text-sm font-medium text-gray-700">Nouveau Loyer (DH)</label><input type="number" step="0.01" name="amount_dh" id="renew_amount_dh" required defaultValue={contractToRenew?.amount_dh} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    <div><label htmlFor="renew_duration_months" className="block text-sm font-medium text-gray-700">Nouvelle Durée (mois)</label><input type="number" name="duration_months" id="renew_duration_months" required defaultValue={contractToRenew?.duration_months} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                </div>
                 <div><label htmlFor="renew_start_date" className="block text-sm font-medium text-gray-700">Nouvelle Date de début</label><input type="date" name="start_date" id="renew_start_date" required defaultValue={contractToRenew?.end_date} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                 <div><label htmlFor="renew_notes" className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" id="renew_notes" rows={3} placeholder="Notes pour le nouveau contrat..." className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"></textarea></div>
                <div className="mt-6 flex justify-between items-center">
                    <button 
                        type="button" 
                        onClick={() => {
                            const c = contractToRenew;
                            closeRenewModal();
                            if(c) {
                                setContractToEnd(c);
                                setIsEndModalOpen(true);
                            }
                        }} 
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center"
                        title="Ne pas renouveler et terminer le contrat maintenant"
                    >
                        <XCircleIcon className="w-5 h-5 mr-2"/>
                        Terminer le Contrat
                    </button>
                    <div className="flex space-x-3">
                        <button type="button" onClick={closeRenewModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirmer Renouvellement</button>
                    </div>
                </div>
            </form>
        </Modal>

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={confirmCancelContract}
            title="Confirmer l'annulation"
            message={`Êtes-vous sûr de vouloir annuler le contrat pour "${apartments.find(a => a.id === contractToCancel?.apartment_id)?.name}" ? Cette action marquera aussi la propriété comme disponible/à vendre.`}
        />

        <ConfirmationModal
            isOpen={isEndModalOpen}
            onClose={() => setIsEndModalOpen(false)}
            onConfirm={confirmEndContract}
            title="Confirmer la clôture"
            message={`Êtes-vous sûr de vouloir mettre fin au contrat pour "${apartments.find(a => a.id === contractToEnd?.apartment_id)?.name}" ? Cette action marquera le contrat comme terminé et libérera la propriété.`}
        />
        
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDeleteContract}
            title="Confirmer la suppression"
            message={`Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT le contrat pour "${apartments.find(a => a.id === contractToDelete?.apartment_id)?.name}" ? Cette action supprimera également tous les paiements associés. Cette action est irréversible.`}
        />
        
        <Modal title="Choisir le type de contrat" isOpen={isTypeSelectionModalOpen} onClose={() => setIsTypeSelectionModalOpen(false)}>
            <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 p-8">
                <button 
                    onClick={() => handleTypeSelection('rental')} 
                    className="w-full md:w-auto flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-105"
                >
                    <HomeIcon className="w-6 h-6 mr-3" />
                    <span className="text-lg font-semibold">Nouveau Contrat de Location</span>
                </button>
                <button 
                    onClick={() => handleTypeSelection('sale')}
                    className="w-full md:w-auto flex items-center justify-center px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                    <FileTextIcon className="w-6 h-6 mr-3" />
                    <span className="text-lg font-semibold">Nouveau Contrat de Vente</span>
                </button>
            </div>
        </Modal>

        {receiptPaymentId && (
            <ReceiptPage 
                paymentId={receiptPaymentId} 
                onClose={() => setReceiptPaymentId(null)} 
            />
        )}
        
        {reservationContractId && (
            <ReservationFormPage
                contractId={reservationContractId}
                onClose={() => setReservationContractId(null)}
            />
        )}
    </div>
  );
};

export default ContractsPage;
