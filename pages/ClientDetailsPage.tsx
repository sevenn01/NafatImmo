import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getClients, getPayments, getContracts, getApartments, addPayment } from '../services/api';
import { Client, Payment, PaymentStatus, Contract, ContractStatus, Apartment, PaymentMethod } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';
import { CoinsIcon, PrinterIcon } from '../components/icons/Icons';
import ReceiptPage from './ReceiptPage';

const getPaymentStatusBadge = (status: PaymentStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case PaymentStatus.Paid: return `${baseClasses} bg-green-100 text-green-800`;
    case PaymentStatus.Pending: return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case PaymentStatus.Late: return `${baseClasses} bg-red-100 text-red-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const getContractStatusBadge = (status: ContractStatus) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full capitalize';
  switch (status) {
    case ContractStatus.Active: return `${baseClasses} bg-green-100 text-green-800`;
    case ContractStatus.Ended: return `${baseClasses} bg-gray-200 text-gray-800`;
    case ContractStatus.Canceled: return `${baseClasses} bg-red-100 text-red-800`;
    case ContractStatus.Renewed: return `${baseClasses} bg-blue-100 text-blue-800`;
    case ContractStatus.SaleCompleted: return `${baseClasses} bg-indigo-100 text-indigo-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const translatePaymentStatus = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.Paid: return 'Payé';
        case PaymentStatus.Pending: return 'En attente';
        case PaymentStatus.Late: return 'En retard';
        case PaymentStatus.Canceled: return 'Annulé';
        default: return status;
    }
};

