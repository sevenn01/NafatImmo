
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getContracts, getClients, getApartments, getProjects } from '../services/api';
import { Contract, Client, Apartment, ContractStatus, Project } from '../types';
import { FileTextIcon, SearchIcon, UsersIcon, HomeIcon, AlertTriangleIcon } from '../components/icons/Icons';

const RejectedSalesPage: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [ctrs, cls, apts, projs] = await Promise.all([
                getContracts(), getClients(), getApartments(), getProjects()
            ]);
            // Filter for canceled or rejected sales
            setContracts(ctrs.filter(c => c.status === ContractStatus.SaleCanceled || c.status === ContractStatus.Canceled)
                                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
            setClients(cls);
            setApartments(apts);
            setProjects(projs);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            const client = clients.find(cl => cl.id === c.client_id);
            return (client?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [contracts, clients, searchTerm]);

    if (loading) return <div className="p-8 text-center text-gray-500">Chargement de l'historique des désistements...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Désistements & Rejets</h2>
                    <p className="text-gray-500 mt-1">Historique des ventes et locations annulées</p>
                </div>
                <div className="bg-red-50 text-red-700 px-5 py-2.5 rounded-xl flex items-center font-bold border border-red-100 shadow-sm">
                    <AlertTriangleIcon className="w-5 h-5 mr-2" />
                    {contracts.length} Dossiers annulés au total
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Rechercher par client ou projet..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white transition-all outline-none font-bold" 
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Client & Profil</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Bien Concerné</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Valeur Initiale</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Motif du Rejet</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-red-800 uppercase tracking-wider">Annulation</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredContracts.map(c => {
                            const client = clients.find(cl => cl.id === c.client_id);
                            const apartment = apartments.find(a => a.id === c.apartment_id);
                            const isSale = c.type === 'sale';
                            
                            return (
                                <tr key={c.id} className="hover:bg-red-50/20 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center font-bold ${client?.rejection_count && client.rejection_count > 1 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600'}`}>
                                                {client?.full_name.charAt(0)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900">{client?.full_name}</div>
                                                <div className="flex items-center space-x-2 mt-0.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase">
                                                        Désistement
                                                    </span>
                                                    {client?.rejection_count && client.rejection_count > 1 && (
                                                        <span className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Récidiviste ({client.rejection_count})</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-bold">{apartment?.name}</div>
                                        <div className="text-xs text-gray-500 font-medium uppercase">{projects.find(p => p.id === c.project_id)?.project_name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">
                                        {c.amount_dh.toLocaleString()} DH
                                        <span className="ml-1 text-[10px] text-gray-400 font-normal">({isSale ? 'Vente' : 'Loc'})</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600 italic leading-snug max-w-xs font-medium">
                                            {c.rejection_reason || 'Raison non spécifiée lors de la clôture.'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 font-bold">
                                        {new Date(c.updated_at).toLocaleDateString('fr-FR')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredContracts.length === 0 && (
                    <div className="text-center py-20 text-gray-400 font-medium">
                        <FileTextIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        Aucun rejet de dossier enregistré dans le système.
                    </div>
                )}
            </div>
        </div>
    );
};

export default RejectedSalesPage;
