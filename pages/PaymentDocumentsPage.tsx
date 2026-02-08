
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getPayments, getClients, getContracts, getProjects } from '../services/api';
import { Payment, Client, Contract, Project } from '../types';
import { SearchIcon, DownloadIcon, PaperclipIcon, XCircleIcon, UsersIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';

const DocumentCard: React.FC<{ payment: Payment, client?: Client, contract?: Contract, project?: Project, onPreview: (url: string) => void }> = ({ payment, client, contract, project, onPreview }) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-all">
            <div className="aspect-[4/3] bg-gray-100 relative cursor-pointer overflow-hidden" onClick={() => onPreview(payment.proof_url!)}>
                <img src={payment.proof_url} alt="Preuve" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="p-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <PaperclipIcon className="w-6 h-6 text-green-600" />
                    </div>
                </div>
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h4 className="font-bold text-gray-900 truncate max-w-[150px]">{client?.full_name || 'Client inconnu'}</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">{project?.project_name || 'Projet N/A'}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600">{payment.amount_dh.toLocaleString()} DH</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400 font-medium">{new Date(payment.payment_date).toLocaleDateString('fr-FR')}</span>
                    <a href={payment.proof_url} download={`preuve_${payment.id.substring(0,6)}.png`} className="p-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <DownloadIcon className="w-5 h-5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const PaymentDocumentsPage: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [filterProject, setFilterProject] = useState('all');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [pays, cls, ctrs, projs] = await Promise.all([ getPayments(), getClients(), getContracts(), getProjects() ]);
            // Filter only payments with a proof_url
            setPayments(pays.filter(p => !!p.proof_url).sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()));
            setClients(cls); setContracts(ctrs); setProjects(projs);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredDocs = useMemo(() => {
        return payments.filter(p => {
            const client = clients.find(c => c.id === p.client_id);
            const contract = contracts.find(c => c.id === p.contract_id);
            const searchMatch = (client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const projectMatch = filterProject === 'all' || contract?.project_id === filterProject;
            return searchMatch && projectMatch;
        });
    }, [payments, clients, contracts, searchTerm, filterProject]);

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Chargement de la banque de documents...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Documents de Paiement</h2>
                    <p className="text-gray-500 mt-1">Archive centrale des preuves de versement (Cheques, Virements...)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="md:col-span-2 relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Rechercher par client..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" 
                    />
                </div>
                <div className="flex space-x-2">
                    <select 
                        value={filterProject} 
                        onChange={e => setFilterProject(e.target.value)} 
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm font-bold"
                    >
                        <option value="all">Tous les projets</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                    <button onClick={() => { setSearchTerm(''); setFilterProject('all'); }} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                        <XCircleIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
            </div>

            {filteredDocs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredDocs.map(p => {
                        const client = clients.find(c => c.id === p.client_id);
                        const contract = contracts.find(c => c.id === p.contract_id);
                        const project = projects.find(proj => proj.id === contract?.project_id);
                        return (
                            <DocumentCard 
                                key={p.id} 
                                payment={p} 
                                client={client} 
                                contract={contract} 
                                project={project} 
                                onPreview={setPreviewUrl} 
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-2xl border border-gray-100">
                    <PaperclipIcon className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-800">Aucun document trouvé</h3>
                    <p className="text-gray-500">Seuls les paiements avec pièce jointe apparaissent ici.</p>
                </div>
            )}

            <Modal title="Aperçu du justificatif" isOpen={!!previewUrl} onClose={() => setPreviewUrl(null)}>
                <div className="flex flex-col items-center">
                    <img src={previewUrl || ''} alt="Justificatif" className="max-w-full h-auto rounded-xl shadow-2xl border border-gray-200 mb-6" />
                    <div className="flex space-x-4">
                        <a href={previewUrl || ''} download="justificatif_paiement.png" className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center shadow-lg hover:bg-green-700 transition-all">
                            <DownloadIcon className="w-5 h-5 mr-2" /> Télécharger l'original
                        </a>
                        <button onClick={() => setPreviewUrl(null)} className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">Quitter</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PaymentDocumentsPage;
