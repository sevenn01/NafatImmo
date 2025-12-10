
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, getContracts, getApartments, addClient, updateClient, deleteClient } from '../services/api';
import { Client, Contract, Apartment, ContractStatus } from '../types';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon } from '../components/icons/Icons';
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
  const activeContracts = clientContracts.filter(c => c.status === ContractStatus.Active);

  return (
    <div 
        onClick={() => navigate(`/clients/${client.id}`)}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer group"
    >
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">{client.full_name}</h3>
            <p className="text-sm text-gray-500">{client.occupation}</p>
          </div>
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(client)} className="p-2 rounded-full hover:bg-gray-100"><EditIcon className="w-5 h-5 text-gray-500 hover:text-green-600"/></button>
              <button onClick={() => onDelete(client)} className="p-2 rounded-full hover:bg-red-100"><TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600"/></button>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p><strong className="font-medium text-gray-800">Email:</strong> {client.email}</p>
          <p><strong className="font-medium text-gray-800">Téléphone:</strong> {client.phone}</p>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800">Contrats Actifs ({activeContracts.length})</h4>
          {activeContracts.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {activeContracts.slice(0, 2).map(contract => {
                const apartment = apartments.find(a => a.id === contract.apartment_id);
                return <li key={contract.id}>- {apartment?.name || 'N/A'}</li>;
              })}
            </ul>
          ) : ( <p className="mt-2 text-sm text-gray-500">Aucun contrat actif.</p> )}
        </div>
      </div>
       <div className="mt-4 pt-4 border-t border-gray-200 text-right">
        <span className="text-sm font-medium text-green-600 group-hover:text-green-700">Voir les détails &rarr;</span>
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
            // FIX: Add safety checks for undefined strings
            (client.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.phone || '').includes(searchTerm)
        );
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
            alert("Erreur lors de l'ajout du client.");
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

    if (loading) return <div>Chargement des clients...</div>;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Clients</h2>
            <button onClick={openAddModal} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center">
                <PlusIcon className="w-5 h-5 mr-2" />
                Ajouter un Client
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Rechercher par nom, email, téléphone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" />
            </div>
        </div>

      {filteredClients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map(client => (
              <ClientCard key={client.id} client={client} contracts={contracts} apartments={apartments} onEdit={openEditModal} onDelete={handleDeleteClient} />
            ))}
          </div>
        ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-800">Aucun client trouvé</h3>
                <p className="text-gray-500 mt-1">Essayez d'ajuster votre recherche.</p>
            </div>
        )}

      <Modal title={editingClient ? "Modifier le Client" : "Ajouter un Nouveau Client"} isOpen={isModalOpen} onClose={closeModal}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div><label htmlFor="full_name" className="block text-sm font-medium text-gray-700">Nom complet</label><input type="text" name="full_name" id="full_name" required defaultValue={editingClient?.full_name} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" id="email" required defaultValue={editingClient?.email} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div><div><label htmlFor="phone" className="block text-sm font-medium text-gray-700">Téléphone</label><input type="tel" name="phone" id="phone" required defaultValue={editingClient?.phone} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div></div>
            <div><label htmlFor="address" className="block text-sm font-medium text-gray-700">Adresse</label><input type="text" name="address" id="address" required defaultValue={editingClient?.address} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="cin_number" className="block text-sm font-medium text-gray-700">N° CIN</label><input type="text" name="cin_number" id="cin_number" required defaultValue={editingClient?.cin_number} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div><div><label htmlFor="occupation" className="block text-sm font-medium text-gray-700">Profession</label><input type="text" name="occupation" id="occupation" required defaultValue={editingClient?.occupation} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" /></div></div>
             <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Sauvegarder</button></div>
        </form>
      </Modal>
    </div>
  );
};

export default ClientsPage;
