
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getContracts, getClients, getApartments, addContract, cancelContract, getProjects, deleteContract } from '../services/api';
import { Contract, Client, Apartment, ContractStatus, ApartmentStatus, Project, Payment, PaymentStatus, PaymentMethod } from '../types';
import { PlusIcon, EyeIcon, EditIcon, TrashIcon, SearchIcon, XCircleIcon, FileTextIcon, HomeIcon, UsersIcon, AlertTriangleIcon, PaperclipIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import ReservationFormPage from './ReservationFormPage';

const translateStatus = (status: ContractStatus) => {
    switch (status) {
        case ContractStatus.Active: return 'Actif';
        case ContractStatus.Ended: return 'Terminé';
        case ContractStatus.Renewed: return 'Renouvelé';
        case ContractStatus.SaleInProgress: return 'Vente en cours';
        case ContractStatus.SaleCompleted: return 'Vente Terminée';
        case ContractStatus.SaleCanceled: return 'Vente Annulée';
        case ContractStatus.Canceled: return 'Annulé';
        default: return status;
    }
}

const getStatusBadge = (status: ContractStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case ContractStatus.Active: return `${baseClasses} bg-green-100 text-green-800`;
    case ContractStatus.SaleCompleted: return `${baseClasses} bg-indigo-100 text-indigo-800`;
    case ContractStatus.SaleInProgress: return `${baseClasses} bg-yellow-100 text-orange-800 border border-orange-200`;
    case ContractStatus.SaleCanceled:
    case ContractStatus.Canceled: return `${baseClasses} bg-red-100 text-red-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const ContractsPage: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTypeSelectionModalOpen, setIsTypeSelectionModalOpen] = useState(false);
    const [newContractType, setNewContractType] = useState<'rental' | 'sale'>('sale');
    
    // Selection states
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('all');
    const [selectedApartmentId, setSelectedApartmentId] = useState('');
    const [salePrice, setSalePrice] = useState<string>('0');
    const [amountPaid, setAmountPaid] = useState<string>('0');
    
    // Initial Payment Method Details
    const [initPaymentMethod, setInitPaymentMethod] = useState<PaymentMethod>('especes');
    const [initProofBase64, setInitProofBase64] = useState<string>('');

    const [reservationContractId, setReservationContractId] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [contractToReject, setContractToReject] = useState<Contract | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const { user } = useAuth();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ status: 'all', type: 'all', projectId: 'all' });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [ctrs, cls, apts, projs] = await Promise.all([ getContracts(), getClients(), getApartments(), getProjects() ]);
            setContracts(ctrs); setClients(cls); setApartments(apts); setProjects(projs);
            if (projs.length > 0 && !selectedProjectId) setSelectedProjectId(projs[0].id);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, [selectedProjectId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    useEffect(() => {
        if (isModalOpen && projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
    }, [isModalOpen, projects, selectedProjectId]);

    useEffect(() => {
        const apt = apartments.find(a => a.id === selectedApartmentId);
        setSalePrice(String(apt?.sale_price_dh || apt?.price_dh || 0));
    }, [selectedApartmentId, apartments]);

    const modalFloorOptions = useMemo(() => {
        if (!selectedProjectId) return [];
        const projectApts = apartments.filter(a => a.project_id === selectedProjectId);
        return Array.from(new Set(projectApts.map(a => a.floor).filter(Boolean))).sort((a, b) => {
            if (a === 'RDC') return -1;
            if (b === 'RDC') return 1;
            return parseInt(a!) - parseInt(b!);
        }) as string[];
    }, [selectedProjectId, apartments]);

    const filteredModalApartments = useMemo(() => {
        return apartments.filter(a => {
            const isAvailable = a.status === ApartmentStatus.Available || a.status === ApartmentStatus.ForSale;
            return isAvailable && a.project_id === selectedProjectId && (selectedFloor === 'all' || a.floor === selectedFloor);
        });
    }, [apartments, selectedProjectId, selectedFloor]);

    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            const client = clients.find(cl => cl.id === c.client_id);
            const nameMatch = (client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const statusMatch = filters.status === 'all' || c.status === filters.status;
            const typeMatch = filters.type === 'all' || c.type === filters.type;
            const projectMatch = filters.projectId === 'all' || c.project_id === filters.projectId;
            return nameMatch && statusMatch && typeMatch && projectMatch;
        });
    }, [contracts, clients, searchTerm, filters]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setInitProofBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        const formData = new FormData(e.currentTarget);
        const apartmentId = formData.get('apartment_id') as string;
        const selectedApt = apartments.find(a => a.id === apartmentId);
        
        const totalAmount = Number(salePrice);
        const initialDeposit = Number(amountPaid);

        const data: Partial<Contract> = {
            client_id: formData.get('client_id') as string,
            apartment_id: apartmentId,
            project_id: selectedApt?.project_id,
            type: newContractType,
            amount_dh: totalAmount,
            start_date: formData.get('start_date') as string,
            notes: formData.get('notes') as string,
        };

        let initialPay: Partial<Payment> | undefined;
        if (newContractType === 'rental') {
            data.duration_months = Number(formData.get('duration_months'));
            const end = new Date(data.start_date!); end.setMonth(end.getMonth() + data.duration_months);
            data.end_date = end.toISOString().split('T')[0];
            data.status = ContractStatus.Active;
        } else {
            data.status = initialDeposit >= totalAmount ? ContractStatus.SaleCompleted : ContractStatus.SaleInProgress;
            if (initialDeposit > 0) {
                initialPay = { 
                    amount_dh: initialDeposit, 
                    payment_date: data.start_date, 
                    payment_for: "Acompte initial", 
                    payment_method: initPaymentMethod, 
                    status: PaymentStatus.Paid,
                    proof_url: initProofBase64 || undefined,
                    cheque_number: formData.get('init_ref') as string,
                    bank_name: formData.get('init_bank') as string
                };
            }
        }
        try { 
            await addContract(data as any, user.user_id, initialPay); 
            fetchData(); 
            setIsModalOpen(false); 
            setInitProofBase64('');
            setInitPaymentMethod('especes');
        } catch(e) { console.error(e); }
    };

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-black sm:text-sm font-bold";

    if (loading) return <div className="p-8">Chargement des contrats...</div>;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Contrats</h2>
            <button onClick={() => setIsTypeSelectionModalOpen(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition duration-200 flex items-center shadow-lg font-bold">
                <PlusIcon className="w-5 h-5 mr-2" /> Nouveau Dossier
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="relative lg:col-span-2">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Chercher un client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClasses.replace("mt-1", "mt-0 pl-10")} />
            </div>
            <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className={inputClasses.replace("mt-1", "mt-0")}>
                <option value="all">Tous les statuts</option>
                <option value={ContractStatus.Active}>Actifs (Location)</option>
                <option value={ContractStatus.SaleInProgress}>Ventes en cours</option>
                <option value={ContractStatus.SaleCompleted}>Ventes Terminées</option>
            </select>
            <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className={inputClasses.replace("mt-1", "mt-0")}>
                <option value="all">Tous les types</option>
                <option value="sale">Vente</option>
                <option value="rental">Location</option>
            </select>
            <div className="flex space-x-2">
                <select value={filters.projectId} onChange={e => setFilters({...filters, projectId: e.target.value})} className={inputClasses.replace("mt-1", "mt-0 flex-1")}>
                    <option value="all">Tous les projets</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
                <button onClick={() => { setSearchTerm(''); setFilters({status:'all', type:'all', projectId:'all'}); }} className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                    <XCircleIcon className="w-5 h-5 text-gray-500" />
                </button>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                    <tr><th className="px-6 py-4 text-left">Client</th><th className="px-6 py-4 text-left">Propriété</th><th className="px-6 py-4 text-left">Type</th><th className="px-6 py-4 text-left">Montant</th><th className="px-6 py-4 text-left">Statut</th><th className="px-6 py-4 text-center">Actions</th></tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredContracts.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-black hover:text-green-600"><Link to={`/clients/${c.client_id}`}>{clients.find(cl => cl.id === c.client_id)?.full_name}</Link></td>
                            <td className="px-6 py-4 text-gray-700">{apartments.find(a => a.id === c.apartment_id)?.name}</td>
                            <td className="px-6 py-4 text-gray-500 capitalize">{c.type === 'rental' ? 'Location' : 'Vente'}</td>
                            <td className="px-6 py-4 font-bold text-black">{c.amount_dh.toLocaleString()} DH</td>
                            <td className="px-6 py-4"><span className={getStatusBadge(c.status)}>{translateStatus(c.status)}</span></td>
                            <td className="px-6 py-4 flex justify-center space-x-3">
                                <Link to={`/clients/${c.client_id}`} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg" title="Voir client"><UsersIcon className="w-5 h-5" /></Link>
                                <button onClick={() => setReservationContractId(c.id)} className="p-1.5 bg-purple-50 text-purple-600 rounded-lg" title="Documents"><FileTextIcon className="w-5 h-5" /></button>
                                <button onClick={() => { setContractToDelete(c); setIsDeleteModalOpen(true); }} className="p-1.5 bg-red-50 text-red-500 rounded-lg" title="Supprimer"><TrashIcon className="w-5 h-5" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <Modal title={`Nouveau Contrat : ${newContractType === 'rental' ? 'Location' : 'Vente'}`} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700">Client</label>
                    <select name="client_id" required className={inputClasses}>
                        <option value="" disabled selected>Choisir un client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700">Projet</label>
                        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required className={inputClasses}>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700">Propriété</label>
                        <select name="apartment_id" required value={selectedApartmentId} onChange={(e) => setSelectedApartmentId(e.target.value)} className={inputClasses}>
                            <option value="" disabled>Choisir l'unité</option>
                            {filteredModalApartments.map(a => <option key={a.id} value={a.id}>{a.name} ({a.floor})</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-bold text-gray-700">Montant (DH)</label><input type="number" step="any" value={salePrice} onChange={e => setSalePrice(e.target.value)} className={inputClasses} /></div>
                    <div><label className="block text-sm font-bold text-gray-700">Date signature</label><input type="date" name="start_date" required defaultValue={new Date().toISOString().split('T')[0]} className={inputClasses} /></div>
                </div>

                {newContractType === 'sale' && (
                    <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-blue-800">Versement Initial (DH)</label>
                                <input type="number" step="any" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className={inputClasses} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-blue-800">Mode de paiement</label>
                                <select value={initPaymentMethod} onChange={e => setInitPaymentMethod(e.target.value as PaymentMethod)} className={inputClasses}>
                                    <option value="especes">Espèces</option>
                                    <option value="cheque">Chèque</option>
                                    <option value="virement">Virement</option>
                                    <option value="effet">Effet</option>
                                </select>
                            </div>
                        </div>

                        {initPaymentMethod !== 'especes' && (
                            <div className="grid grid-cols-2 gap-4 animate-slide-up-from-bottom">
                                <div><label className="block text-xs font-bold text-gray-600 uppercase">Référence (N° Chèque/Virement)</label><input type="text" name="init_ref" className={inputClasses} /></div>
                                <div><label className="block text-xs font-bold text-gray-600 uppercase">Banque</label><input type="text" name="init_bank" className={inputClasses} /></div>
                            </div>
                        )}

                        <div className="mt-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Preuve de versement (Scan/Photo)</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-gray-500 file:bg-blue-100 file:text-blue-700 file:rounded-lg file:border-0 file:px-4 file:py-2" />
                            {initProofBase64 && <div className="mt-1 text-[10px] text-green-600 font-bold uppercase">FICHIER CHARGÉ ✓</div>}
                        </div>
                    </div>
                )}

                <div><label className="block text-sm font-bold text-gray-700">Notes</label><textarea name="notes" rows={2} className={inputClasses} placeholder="Commentaires ou clauses spécifiques..."></textarea></div>
                
                <div className="flex justify-end space-x-3 pt-5 border-t">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">Annuler</button>
                    <button type="submit" className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">Valider le dossier</button>
                </div>
            </form>
        </Modal>

        <Modal title="Opération" isOpen={isTypeSelectionModalOpen} onClose={() => setIsTypeSelectionModalOpen(false)}>
            <div className="flex space-x-4 p-4">
                <button onClick={() => { setNewContractType('sale'); setIsTypeSelectionModalOpen(false); setIsModalOpen(true); }} className="flex-1 p-6 bg-purple-600 text-white rounded-2xl font-bold text-lg hover:bg-purple-700 transition-all shadow-lg transform hover:-translate-y-1">Dossier de Vente</button>
                <button onClick={() => { setNewContractType('rental'); setIsTypeSelectionModalOpen(false); setIsModalOpen(true); }} className="flex-1 p-6 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg transform hover:-translate-y-1">Location</button>
            </div>
        </Modal>
        {reservationContractId && <ReservationFormPage contractId={reservationContractId} onClose={() => setReservationContractId(null)} />}
        <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={async () => { if(contractToDelete) { await deleteContract(contractToDelete.id); fetchData(); setIsDeleteModalOpen(false); } }} title="Supprimer" message="Action irréversible. Les paiements liés seront également supprimés." />
    </div>
  );
};

export default ContractsPage;