const translateContractStatus = (status: ContractStatus) => {
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

const ClientDetailsPage: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('especes');
    const { user } = useAuth();
    const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);


    const fetchData = async () => {
        if (!clientId) return;
        try {
            setLoading(true);
            const [clientsData, paymentsData, contractsData, apartmentsData] = await Promise.all([
                getClients(), getPayments(), getContracts(), getApartments()
            ]);
            const currentClient = clientsData.find(c => c.id === clientId) || null;
            const clientPayments = paymentsData.filter(p => p.client_id === clientId)
                .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
            const clientContracts = contractsData.filter(c => c.client_id === clientId)
                .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
            
            setClient(currentClient);
            setPayments(clientPayments);
            setContracts(clientContracts);
            setApartments(apartmentsData);
        } catch (error) {
            console.error("Failed to fetch client details:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId]);
    
    const clientContractsWithDetails = useMemo(() => {
        return contracts.map(contract => {
            const apartment = apartments.find(a => a.id === contract.apartment_id);
            const contractPayments = payments.filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid);
            const totalPaid = contractPayments.reduce((sum, p) => sum + p.amount_dh, 0);
            const remainingAmount = contract.amount_dh - totalPaid;

            let paymentStatusText = 'N/A';
            let paymentStatusBadge = '';
            
            if (contract.type === 'sale') {
                if (remainingAmount <= 0) {
                    paymentStatusText = 'Payé';
                    paymentStatusBadge = 'bg-green-100 text-green-800';
                } else if (totalPaid > 0) {
                    paymentStatusText = 'Partiel';
                    paymentStatusBadge = 'bg-yellow-100 text-yellow-800';
                } else {
                    paymentStatusText = 'Non Payé';
                    paymentStatusBadge = 'bg-red-100 text-red-800';
                }
            }

            return { 
                ...contract, 
                apartmentName: apartment?.name || 'N/A',
                totalPaid,
                remainingAmount,
                paymentStatusText,
                paymentStatusBadge
            };
        });
    }, [contracts, apartments, payments]);

    const handleOpenPaymentModal = (contract: Contract) => {
        setSelectedContract(contract);
        setIsPaymentModalOpen(true);
    }
    
    const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user || !selectedContract) return;

        const formData = new FormData(e.currentTarget);
        const paymentData: Omit<Payment, 'id' | 'payment_id' | 'created_at' | 'updated_at'> = {
            contract_id: selectedContract.id, 
            client_id: selectedContract.client_id,
            amount_dh: Number(formData.get('amount_dh')),
            payment_date: formData.get('payment_date') as string,
            payment_for: formData.get('payment_for') as string,
            status: PaymentStatus.Paid,
            payment_method: paymentMethod,
            cheque_number: formData.get('cheque_number') as string | undefined, 
            bank_name: formData.get('bank_name') as string | undefined,
            transfer_series: formData.get('transfer_series') as string | undefined, 
            effect_number: formData.get('effect_number') as string | undefined,
        };
        try {
            await addPayment(paymentData, user.user_id);
            fetchData();
            setIsPaymentModalOpen(false);
            setSelectedContract(null);
        } catch(error) {
            console.error("Failed to add payment:", error);
            alert("Erreur lors de l'ajout du paiement.");
        }
    }


    if (loading) return <div>Chargement des détails du client...</div>;
    if (!client) return <div>Client non trouvé.</div>;

    return (
        <div>
            <Link to="/clients" className="text-sm text-green-600 hover:underline mb-4 block">&larr; Retour à la liste des clients</Link>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{client.full_name}</h2>
                <p className="text-gray-600">{client.occupation}</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <p><strong className="font-medium text-gray-800">Email:</strong> {client.email}</p>
                    <p><strong className="font-medium text-gray-800">Téléphone:</strong> {client.phone}</p>
                    <p><strong className="font-medium text-gray-800">Adresse:</strong> {client.address}</p>
                    <p><strong className="font-medium text-gray-800">CIN:</strong> {client.cin_number}</p>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4">Historique des Contrats</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    {clientContractsWithDetails.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appartement</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période / Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Total (DH)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Payé (DH)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Restant (DH)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut Contrat</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clientContractsWithDetails.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{c.apartmentName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {c.type === 'rental' ? `${new Date(c.start_date).toLocaleDateString('fr-FR')} - ${c.end_date ? new Date(c.end_date).toLocaleDateString('fr-FR') : 'N/A'}` : `Vente le ${new Date(c.start_date).toLocaleDateString('fr-FR')}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{c.amount_dh.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">{c.totalPaid > 0 ? c.totalPaid.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-700">{c.type === 'sale' && c.remainingAmount > 0 ? c.remainingAmount.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={getContractStatusBadge(c.status)}>{translateContractStatus(c.status)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {c.type === 'sale' && c.remainingAmount > 0 ? (
                                                <button onClick={() => handleOpenPaymentModal(c)} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center">
                                                   <CoinsIcon className="w-4 h-4 mr-1.5" /> Recouvrer
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="p-6 text-sm text-gray-500">Aucun contrat trouvé pour ce client.</p>}
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4">Historique des Paiements</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    {payments.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant (DH)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date de Paiement</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{p.payment_for}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.amount_dh.toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{p.payment_method}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={getPaymentStatusBadge(p.status)}>{translatePaymentStatus(p.status)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {p.status !== PaymentStatus.Canceled && (
                                                <button
                                                    onClick={() => setReceiptPaymentId(p.id)}
                                                    title="Imprimer le reçu"
                                                >
                                                    <PrinterIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 cursor-pointer" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="p-6 text-sm text-gray-500">Aucun paiement trouvé pour ce client.</p>}
                </div>
            </div>

            <Modal title={`Ajouter un paiement pour ${apartments.find(a => a.id === selectedContract?.apartment_id)?.name}`} isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)}>
                <form onSubmit={handleAddPayment} className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-800">Client: {client.full_name}</p>
                        <p className="text-sm text-gray-600">Montant restant du contrat: <span className="font-bold">{clientContractsWithDetails.find(c => c.id === selectedContract?.id)?.remainingAmount.toLocaleString()} DH</span></p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="amount_dh" className="block text-sm font-medium text-gray-700">Montant Payé (DH)</label><input type="number" step="0.01" name="amount_dh" id="amount_dh" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                        <div><label htmlFor="payment_for" className="block text-sm font-medium text-gray-700">Description du paiement</label><input type="text" name="payment_for" id="payment_for" placeholder="ex: Versement 2, Solde..." required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    </div>
                    <div><label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">Date de paiement</label><input type="date" name="payment_date" id="payment_date" required defaultValue={new Date().toISOString().substring(0, 10)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Méthode de paiement</label><select onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} value={paymentMethod} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="effet">Effet</option></select></div>
                    {paymentMethod === 'cheque' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="cheque_number" className="block text-sm font-medium text-gray-700">N° de chèque</label><input type="text" name="cheque_number" id="cheque_number" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div><div><label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">Nom de la banque</label><input type="text" name="bank_name" id="bank_name" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div></div>)}
                    {paymentMethod === 'virement' && (<div><label htmlFor="transfer_series" className="block text-sm font-medium text-gray-700">Série de virement</label><input type="text" name="transfer_series" id="transfer_series" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>)}
                    {paymentMethod === 'effet' && (<div><label htmlFor="effect_number" className="block text-sm font-medium text-gray-700">N° d'effet</label><input type="text" name="effect_number" id="effect_number" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>)}
                    <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Sauvegarder Paiement</button></div>
                </form>
            </Modal>
            
            {receiptPaymentId && (
                <ReceiptPage 
                    paymentId={receiptPaymentId} 
                    onClose={() => setReceiptPaymentId(null)} 
                />
            )}
        </div>
    );
};

export default ClientDetailsPage;