
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
    case ContractStatus.SaleInProgress: return `${baseClasses} bg-yellow-100 text-orange-800 border border-orange-200`;
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


    if (loading) return <div className="p-8 text-center text-gray-500 font-bold">Chargement du dossier client...</div>;
    if (!client) return <div className="p-8 text-center text-red-500 font-bold">Client introuvable.</div>;

    return (
        <div>
            <Link to="/clients" className="text-sm font-bold text-green-600 hover:underline mb-6 block flex items-center">&larr; Retour à l'annuaire des clients</Link>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">{client.full_name}</h2>
                        <p className="text-gray-500 font-medium uppercase tracking-wide mt-1">{client.occupation || 'Particulier'}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">ID Client</span>
                        <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg text-gray-600">{client.id.substring(0,8).toUpperCase()}</span>
                    </div>
                </div>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">E-mail</p>
                        <p className="font-bold text-gray-800 break-all">{client.email || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Téléphone</p>
                        <p className="font-bold text-gray-800">{client.phone}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Adresse</p>
                        <p className="font-bold text-gray-800 line-clamp-1">{client.address || 'Non spécifiée'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">CIN / Passeport</p>
                        <p className="font-bold text-gray-800">{client.cin_number}</p>
                    </div>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4 px-2">Engagements Contractuels</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-10">
                <div className="overflow-x-auto">
                    {clientContractsWithDetails.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Unité</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Période / Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant Total</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Déjà Encaissé</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reliquat</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clientContractsWithDetails.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">{c.apartmentName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {c.type === 'rental' ? `${new Date(c.start_date).toLocaleDateString('fr-FR')} - ${c.end_date ? new Date(c.end_date).toLocaleDateString('fr-FR') : 'N/A'}` : `Signé le ${new Date(c.start_date).toLocaleDateString('fr-FR')}`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">{c.amount_dh.toLocaleString()} DH</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700">{c.totalPaid > 0 ? `${c.totalPaid.toLocaleString()} DH` : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">{c.type === 'sale' && c.remainingAmount > 0 ? `${c.remainingAmount.toLocaleString()} DH` : '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={getContractStatusBadge(c.status)}>{translateContractStatus(c.status)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {c.type === 'sale' && c.remainingAmount > 0 ? (
                                                <button onClick={() => handleOpenPaymentModal(c)} className="mx-auto px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center shadow-sm">
                                                   <CoinsIcon className="w-4 h-4 mr-1.5" /> Encaisser le solde
                                                </button>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="p-10 text-center text-sm text-gray-500 italic">Aucun engagement actif pour ce client.</p>}
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4 px-2">Historique des Versements</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-10">
                <div className="overflow-x-auto">
                    {payments.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Objet / Description</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Méthode</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Documents</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{p.payment_for}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">{p.amount_dh.toLocaleString()} DH</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{p.payment_method}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={getPaymentStatusBadge(p.status)}>{translatePaymentStatus(p.status)}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center space-x-2">
                                            {p.status !== PaymentStatus.Canceled && (
                                                <button
                                                    onClick={() => setReceiptPaymentId(p.id)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                                    title="Générer reçu PDF"
                                                >
                                                    <PrinterIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="p-10 text-center text-sm text-gray-500 italic">Aucun paiement enregistré pour ce client.</p>}
                </div>
            </div>

            <Modal title={`Recouvrement : ${apartments.find(a => a.id === selectedContract?.apartment_id)?.name}`} isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)}>
                <form onSubmit={handleAddPayment} className="space-y-5">
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex justify-between items-center">
                        <span className="text-indigo-900 font-bold">Reliquat à percevoir :</span>
                        <span className="text-xl font-black text-indigo-700">{clientContractsWithDetails.find(c => c.id === selectedContract?.id)?.remainingAmount.toLocaleString()} DH</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="amount_dh" className="block text-sm font-bold text-gray-700">Montant Encaissé (DH)</label>
                            <input type="number" step="any" name="amount_dh" id="amount_dh" required className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 font-bold text-lg" />
                        </div>
                        <div>
                            <label htmlFor="payment_for" className="block text-sm font-bold text-gray-700">Description du versement</label>
                            <input type="text" name="payment_for" id="payment_for" placeholder="ex: Versement 2, Solde..." required className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="payment_date" className="block text-sm font-bold text-gray-700">Date du paiement</label>
                            <input type="date" name="payment_date" id="payment_date" required defaultValue={new Date().toISOString().substring(0, 10)} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 font-bold" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Méthode de paiement</label>
                            <select onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} value={paymentMethod} className="mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-green-500 font-bold">
                                <option value="especes">Espèces</option>
                                <option value="cheque">Chèque</option>
                                <option value="virement">Virement</option>
                                <option value="effet">Effet</option>
                            </select>
                        </div>
                    </div>

                    {paymentMethod !== 'especes' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-slide-up-from-bottom">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase">Référence (N°)</label><input type="text" name="cheque_number" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg font-bold" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase">Banque</label><input type="text" name="bank_name" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg font-bold" /></div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end space-x-3 pt-5 border-t border-gray-100">
                        <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">Annuler</button>
                        <button type="submit" className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">Valider l'encaissement</button>
                    </div>
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
