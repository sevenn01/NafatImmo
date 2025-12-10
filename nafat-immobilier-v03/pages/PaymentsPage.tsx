
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPayments, getClients, getContracts, addPayment, cancelPayment, markPaymentAsLate, getProjects, getApartments } from '../services/api';
import { Payment, Client, PaymentStatus, Contract, ContractStatus, PaymentMethod, Project, Apartment } from '../types';
import { PlusIcon, TrashIcon, ClockIcon, SearchIcon, XCircleIcon, PrinterIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import ReceiptPage from './ReceiptPage';
import ConfirmationModal from '../components/ConfirmationModal';

const translateStatus = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.Paid: return 'Payé';
        case PaymentStatus.Pending: return 'En attente';
        case PaymentStatus.Late: return 'En retard';
        case PaymentStatus.Canceled: return 'Annulé';
        default: return status;
    }
};

const getStatusBadge = (status: PaymentStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case PaymentStatus.Paid: return `${baseClasses} bg-green-100 text-green-800`;
    case PaymentStatus.Pending: return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case PaymentStatus.Late: return `${baseClasses} bg-orange-100 text-orange-800`;
    case PaymentStatus.Canceled: return `${baseClasses} bg-gray-200 text-gray-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('especes');
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    paymentMethod: 'all',
    projectId: 'all',
    startDate: '',
    endDate: '',
  });

  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [paymentFor, setPaymentFor] = useState('');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [paymentToCancel, setPaymentToCancel] = useState<Payment | null>(null);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentsData, clientsData, contractsData, projectsData, apartmentsData] = await Promise.all([ getPayments(), getClients(), getContracts(), getProjects(), getApartments() ]);
      setPayments(paymentsData.sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()));
      setClients(clientsData);
      setContracts(contractsData);
      setProjects(projectsData);
      setApartments(apartmentsData);
    } catch (error) { console.error("Failed to fetch data:", error);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const resetFilters = () => {
      setSearchTerm('');
      setFilters({ status: 'all', paymentMethod: 'all', projectId: 'all', startDate: '', endDate: '' });
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
        const client = clients.find(c => c.id === p.client_id);
        const contract = contracts.find(c => c.id === p.contract_id);
        const project = projects.find(proj => proj.id === contract?.project_id);

        // FIX: Add safety checks for undefined strings
        const clientNameMatch = client ? (client.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const searchMatch = !searchTerm || clientNameMatch;
        const statusMatch = filters.status === 'all' || p.status === filters.status;
        const methodMatch = filters.paymentMethod === 'all' || p.payment_method === filters.paymentMethod;
        const projectMatch = filters.projectId === 'all' || project?.id === filters.projectId;

        const paymentDate = new Date(p.payment_date);
        const startDateMatch = !filters.startDate || paymentDate >= new Date(filters.startDate);
        const endDateMatch = !filters.endDate || paymentDate <= new Date(filters.endDate);

        return searchMatch && statusMatch && methodMatch && projectMatch && startDateMatch && endDateMatch;
    });
  }, [payments, clients, contracts, projects, searchTerm, filters]);

  const unpaidMonths = useCallback((contract: Contract) => {
      if (contract.type !== 'rental' || !contract.end_date) return [];

      const paymentsByMonth: { [key: string]: number } = payments
          // FIX: Add safety check for p.payment_for
          .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid && p.payment_for && (p.payment_for || '').toLowerCase().startsWith('loyer '))
          .reduce((acc, p) => {
              const monthYearKey = (p.payment_for || '').toLowerCase().replace('loyer ', '');
              acc[monthYearKey] = (acc[monthYearKey] || 0) + p.amount_dh;
              return acc;
          }, {} as { [key: string]: number });
      
      const unpaid: string[] = [];
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      
      let currentDate = new Date(contract.start_date + 'T00:00:00Z');
      const endDate = new Date(contract.end_date + 'T00:00:00Z');
      const today = new Date();
      today.setUTCHours(0,0,0,0);
      const limitDate = today < endDate ? today : endDate;

      while (currentDate <= limitDate) {
          const monthYearStr = `${monthNames[currentDate.getUTCMonth()]} ${currentDate.getUTCFullYear()}`;
          const monthYearKey = monthYearStr.toLowerCase();
          const totalPaidForMonth = paymentsByMonth[monthYearKey] || 0;

          if (totalPaidForMonth < contract.amount_dh) {
              unpaid.push(monthYearStr);
          }
          currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
      }

      return unpaid;
  }, [payments]);

  const payableContracts = useMemo(() => {
    return contracts.filter(c => {
        if (c.type === 'rental') {
            return unpaidMonths(c).length > 0;
        }
        if (c.type === 'sale') {
            const totalPaid = payments
                .filter(p => p.contract_id === c.id && p.status === PaymentStatus.Paid)
                .reduce((sum, p) => sum + p.amount_dh, 0);
            return c.amount_dh > totalPaid;
        }
        return false;
    }).sort((a, b) => {
        const clientA = clients.find(cl => cl.id === a.client_id)?.full_name || '';
        const clientB = clients.find(cl => cl.id === b.client_id)?.full_name || '';
        return clientA.localeCompare(clientB);
    });
  }, [contracts, payments, clients, unpaidMonths]);


  const selectedContractDetails = useMemo(() => {
    if (!selectedContractId) return null;
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return null;

    if (contract.type === 'sale') {
        const contractPayments = payments.filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid);
        const totalPaid = contractPayments.reduce((sum, p) => sum + p.amount_dh, 0);
        const remainingAmount = contract.amount_dh - totalPaid;
        return { contract, type: 'sale' as const, totalPaid, remainingAmount };
    }

    if (contract.type === 'rental') {
        return { contract, type: 'rental' as const, rentAmount: contract.amount_dh };
    }
    
    return null;
  }, [selectedContractId, contracts, payments]);

  useEffect(() => {
    if (selectedContractDetails && selectedContractDetails.type === 'sale') {
        setCurrentPaymentAmount(String(selectedContractDetails.remainingAmount));
        const apartment = apartments.find(a => a.id === selectedContractDetails.contract.apartment_id);
        const totalPaidCount = payments.filter(p => p.contract_id === selectedContractDetails.contract.id && p.status === PaymentStatus.Paid).length;
        setPaymentFor(`Versement ${totalPaidCount + 1} - Vente ${apartment?.name || ''}`);
    } else {
        // Reset handled by contract selector onChange
    }
  }, [selectedContractDetails, apartments, payments]);


  const unpaidMonthsForSelectedContract = useMemo(() => {
      if (!selectedContractId) return [];
      const contract = contracts.find(c => c.id === selectedContractId);
      if (!contract) return [];
      return unpaidMonths(contract);
  }, [selectedContractId, contracts, unpaidMonths]);
  
  const isFormValid = useMemo(() => {
    if (!selectedContractId || !currentPaymentAmount || Number(currentPaymentAmount) <= 0 || !paymentFor) {
        return false;
    }
    const contract = contracts.find(c => c.id === selectedContractId);
    if (contract?.type === 'rental' && !unpaidMonthsForSelectedContract.some(m => `Loyer ${m}` === paymentFor)) {
        return false;
    }
    return true;
  }, [selectedContractId, currentPaymentAmount, paymentFor, contracts, unpaidMonthsForSelectedContract]);

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isFormValid) return;
    const formData = new FormData(e.currentTarget);
    const contractId = selectedContractId;
    const selectedContract = contracts.find(c => c.id === contractId);
    if (!selectedContract) return;
    const paymentData: Omit<Payment, 'id' | 'payment_id' | 'created_at' | 'updated_at'> = {
        contract_id: contractId, client_id: selectedContract.client_id,
        amount_dh: Number(currentPaymentAmount),
        payment_date: formData.get('payment_date') as string,
        payment_for: paymentFor,
        status: PaymentStatus.Paid,
        payment_method: paymentMethod,
        cheque_number: formData.get('cheque_number') as string | undefined, bank_name: formData.get('bank_name') as string | undefined,
        transfer_series: formData.get('transfer_series') as string | undefined, effect_number: formData.get('effect_number') as string | undefined,
    };
    try {
        await addPayment(paymentData, user.user_id);
        fetchData();
        setIsModalOpen(false);
    } catch(error) {
        console.error("Failed to add payment:", error);
        alert("Erreur lors de l'ajout du paiement.");
    }
  }

  const handleCancelPayment = (payment: Payment) => {
    setPaymentToCancel(payment);
    setIsConfirmModalOpen(true);
  }
  
  const confirmCancelPayment = async () => {
    if (!paymentToCancel || !user) return;
    try {
      await cancelPayment(paymentToCancel.id, user.user_id);
      fetchData();
    } catch(error) {
      console.error("Failed to cancel payment:", error);
      alert("Erreur lors de l'annulation du paiement.");
    } finally {
      setIsConfirmModalOpen(false);
      setPaymentToCancel(null);
    }
  }

  const handleMarkAsLate = async (payment: Payment) => {
    if(window.confirm(`Marquer ce paiement comme "En retard" ?`)) {
        if(!user) return;
        try { await markPaymentAsLate(payment.id, user.user_id); fetchData();
        } catch(error) { console.error("Failed to mark payment as late:", error); alert("Erreur lors de la mise à jour du paiement."); }
    }
}

  const openAddModal = () => {
    setSelectedContractId('');
    setPaymentFor('');
    setPaymentMethod('especes');
    setCurrentPaymentAmount('');
    setIsModalOpen(true);
  };

  if (loading) return <div>Chargement des paiements...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Paiements</h2>
        <button onClick={openAddModal} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />Ajouter un Paiement
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative md:col-span-2 lg:col-span-4">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Rechercher par nom du client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"><option value="all">Tous les statuts</option><option value={PaymentStatus.Paid}>Payé</option><option value={PaymentStatus.Late}>En retard</option><option value={PaymentStatus.Canceled}>Annulé</option></select>
            <select value={filters.paymentMethod} onChange={e => handleFilterChange('paymentMethod', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"><option value="all">Toutes les méthodes</option><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="effet">Effet</option></select>
            <select value={filters.projectId} onChange={e => handleFilterChange('projectId', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"><option value="all">Tous les projets</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center text-sm"><XCircleIcon className="w-5 h-5 mr-2" />Réinitialiser</button>
            <div className="md:col-span-2 flex items-center gap-4"><label className="text-sm text-gray-600">Date:</label><input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm" /><span className="text-gray-500">-</span><input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="w-full bg-gray-50 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm" /></div>
        </div>
      </div>

      {filteredPayments.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant (DH)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => {
                    const client = clients.find(c => c.id === payment.client_id);
                    return (<tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{payment.amount_dh.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.payment_for}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(payment.payment_date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className={getStatusBadge(payment.status)}>{translateStatus(payment.status)}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                           <div className="flex items-center space-x-3">
                                {payment.status !== PaymentStatus.Canceled && (
                                     <button 
                                        onClick={() => setReceiptPaymentId(payment.id)}
                                        title="Imprimer le reçu"
                                    >
                                        <PrinterIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 cursor-pointer" />
                                    </button>
                                )}
                                {payment.status === PaymentStatus.Late && (
                                    <ClockIcon className="w-5 h-5 text-red-500" title="En retard" />
                                )}
                                {payment.status === PaymentStatus.Paid && (
                                    <ClockIcon className="w-5 h-5 text-gray-400 hover:text-orange-500 cursor-pointer" onClick={() => handleMarkAsLate(payment)} title="Marquer comme en retard" />
                                )}
                                {payment.status !== PaymentStatus.Canceled && (
                                    <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600 cursor-pointer" onClick={() => handleCancelPayment(payment)} title="Annuler le paiement" />
                                )}
                            </div>
                        </td>
                    </tr>);
                })}
                </tbody>
            </table>
            </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-800">Aucun paiement trouvé</h3>
            <p className="text-gray-500 mt-1">Essayez d'ajuster vos filtres.</p>
        </div>
      )}

      <Modal title="Ajouter un Paiement" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleAddPayment} className="space-y-4">
             <div><label htmlFor="contract_id" className="block text-sm font-medium text-gray-700">Contrat</label><select name="contract_id" id="contract_id" required onChange={(e) => setSelectedContractId(e.target.value)} value={selectedContractId} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"><option value="" disabled>Sélectionner un contrat</option>{payableContracts.map(c => { const clientName = clients.find(cl => cl.id === c.client_id)?.full_name; const apartmentName = apartments.find(a => a.id === c.apartment_id)?.name; return <option key={c.id} value={c.id}>{clientName} - {apartmentName} ({c.type === 'rental' ? 'Location' : 'Vente'})</option> })}</select></div>
             
             {selectedContractDetails && (
                 <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                     {selectedContractDetails.type === 'rental' && <p className="text-sm">Loyer mensuel: <strong>{selectedContractDetails.rentAmount.toLocaleString()} DH</strong></p>}
                     {selectedContractDetails.type === 'sale' && <p className="text-sm">Reste à payer: <strong>{selectedContractDetails.remainingAmount.toLocaleString()} DH</strong> (Sur {selectedContractDetails.contract.amount_dh.toLocaleString()} DH)</p>}
                 </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Montant (DH)</label><input type="number" step="0.01" name="amount_dh" id="amount_dh" required value={currentPaymentAmount} onChange={e => setCurrentPaymentAmount(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                <div>
                    <label htmlFor="payment_for" className="block text-sm font-medium text-gray-700">Description</label>
                    {selectedContractDetails?.type === 'rental' ? (
                        <select name="payment_for" id="payment_for" required value={paymentFor} onChange={e => setPaymentFor(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                            <option value="" disabled>Sélectionner un mois</option>
                            {unpaidMonthsForSelectedContract.map(month => (
                                <option key={month} value={`Loyer ${month}`}>Loyer {month}</option>
                            ))}
                            <option value="Autre">Autre / Avance</option>
                        </select>
                    ) : (
                        <input type="text" name="payment_for" id="payment_for" required value={paymentFor} onChange={e => setPaymentFor(e.target.value)} placeholder="ex: Versement 2, Solde..." className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                    )}
                </div>
            </div>

            <div><label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">Date de paiement</label><input type="date" name="payment_date" id="payment_date" required defaultValue={new Date().toISOString().substring(0, 10)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Méthode de paiement</label><select onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} value={paymentMethod} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="effet">Effet</option></select></div>
            
            {paymentMethod === 'cheque' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="cheque_number" className="block text-sm font-medium text-gray-700">N° de chèque</label><input type="text" name="cheque_number" id="cheque_number" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div><div><label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">Nom de la banque</label><input type="text" name="bank_name" id="bank_name" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div></div>)}
            {paymentMethod === 'virement' && (<div><label htmlFor="transfer_series" className="block text-sm font-medium text-gray-700">Série de virement</label><input type="text" name="transfer_series" id="transfer_series" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>)}
            {paymentMethod === 'effet' && (<div><label htmlFor="effect_number" className="block text-sm font-medium text-gray-700">N° d'effet</label><input type="text" name="effect_number" id="effect_number" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>)}

            <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" disabled={!isFormValid} className={`px-4 py-2 text-white rounded-lg ${isFormValid ? 'bg-green-600 hover:bg-green-700' : 'bg-green-300 cursor-not-allowed'}`}>Enregistrer Paiement</button></div>
        </form>
      </Modal>

      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmCancelPayment} title="Confirmer l'annulation" message={`Êtes-vous sûr de vouloir annuler ce paiement de ${paymentToCancel?.amount_dh} DH ?`} />
      
      {receiptPaymentId && (
        <ReceiptPage 
            paymentId={receiptPaymentId} 
            onClose={() => setReceiptPaymentId(null)} 
        />
      )}
    </div>
  );
};

export default PaymentsPage;