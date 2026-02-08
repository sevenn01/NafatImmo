import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, getContracts, getApartments, addClient, updateClient, deleteClient } from '../services/api';
import { Client, Contract, Apartment, ContractStatus } from '../types';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, AlertTriangleIcon, UsersIcon } from '../components/icons/Icons';
import Modal from '../components/Modal';
import { useAuth } from '../auth/AuthContext';

const ClientCard: React.FC<{ 
    client: Client; 
    contracts: Contract[]; 
    apartments: Apartment[]; 
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
}> = ({ client, contracts, apartments, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const clientContracts = contracts.filter(c => c.client_id === client.id);
  const activeContracts = clientContracts.filter(c => c.status === ContractStatus.Active || c.status === ContractStatus.SaleInProgress);

  return (
    <div 
        onClick={() => navigate(`/clients/${client.id}`)}
        className={`bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group ${client.has_rejection ? 'border-red-200 bg-red-50/10' : 'border-gray-200'}`}
    >
      <div>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors">{client.full_name}</h3>
                {client.rejection_count && client.rejection_count > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-tighter">
                        <AlertTriangleIcon className="w-3 h-3 mr-1" />
                        Désistements: {client.rejection_count}
                    </span>
                )}
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{client.occupation || 'Particulier'}</p>
          </div>
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(client)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><EditIcon className="w-5 h-5 text-gray-400 hover:text-green-600"/></button>
              <button onClick={() => onDelete(client)} className="p-2 rounded-lg hover:bg-red-50 transition-colors"><TrashIcon className="w-5 h-5 text-gray-400 hover:text-red-600"/></button>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm text-gray-600">
          {/* Replaced Email with CIN as requested */}
          <p className="flex items-center">
            <span className="w-8 h-4 mr-2 opacity-50 font-bold text-[10px] flex items-center border border-gray-300 rounded px-1 justify-center bg-gray-50">CIN</span> 
            <span className="font-bold text-gray-800">{client.cin_number}</span>
          </p>
          <p className="flex items-center">
            <span className="w-8 h-4 mr-2 opacity-50 font-bold text-[10px] flex items-center border border-gray-300 rounded px-1 justify-center bg-gray-50 text-green-600">TÉL</span> 
            <span className="font-medium text-gray-700">{client.phone}</span>
          </p>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dossiers en cours ({activeContracts.length})</h4>
          {activeContracts.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-gray-800 font-medium">
              {activeContracts.slice(0, 2).map(contract => {
                const apartment = apartments.find(a => a.id === contract.apartment_id);
                return (
                  <li key={contract.id} className="flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></div>
                    {apartment?.name || 'Unité'} 
                    <span className="ml-auto text-[10px] text-gray-400 uppercase">{contract.type === 'sale' ? 'Vente' : 'Loc'}</span>
                  </li>
                );
              })}
            </ul>
          ) : ( <p className="text-sm text-gray-400 italic">Aucun dossier actif.</p> )}
        </div>
      </div>
       <div className="mt-5 pt-5 border-t border-gray-100 text-right">
        <span className="text-sm font-bold text-green-600 group-hover:text-green-700 transition-colors flex items-center justify-end">Dossier Complet &rarr;</span>
      </div>
    </div>
  );
};


