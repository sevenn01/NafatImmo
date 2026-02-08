
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getPayments, getClients, getContracts, addPayment, cancelPayment, updatePayment, getProjects, getApartments } from '../services/api';
import { Payment, Client, PaymentStatus, Contract, ContractStatus, PaymentMethod, Project, Apartment } from '../types';
import { PlusIcon, TrashIcon, SearchIcon, XCircleIcon, PrinterIcon, PaperclipIcon, DownloadIcon, EditIcon } from '../components/icons/Icons';
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
    case PaymentStatus.Canceled: return `${baseClasses} bg-gray-200 text-gray-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('especes');
  const [proofBase64, setProofBase64] = useState<string>('');
  const { user } = useAuth();
  
  // States for viewing/editing documents
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [isEditDocModalOpen, setIsEditDocModalOpen] = useState(false);
  const [selectedPaymentForDoc, setSelectedPaymentForDoc] = useState<Payment | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ status: 'all', projectId: 'all', startDate: '', endDate: '' });

  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [paymentFor, setPaymentFor] = useState('');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [paymentToCancel, setPaymentToCancel] = useState<Payment | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pays, cls, ctrs, projs] = await Promise.all([ getPayments(), getClients(), getContracts(), getProjects() ]);
      setPayments(pays.sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()));
      setClients(cls); setContracts(ctrs); setProjects(projs);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  const handleFilterChange = (key: string, val: string) => setFilters(prev => ({ ...prev, [key]: val }));
  const resetFilters = () => {
      setSearchTerm('');
      setFilters({ status: 'all', projectId: 'all', startDate: '', endDate: '' });
  };

  const filteredPayments = useMemo(() => {
      return payments.filter(p => {
          const client = clients.find(c => c.id === p.client_id);
          const contract = contracts.find(c => c.id === p.contract_id);
          const nameMatch = (client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
          const statusMatch = filters.status === 'all' || p.status === filters.status;
          const projectMatch = filters.projectId === 'all' || contract?.project_id === filters.projectId;
          const date = new Date(p.payment_date);
          const startMatch = !filters.startDate || date >= new Date(filters.startDate);
          const endMatch = !filters.endDate || date <= new Date(filters.endDate);
          return nameMatch && statusMatch && projectMatch && startMatch && endMatch;
      });
  }, [payments, clients, contracts, searchTerm, filters]);

  const unpaidMonthsList = (contract: Contract) => {
      if (contract.type !== 'rental') return [];
      const paidDesc = new Set(payments.filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid).map(p => (p.payment_for || '').toLowerCase()));
      const unpaid: string[] = [];
      const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      let curr = new Date(contract.start_date + 'T00:00:00Z');
      const limit = new Date();
      while (curr <= limit) {
          const label = `${months[curr.getUTCMonth()]} ${curr.getUTCFullYear()}`;
          if (!paidDesc.has(`loyer ${label.toLowerCase()}`)) unpaid.push(label);
          curr.setUTCMonth(curr.getUTCMonth() + 1);
      }
      return unpaid;
  };

  const selectedContractDetails = useMemo(() => {
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return null;
    const totalPaid = payments.filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid).reduce((sum, p) => sum + p.amount_dh, 0);
    return { contract, totalPaid, remaining: contract.amount_dh - totalPaid, unpaid: unpaidMonthsList(contract) };
  }, [selectedContractId, contracts, payments]);

  useEffect(() => {
    if (selectedContractDetails) {
        if (selectedContractDetails.contract.type === 'sale') {
            setCurrentPaymentAmount(String(selectedContractDetails.remaining));
            setPaymentFor(`Versement ${payments.filter(p => p.contract_id === selectedContractDetails.contract.id && p.status === PaymentStatus.Paid).length + 1}`);
        } else {
            setCurrentPaymentAmount(String(selectedContractDetails.contract.amount_dh));
            setPaymentFor(selectedContractDetails.unpaid[0] ? `Loyer ${selectedContractDetails.unpaid[0]}` : 'Autre / Avance');
        }
    }
  }, [selectedContractDetails]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setter(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedContractId) return;
    const formData = new FormData(e.currentTarget);
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return;
    const data: Partial<Payment> = {
        contract_id: selectedContractId, client_id: contract.client_id,
        amount_dh: Number(currentPaymentAmount), payment_date: formData.get('payment_date') as string,
        payment_for: paymentFor, notes: formData.get('notes') as string,
        status: PaymentStatus.Paid, payment_method: paymentMethod,
        proof_url: proofBase64 || undefined,
        cheque_number: formData.get('ref_num') as string,
        bank_name: formData.get('bank_name') as string
    };
    try { 
        await addPayment(data, user.user_id); 
        fetchData(); 
        setIsModalOpen(false); 
        setProofBase64('');
    } catch(error) { console.error(error); }
  }

  const handleUpdateProof = async () => {
    if (!selectedPaymentForDoc || !proofBase64) return;
    try {
        await updatePayment(selectedPaymentForDoc.id, { proof_url: proofBase64 });
        fetchData();
        setIsEditDocModalOpen(false);
        setSelectedPaymentForDoc(null);
        setProofBase64('');
    } catch(e) { console.error(e); }
  }

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-gray-900 sm:text-sm font-bold";

  if (loading) return <div className="p-8">Chargement des paiements...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Paiements</h2>
        <button onClick={() => { setSelectedContractId(''); setIsModalOpen(true); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 flex items-center shadow-sm font-bold">
          <PlusIcon className="w-5 h-5 mr-2" /> Nouveau Paiement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="relative lg:col-span-2">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClasses.replace("mt-1", "mt-0 pl-10")} />
          </div>
          <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className={inputClasses.replace("mt-1", "mt-0")}>
              <option value="all">Tous statuts</option>
              <option value={PaymentStatus.Paid}>Payé</option>
              <option value={PaymentStatus.Pending}>En attente</option>
          </select>
          <div className="flex items-center space-x-2">
              <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className={inputClasses.replace("mt-1", "mt-0 text-xs")} />
              <button onClick={resetFilters} className="p-2 bg-gray-100 rounded-lg"><XCircleIcon className="w-5 h-5 text-gray-500" /></button>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-4 text-left">Client</th><th className="px-6 py-4 text-left">Montant</th><th className="px-6 py-4 text-left">Objet</th><th className="px-6 py-4 text-center">Document</th><th className="px-6 py-4 text-center">Date</th><th className="px-6 py-4 text-center">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">{clients.find(c => c.id === p.client_id)?.full_name}</td>
                          <td className="px-6 py-4 font-bold text-black">{p.amount_dh.toLocaleString()} DH</td>
                          <td className="px-6 py-4 text-gray-600">{p.payment_for}</td>
                          <td className="px-6 py-4 text-center">
                              {p.proof_url ? (
                                  <button onClick={() => setPreviewProofUrl(p.proof_url!)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Voir le justificatif">
                                      <PaperclipIcon className="w-4 h-4" />
                                  </button>
                              ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-center">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-6 py-4 flex justify-center space-x-3 items-center">
                              <PrinterIcon className="w-5 h-5 text-gray-500 cursor-pointer hover:text-blue-600" title="Imprimer reçu" onClick={() => setReceiptPaymentId(p.id)} />
                              <button onClick={() => { setSelectedPaymentForDoc(p); setIsEditDocModalOpen(true); }} className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors group" title="Remplacer/Ajouter document">
                                  <EditIcon className="w-4 h-4 text-indigo-500 group-hover:text-indigo-700" />
                              </button>
                              {p.status === PaymentStatus.Paid && <TrashIcon className="w-5 h-5 text-gray-400 cursor-pointer hover:text-red-600" title="Annuler paiement" onClick={() => { setPaymentToCancel(p); setIsConfirmModalOpen(true); }} />}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      <Modal title="Aperçu du Justificatif" isOpen={!!previewProofUrl} onClose={() => setPreviewProofUrl(null)}>
          <div className="flex flex-col items-center">
              <img src={previewProofUrl || ''} className="max-w-full rounded-lg shadow-xl border border-gray-200 mb-6" alt="Preuve" />
              <div className="flex space-x-4">
                  <a href={previewProofUrl || ''} download="justificatif_paiement.png" className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold flex items-center shadow-lg hover:bg-green-700 transition-all"><DownloadIcon className="w-5 h-5 mr-2" /> Télécharger</a>
                  <button onClick={() => setPreviewProofUrl(null)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold">Fermer</button>
              </div>
          </div>
      </Modal>

      <Modal title="Gérer la pièce jointe" isOpen={isEditDocModalOpen} onClose={() => setIsEditDocModalOpen(false)}>
          <div className="space-y-6">
              {selectedPaymentForDoc?.proof_url ? (
                  <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Document Actuel</label>
                      <img src={selectedPaymentForDoc.proof_url} className="w-full h-48 object-contain rounded-xl border bg-gray-50" alt="Actuel" />
                  </div>
              ) : (
                  <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 font-medium">Aucun document n'est actuellement rattaché à ce paiement.</div>
              )}
              <div className="p-6 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/30 text-center">
                  <p className="text-sm font-bold text-indigo-900 mb-3">{selectedPaymentForDoc?.proof_url ? "Remplacer par un nouveau fichier" : "Sélectionner un fichier à uploader"}</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setProofBase64)} className="text-sm text-gray-500 file:bg-indigo-600 file:text-white file:border-0 file:rounded-xl file:px-6 file:py-2.5 file:font-bold hover:file:bg-indigo-700 cursor-pointer" />
                  {proofBase64 && <div className="mt-4 text-green-600 font-bold text-xs uppercase animate-bounce flex items-center justify-center"><XCircleIcon className="w-4 h-4 mr-1 rotate-45" /> Nouveau document prêt ✓</div>}
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button onClick={() => setIsEditDocModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold">Annuler</button>
                  <button onClick={handleUpdateProof} disabled={!proofBase64} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold disabled:bg-indigo-300 transition-all shadow-lg hover:bg-indigo-700">Sauvegarder les modifications</button>
              </div>
          </div>
      </Modal>

      <Modal title="Encaisser un Paiement" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleAddPayment} className="space-y-4">
             <div>
                <label className="block text-sm font-bold text-gray-700">Dossier / Contrat</label>
                <select required onChange={e => setSelectedContractId(e.target.value)} value={selectedContractId} className={inputClasses}>
                    <option value="" disabled>Sélectionner un dossier</option>
                    {contracts.filter(c => c.status !== ContractStatus.Canceled && c.status !== ContractStatus.SaleCanceled).map(c => (
                        <option key={c.id} value={c.id}>{clients.find(cl => cl.id === c.client_id)?.full_name} - {c.amount_dh.toLocaleString()} DH</option>
                    ))}
                </select>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700">Montant (DH)</label><input type="number" step="any" required value={currentPaymentAmount} onChange={e => setCurrentPaymentAmount(e.target.value)} className={inputClasses + " text-lg"} /></div>
                <div><label className="block text-sm font-bold text-gray-700">Objet du versement</label><input type="text" required value={paymentFor} onChange={e => setPaymentFor(e.target.value)} className={inputClasses} placeholder="ex: Loyer Mars, Acompte..." /></div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700">Date</label><input type="date" name="payment_date" required defaultValue={new Date().toISOString().substring(0, 10)} className={inputClasses} /></div>
                <div><label className="block text-sm font-bold text-gray-700">Mode</label>
                    <select onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} value={paymentMethod} className={inputClasses}>
                        <option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="effet">Effet</option>
                    </select>
                </div>
             </div>

             {paymentMethod !== 'especes' && (
                <div className="grid grid-cols-2 gap-4 animate-slide-up-from-bottom p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase">Référence (N°)</label><input type="text" name="ref_num" className={inputClasses} /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase">Banque</label><input type="text" name="bank_name" className={inputClasses} /></div>
                </div>
             )}

            <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                <label className="block text-sm font-bold text-gray-700 mb-2">Preuve de paiement <span className="text-gray-400 font-normal italic">(Optionnel)</span></label>
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setProofBase64)} className="text-xs" />
                {proofBase64 && <div className="text-[10px] text-green-600 font-bold mt-2 uppercase">FICHIER CHARGÉ ✓</div>}
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">Annuler</button>
                <button type="submit" className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">Confirmer l'encaissement</button>
            </div>
        </form>
      </Modal>

      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={async () => { if(paymentToCancel && user) { await cancelPayment(paymentToCancel.id, user.user_id); fetchData(); setIsConfirmModalOpen(false); } }} title="Annuler le versement ?" message="Cette action marquera le paiement comme annulé et pourra affecter le statut du contrat lié." />
      {receiptPaymentId && <ReceiptPage paymentId={receiptPaymentId} onClose={() => setReceiptPaymentId(null)} />}
    </div>
  );
};

export default PaymentsPage;