const ClientsPage: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [clientsData, contractsData, apartmentsData] = await Promise.all([ getClients(), getContracts(), getApartments() ]);
            setClients(clientsData);
            setContracts(contractsData);
            setApartments(apartmentsData);
        } catch (error) { console.error("Failed to fetch data:", error);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const filteredClients = useMemo(() => {
        return clients.filter(client => 
            (client.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.cin_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.phone || '').includes(searchTerm)
        ).sort((a, b) => {
            if ((a.rejection_count || 0) !== (b.rejection_count || 0)) {
                return (b.rejection_count || 0) - (a.rejection_count || 0);
            }
            return a.full_name.localeCompare(b.full_name);
        });
    }, [clients, searchTerm]);

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        
        const formData = new FormData(e.currentTarget);
        const clientData = {
            full_name: formData.get('full_name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            address: formData.get('address') as string,
            cin_number: formData.get('cin_number') as string,
            occupation: formData.get('occupation') as string,
        };

        try {
            if (editingClient) {
                await updateClient(editingClient.id, clientData, user.user_id);
            } else {
                await addClient(clientData, user.user_id);
            }
            fetchData();
            closeModal();
        } catch (error) {
            console.error("Failed to save client:", error);
            alert("Erreur lors de l'enregistrement du client.");
        }
    }
    
    const handleDeleteClient = async (client: Client) => {
        if(window.confirm(`Êtes-vous sûr de vouloir supprimer ${client.full_name}?`)){
            try {
                await deleteClient(client.id);
                fetchData();
            } catch (error: any) {
                console.error("Failed to delete client:", error);
                alert(`Erreur: ${error.message}`);
            }
        }
    }

    const openEditModal = (client: Client) => { setEditingClient(client); setIsModalOpen(true); }
    const openAddModal = () => { setEditingClient(null); setIsModalOpen(true); }
    const closeModal = () => { setIsModalOpen(false); setEditingClient(null); }

    const inputClasses = "mt-1 block w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 sm:text-sm font-medium transition-all";

    if (loading) return <div className="p-8 text-center text-gray-500">Chargement des clients...</div>;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Clients</h2>
            <button onClick={openAddModal} className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition duration-200 flex items-center shadow-lg font-bold">
                <PlusIcon className="w-5 h-5 mr-2" />
                Ajouter un Client
            </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-8">
            <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Rechercher par Nom, CIN, Tél..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-50 pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none" />
            </div>
        </div>

      {filteredClients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(client => (
              <ClientCard key={client.id} client={client} contracts={contracts} apartments={apartments} onEdit={openEditModal} onDelete={handleDeleteClient} />
            ))}
          </div>
        ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <UsersIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-800">Aucun client trouvé</h3>
                <p className="text-gray-500 mt-1">Essayez d'ajuster votre recherche ou ajoutez un nouveau client.</p>
            </div>
        )}

      <Modal title={editingClient ? "Modifier le Client" : "Ajouter un Nouveau Client"} isOpen={isModalOpen} onClose={closeModal}>
        <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* MANDATORY REQUIREMENTS (Name, Phone, CIN) */}
            <div className="space-y-4">
                <div>
                    <label htmlFor="full_name" className="block text-sm font-bold text-gray-700 flex justify-between">
                        Nom complet <span className="text-red-500 font-bold text-[10px] uppercase">* Requis</span>
                    </label>
                    <input type="text" name="full_name" id="full_name" required defaultValue={editingClient?.full_name} className={inputClasses} placeholder="Ex: Jean Dupont" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="phone" className="block text-sm font-bold text-gray-700 flex justify-between">
                            Téléphone <span className="text-red-500 font-bold text-[10px] uppercase">* Requis</span>
                        </label>
                        <input type="tel" name="phone" id="phone" required defaultValue={editingClient?.phone} className={inputClasses} placeholder="Ex: 06 12 34 56 78" />
                    </div>
                    <div>
                        <label htmlFor="cin_number" className="block text-sm font-bold text-gray-700 flex justify-between">
                            N° CIN / Passport <span className="text-red-500 font-bold text-[10px] uppercase">* Requis</span>
                        </label>
                        <input type="text" name="cin_number" id="cin_number" required defaultValue={editingClient?.cin_number} className={inputClasses} placeholder="Ex: AB123456" />
                    </div>
                </div>
            </div>

            {/* OPTIONAL FIELDS (Email, Address, etc.) */}
            <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Informations Facultatives</h4>
                <div className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-sm font-bold text-gray-600">
                            Email <span className="text-gray-400 font-normal italic text-xs ml-1">(Optionnel)</span>
                        </label>
                        <input type="email" name="email" id="email" defaultValue={editingClient?.email} className={inputClasses.replace("text-gray-900", "text-gray-500")} placeholder="Ex: jean.dupont@email.com" />
                    </div>
                    <div>
                        <label htmlFor="address" className="block text-sm font-bold text-gray-600">
                            Adresse de résidence <span className="text-gray-400 font-normal italic text-xs ml-1">(Optionnel)</span>
                        </label>
                        <input type="text" name="address" id="address" defaultValue={editingClient?.address} className={inputClasses.replace("text-gray-900", "text-gray-500")} placeholder="Ex: 123 Rue de la Paix" />
                    </div>
                    <div>
                        <label htmlFor="occupation" className="block text-sm font-bold text-gray-600">
                            Profession <span className="text-gray-400 font-normal italic text-xs ml-1">(Optionnel)</span>
                        </label>
                        <input type="text" name="occupation" id="occupation" defaultValue={editingClient?.occupation} className={inputClasses.replace("text-gray-900", "text-gray-500")} placeholder="Ex: Ingénieur" />
                    </div>
                </div>
            </div>

             <div className="mt-8 flex justify-end space-x-3 pt-5 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">Annuler</button>
                <button type="submit" className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">Enregistrer le client</button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClientsPage;