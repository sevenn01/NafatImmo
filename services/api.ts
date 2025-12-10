
import { db } from '../firebase/config';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { 
  Project, Apartment, Client, Contract, Payment, User, ReceiptData,
  ProjectStatus, ApartmentStatus, ContractStatus, PaymentStatus 
} from '../types';

// Helper to convert Firestore snapshots to objects with IDs
const convertSnapshot = <T>(doc: firebase.firestore.DocumentSnapshot): T => {
  return { id: doc.id, ...doc.data() } as T;
};

// --- MOCK DATABASE FOR DEMO MODE ---
let isDemo = false;

interface MockDB {
    users: User[];
    projects: Project[];
    apartments: Apartment[];
    clients: Client[];
    contracts: Contract[];
    payments: Payment[];
}

let mockDb: MockDB = {
    users: [],
    projects: [],
    apartments: [],
    clients: [],
    contracts: [],
    payments: []
};

export const enableDemoMode = (): User => {
    isDemo = true;
    const now = new Date().toISOString();
    
    // Seed Demo User
    const demoUser: User = {
        id: 'demo_user', user_id: 'demo_user', name: 'Admin Démo', email: 'demo@nafat.com', role: 'admin', 
        permissions: { 
            dashboard: { view: true, create: true, edit: true, delete: true },
            projects: { view: true, create: true, edit: true, delete: true },
            apartments: { view: true, create: true, edit: true, delete: true },
            clients: { view: true, create: true, edit: true, delete: true },
            contracts: { view: true, create: true, edit: true, delete: true },
            payments: { view: true, create: true, edit: true, delete: true },
            settings: { view: true, create: true, edit: true, delete: true }
        },
        avatar_url: '', last_login: now
    };

    mockDb.users = [demoUser];

    // Seed Data
    mockDb.projects = [
        { id: 'p1', project_id: 'p1', project_name: 'Résidence Les Oliviers', location: 'Quartier Riad', description: 'Résidence moderne avec jardin.', total_apartments: 4, status: ProjectStatus.Active, created_at: now, updated_at: now }
    ];

    mockDb.apartments = [
        { id: 'a1', apartment_id: 'a1', project_id: 'p1', name: 'Appart. A1', type: 'apartment', floor: '1', surface_m2: 80, rooms: 3, balcony: true, bathroom: 1, kitchen: true, status: ApartmentStatus.Rented, price_dh: 4000, owner_name: 'Nafat', description: '', current_contract_id: 'c1', created_at: now, updated_at: now },
        { id: 'a2', apartment_id: 'a2', project_id: 'p1', name: 'Appart. A2', type: 'apartment', floor: '1', surface_m2: 85, rooms: 3, balcony: true, bathroom: 2, kitchen: true, status: ApartmentStatus.Available, price_dh: 4500, owner_name: 'Nafat', description: '', created_at: now, updated_at: now },
        { id: 'a3', apartment_id: 'a3', project_id: 'p1', name: 'Appart. A3 (Vendu)', type: 'apartment', floor: '2', surface_m2: 90, rooms: 3, balcony: true, bathroom: 2, kitchen: true, status: ApartmentStatus.Sold, price_dh: 0, sale_price_dh: 850000, owner_name: 'Nafat', description: '', current_contract_id: 'c2', created_at: now, updated_at: now },
         { id: 'g1', apartment_id: 'g1', project_id: 'p1', name: 'Garage G1', type: 'garage', surface_m2: 15, status: ApartmentStatus.Available, price_dh: 400, owner_name: 'Nafat', description: '', created_at: now, updated_at: now }
    ];

    mockDb.clients = [
        { id: 'cl1', client_id: 'cl1', full_name: 'Ahmed Benali', phone: '0661123456', email: 'ahmed@demo.com', address: 'Agadir', cin_number: 'J123456', occupation: 'Enseignant', contracts: ['c1'], created_at: now, updated_at: now },
        { id: 'cl2', client_id: 'cl2', full_name: 'Fatima Zahra', phone: '0662987654', email: 'fatima@demo.com', address: 'Casablanca', cin_number: 'B987654', occupation: 'Médecin', contracts: ['c2'], created_at: now, updated_at: now }
    ];

    // Rental Contract
    mockDb.contracts = [
        { 
            id: 'c1', contract_id: 'c1', client_id: 'cl1', apartment_id: 'a1', project_id: 'p1',
            type: 'rental', amount_dh: 4000, duration_months: 12, start_date: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0],
            end_date: new Date(new Date().setMonth(new Date().getMonth() + 10)).toISOString().split('T')[0],
            status: ContractStatus.Active, notes: 'Caution reçue', created_at: now, updated_at: now, months_left: 10
        },
        // Sale Contract
        {
            id: 'c2', contract_id: 'c2', client_id: 'cl2', apartment_id: 'a3', project_id: 'p1',
            type: 'sale', amount_dh: 850000, start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
            status: ContractStatus.SaleCompleted, notes: 'Vente finalisée', created_at: now, updated_at: now
        }
    ];

    // Payments
    mockDb.payments = [
        { id: 'p1', payment_id: 'p1', contract_id: 'c1', client_id: 'cl1', amount_dh: 4000, payment_date: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(), payment_for: 'Loyer Mois 1', status: PaymentStatus.Paid, payment_method: 'virement', created_at: now, updated_at: now },
        { id: 'p2', payment_id: 'p2', contract_id: 'c1', client_id: 'cl1', amount_dh: 4000, payment_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(), payment_for: 'Loyer Mois 2', status: PaymentStatus.Paid, payment_method: 'virement', created_at: now, updated_at: now },
        // Sale Payment (Partial)
        { id: 'p3', payment_id: 'p3', contract_id: 'c2', client_id: 'cl2', amount_dh: 850000, payment_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(), payment_for: 'Paiement Total Vente', status: PaymentStatus.Paid, payment_method: 'cheque', cheque_number: 'CH123456', bank_name: 'BP', created_at: now, updated_at: now }

    ];

    return demoUser;
};

export const disableDemoMode = () => {
    isDemo = false;
    mockDb = {
        users: [],
        projects: [],
        apartments: [],
        clients: [],
        contracts: [],
        payments: []
    };
};

// --- Helper for Mock ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Auth ---
export const login = async (email: string, password: string): Promise<User> => {
    // If login is attempted with credentials, force disable demo mode to use real backend
    if (isDemo) {
        disableDemoMode();
    }

    const usersRef = db.collection('users');
    const cleanEmail = email.trim();
    
    const snapshot = await usersRef.where('email', '==', cleanEmail).get();

    if (snapshot.empty) {
        throw new Error("Utilisateur non trouvé.");
    }

    const userDoc = snapshot.docs[0];
    const userData = convertSnapshot<User>(userDoc);
    
    if (userData.password && userData.password !== password) {
        throw new Error("Mot de passe incorrect.");
    }
    
    await userDoc.ref.update({
        last_login: new Date().toISOString()
    });

    return userData;
};

// --- User Management ---
export const getUsers = async (): Promise<User[]> => {
    if (isDemo) { await delay(200); return [...mockDb.users]; }
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => convertSnapshot<User>(doc));
};

export const addUser = async (userData: Partial<User>) => {
    if (isDemo) {
        const newUser = { ...userData, id: generateId(), user_id: generateId(), created_at: new Date().toISOString() } as User;
        mockDb.users.push(newUser);
        return;
    }
    const newUserRef = db.collection('users').doc();
    await newUserRef.set({
        ...userData,
        email: userData.email?.trim(),
        user_id: newUserRef.id,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        avatar_url: userData.avatar_url || ''
    });
};

export const updateUser = async (userId: string, data: Partial<User>) => {
    if (isDemo) {
        const index = mockDb.users.findIndex(u => u.id === userId);
        if (index !== -1) mockDb.users[index] = { ...mockDb.users[index], ...data };
        return;
    }
    const cleanData = { ...data };
    if (cleanData.email) cleanData.email = cleanData.email.trim();
    await db.collection('users').doc(userId).update(cleanData);
};

export const deleteUser = async (userId: string) => {
    if (isDemo) {
        mockDb.users = mockDb.users.filter(u => u.id !== userId);
        return;
    }
    await db.collection('users').doc(userId).delete();
};


// --- System ---
export const clearDatabase = async () => {
    if (isDemo) {
        disableDemoMode();
        // Re-seed demo user so we don't crash
        enableDemoMode(); 
        return;
    }
    const collections = ['projects', 'apartments', 'clients', 'contracts', 'payments'];
    for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) continue;
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
};

// --- Projects ---
export const getProjects = async (): Promise<Project[]> => {
  if (isDemo) { await delay(200); return [...mockDb.projects]; }
  const snapshot = await db.collection('projects').get();
  return snapshot.docs.map(doc => convertSnapshot<Project>(doc));
};

export const addProject = async (project: Partial<Project>, userId: string) => {
  if (isDemo) {
      const newProject = { ...project, id: generateId(), project_id: generateId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId } as Project;
      mockDb.projects.push(newProject);
      return;
  }
  await db.collection('projects').add({
    ...project,
    created_by: userId,
    updated_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

export const updateProject = async (projectId: string, data: Partial<Project>, userId: string) => {
  if (isDemo) {
      const index = mockDb.projects.findIndex(p => p.id === projectId);
      if (index !== -1) mockDb.projects[index] = { ...mockDb.projects[index], ...data, updated_at: new Date().toISOString() };
      return;
  }
  await db.collection('projects').doc(projectId).update({
    ...data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
};

export const deleteProject = async (projectId: string) => {
    if (isDemo) {
        mockDb.projects = mockDb.projects.filter(p => p.id !== projectId);
        mockDb.apartments = mockDb.apartments.filter(a => a.project_id !== projectId);
        return;
    }
    const batch = db.batch();
    const projectRef = db.collection('projects').doc(projectId);
    batch.delete(projectRef);
    
    const apts = await db.collection('apartments').where('project_id', '==', projectId).get();
    apts.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
};

// --- Apartments ---
export const getApartments = async (): Promise<Apartment[]> => {
  if (isDemo) { await delay(200); return [...mockDb.apartments]; }
  const snapshot = await db.collection('apartments').get();
  return snapshot.docs.map(doc => convertSnapshot<Apartment>(doc));
};

export const addApartment = async (apartment: Partial<Apartment>, userId: string) => {
  if (isDemo) {
      const newApt = { ...apartment, id: generateId(), apartment_id: generateId(), status: ApartmentStatus.Available, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId } as Apartment;
      mockDb.apartments.push(newApt);
      return;
  }
  await db.collection('apartments').add({
    ...apartment,
    status: ApartmentStatus.Available, // Default status
    created_by: userId,
    updated_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

export const updateApartment = async (apartmentId: string, data: Partial<Apartment>, userId: string) => {
  if (isDemo) {
      const index = mockDb.apartments.findIndex(a => a.id === apartmentId);
      if (index !== -1) mockDb.apartments[index] = { ...mockDb.apartments[index], ...data, updated_at: new Date().toISOString() };
      return;
  }
  await db.collection('apartments').doc(apartmentId).update({
    ...data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
};

export const deleteApartment = async (apartment: Apartment) => {
    if (isDemo) {
        const hasContracts = mockDb.contracts.some(c => c.apartment_id === apartment.id);
        if (hasContracts) throw new Error("Impossible de supprimer cette propriété car elle a un historique de contrats.");
        mockDb.apartments = mockDb.apartments.filter(a => a.id !== apartment.id);
        return;
    }
    const contractsQuery = await db.collection("contracts").where("apartment_id", "==", apartment.id).get();
    
    if (!contractsQuery.empty) {
        throw new Error("Impossible de supprimer cette propriété car elle a un historique de contrats (actifs ou terminés). Veuillez d'abord supprimer ou archiver les contrats associés.");
    }
    
    await db.collection('apartments').doc(apartment.id).delete();
};

// --- Clients ---
export const getClients = async (): Promise<Client[]> => {
  if (isDemo) { await delay(200); return [...mockDb.clients]; }
  const snapshot = await db.collection('clients').get();
  return snapshot.docs.map(doc => convertSnapshot<Client>(doc));
};

export const addClient = async (client: Partial<Client>, userId: string) => {
  if (isDemo) {
      const newClient = { ...client, id: generateId(), client_id: generateId(), contracts: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId } as Client;
      mockDb.clients.push(newClient);
      return;
  }
  await db.collection('clients').add({
    ...client,
    contracts: [],
    created_by: userId,
    updated_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

export const updateClient = async (clientId: string, data: Partial<Client>, userId: string) => {
  if (isDemo) {
      const index = mockDb.clients.findIndex(c => c.id === clientId);
      if (index !== -1) mockDb.clients[index] = { ...mockDb.clients[index], ...data, updated_at: new Date().toISOString() };
      return;
  }
  await db.collection('clients').doc(clientId).update({
    ...data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
};

export const deleteClient = async (clientId: string) => {
    if (isDemo) {
        const activeContracts = mockDb.contracts.some(c => c.client_id === clientId && c.status === ContractStatus.Active);
        if (activeContracts) throw new Error("Impossible de supprimer un client avec des contrats actifs.");
        mockDb.clients = mockDb.clients.filter(c => c.id !== clientId);
        return;
    }
    const contractsQuery = db.collection("contracts").where("client_id", "==", clientId).where("status", "==", ContractStatus.Active);
    const activeContractsSnapshot = await contractsQuery.get();
    if (!activeContractsSnapshot.empty) {
        throw new Error("Impossible de supprimer un client avec des contrats actifs.");
    }
    const clientRef = db.collection("clients").doc(clientId);
    await clientRef.delete();
};

// --- Contracts ---
export const getContracts = async (): Promise<Contract[]> => {
  if (isDemo) { await delay(200); return [...mockDb.contracts]; }
  const snapshot = await db.collection('contracts').get();
  return snapshot.docs.map(doc => convertSnapshot<Contract>(doc));
};

export const addContract = async (
    contractData: Partial<Contract>, 
    userId: string, 
    initialPaymentData?: Partial<Payment>
) => {
    if (isDemo) {
        const newContractId = generateId();
        const newContract = { ...contractData, id: newContractId, contract_id: newContractId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId } as Contract;
        mockDb.contracts.push(newContract);
        
        // Update Apartment
        const aptIndex = mockDb.apartments.findIndex(a => a.id === contractData.apartment_id);
        if (aptIndex !== -1) {
            mockDb.apartments[aptIndex].status = contractData.type === 'rental' ? ApartmentStatus.Rented : ApartmentStatus.Sold;
            mockDb.apartments[aptIndex].current_contract_id = newContractId;
        }

        // Update Client
        const clientIndex = mockDb.clients.findIndex(c => c.id === contractData.client_id);
        if (clientIndex !== -1) {
            mockDb.clients[clientIndex].contracts = [...(mockDb.clients[clientIndex].contracts || []), newContractId];
        }

        // Initial Payment
        if (initialPaymentData) {
            const newPayment = { ...initialPaymentData, id: generateId(), payment_id: generateId(), contract_id: newContractId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Payment;
            mockDb.payments.push(newPayment);
        }
        return;
    }

    const batch = db.batch();
    
    // Create Contract Ref
    const contractRef = db.collection('contracts').doc();
    const contractId = contractRef.id;

    const newContract = {
        ...contractData,
        contract_id: contractId,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    batch.set(contractRef, newContract);

    // Update Apartment Status
    const apartmentRef = db.collection('apartments').doc(contractData.apartment_id!);
    const newAptStatus = contractData.type === 'rental' ? ApartmentStatus.Rented : ApartmentStatus.Sold;
    
    batch.update(apartmentRef, {
        status: newAptStatus,
        current_contract_id: contractId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });

    // Update Client's contract list
    const clientRef = db.collection('clients').doc(contractData.client_id!);
    batch.update(clientRef, {
        contracts: firebase.firestore.FieldValue.arrayUnion(contractId),
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });

    // Handle initial payment if exists (for sales)
    if (initialPaymentData) {
        const paymentRef = db.collection('payments').doc();
        batch.set(paymentRef, {
            ...initialPaymentData,
            contract_id: contractId,
            client_id: contractData.client_id,
            payment_id: paymentRef.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userId,
        });
    }

    await batch.commit();
};

export const updateContract = async (contractId: string, data: Partial<Contract>, userId: string) => {
  if (isDemo) {
      const index = mockDb.contracts.findIndex(c => c.id === contractId);
      if (index !== -1) mockDb.contracts[index] = { ...mockDb.contracts[index], ...data, updated_at: new Date().toISOString() };
      return;
  }
  await db.collection('contracts').doc(contractId).update({
    ...data,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
};

export const cancelContract = async (contract: Contract, userId: string) => {
    if (isDemo) {
        const index = mockDb.contracts.findIndex(c => c.id === contract.id);
        if (index !== -1) {
            mockDb.contracts[index].status = contract.type === 'sale' ? ContractStatus.SaleCanceled : ContractStatus.Canceled;
        }
        const aptIndex = mockDb.apartments.findIndex(a => a.id === contract.apartment_id);
        if (aptIndex !== -1) {
            mockDb.apartments[aptIndex].status = contract.type === 'sale' ? ApartmentStatus.ForSale : ApartmentStatus.Available;
            mockDb.apartments[aptIndex].current_contract_id = "";
        }
        return;
    }
    const batch = db.batch();
    const contractRef = db.collection('contracts').doc(contract.id);
    batch.update(contractRef, {
        status: contract.type === 'sale' ? ContractStatus.SaleCanceled : ContractStatus.Canceled,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
    const apartmentRef = db.collection('apartments').doc(contract.apartment_id);
    const newAptStatus = contract.type === 'sale' ? ApartmentStatus.ForSale : ApartmentStatus.Available;
    batch.update(apartmentRef, {
        status: newAptStatus,
        current_contract_id: "",
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
    await batch.commit();
};

export const endContract = async (contract: Contract, userId: string) => {
    if (isDemo) {
        const today = new Date();
        const startDate = new Date(contract.start_date);
        let durationMonths = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
        if (today.getDate() > startDate.getDate()) durationMonths += 1;
        durationMonths = Math.max(1, durationMonths);

        const index = mockDb.contracts.findIndex(c => c.id === contract.id);
        if (index !== -1) {
            mockDb.contracts[index] = { 
                ...mockDb.contracts[index], 
                status: ContractStatus.Ended, months_left: 0, end_date: today.toISOString().split('T')[0], duration_months: durationMonths 
            };
        }
        const aptIndex = mockDb.apartments.findIndex(a => a.id === contract.apartment_id);
        if (aptIndex !== -1) {
            mockDb.apartments[aptIndex].status = ApartmentStatus.Available;
            mockDb.apartments[aptIndex].current_contract_id = "";
        }
        return;
    }

    const batch = db.batch();
    const today = new Date();
    const startDate = new Date(contract.start_date);
    let durationMonths = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    if (today.getDate() > startDate.getDate()) durationMonths += 1;
    durationMonths = Math.max(1, durationMonths);

    const contractRef = db.collection('contracts').doc(contract.id);
    batch.update(contractRef, {
        status: ContractStatus.Ended,
        months_left: 0,
        end_date: today.toISOString().split('T')[0],
        duration_months: durationMonths,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });

    const apartmentRef = db.collection('apartments').doc(contract.apartment_id);
    batch.update(apartmentRef, {
        status: ApartmentStatus.Available,
        current_contract_id: "",
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
    await batch.commit();
};

export const renewContract = async (oldContract: Contract, newContractData: Partial<Contract>, userId: string) => {
    if (isDemo) {
        const oldIndex = mockDb.contracts.findIndex(c => c.id === oldContract.id);
        if (oldIndex !== -1) {
            mockDb.contracts[oldIndex].status = ContractStatus.Renewed;
        }
        
        const newContractId = generateId();
        const newContract = { 
            ...newContractData, id: newContractId, contract_id: newContractId, previous_contract_id: oldContract.id,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId
        } as Contract;
        mockDb.contracts.push(newContract);

        const aptIndex = mockDb.apartments.findIndex(a => a.id === oldContract.apartment_id);
        if (aptIndex !== -1) mockDb.apartments[aptIndex].current_contract_id = newContractId;

        const clientIndex = mockDb.clients.findIndex(c => c.id === oldContract.client_id);
        if (clientIndex !== -1) mockDb.clients[clientIndex].contracts.push(newContractId);

        if (oldIndex !== -1) mockDb.contracts[oldIndex].renewed_contract_id = newContractId;
        return;
    }

    const batch = db.batch();
    const oldContractRef = db.collection('contracts').doc(oldContract.id);
    batch.update(oldContractRef, {
        status: ContractStatus.Renewed,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });

    const newContractRef = db.collection('contracts').doc();
    const newContractId = newContractRef.id;
    
    batch.set(newContractRef, {
        ...newContractData,
        contract_id: newContractId,
        previous_contract_id: oldContract.id,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });

    const apartmentRef = db.collection('apartments').doc(oldContract.apartment_id);
    batch.update(apartmentRef, {
        current_contract_id: newContractId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
    
    const clientRef = db.collection('clients').doc(oldContract.client_id);
    batch.update(clientRef, {
        contracts: firebase.firestore.FieldValue.arrayUnion(newContractId),
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });

    batch.update(oldContractRef, {
        renewed_contract_id: newContractId
    });

    await batch.commit();
};

export const deleteContract = async (contractId: string) => {
    if (isDemo) {
        mockDb.payments = mockDb.payments.filter(p => p.contract_id !== contractId);
        
        const contract = mockDb.contracts.find(c => c.id === contractId);
        if (contract) {
            const clientIndex = mockDb.clients.findIndex(c => c.id === contract.client_id);
            if (clientIndex !== -1) {
                mockDb.clients[clientIndex].contracts = mockDb.clients[clientIndex].contracts.filter(id => id !== contractId);
            }
            const aptIndex = mockDb.apartments.findIndex(a => a.id === contract.apartment_id);
            if (aptIndex !== -1 && mockDb.apartments[aptIndex].current_contract_id === contractId) {
                mockDb.apartments[aptIndex].current_contract_id = "";
                mockDb.apartments[aptIndex].status = mockDb.apartments[aptIndex].sale_price_dh ? ApartmentStatus.ForSale : ApartmentStatus.Available;
            }
        }
        mockDb.contracts = mockDb.contracts.filter(c => c.id !== contractId);
        return;
    }

    const paymentsQuery = await db.collection("payments").where("contract_id", "==", contractId).get();
    const batch = db.batch();
    paymentsQuery.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await db.runTransaction(async (transaction) => {
        const contractRef = db.collection("contracts").doc(contractId);
        const contractDoc = await transaction.get(contractRef);
        
        if (!contractDoc.exists) {
            throw new Error("Contrat introuvable.");
        }
        
        const contractData = contractDoc.data() as Contract;
        const clientRef = db.collection("clients").doc(contractData.client_id);
        const apartmentRef = db.collection("apartments").doc(contractData.apartment_id);

        const clientDoc = await transaction.get(clientRef);
        const apartmentDoc = await transaction.get(apartmentRef);
        
        if (clientDoc.exists) {
            const clientData = clientDoc.data() as Client;
            const newContracts = (clientData.contracts || []).filter(c => c !== contractId);
            transaction.update(clientRef, { contracts: newContracts });
        }
        
        if (apartmentDoc.exists) {
            const aptData = apartmentDoc.data() as Apartment;
            if (aptData.current_contract_id === contractId) {
                const newStatus = aptData.sale_price_dh ? ApartmentStatus.ForSale : ApartmentStatus.Available;
                transaction.update(apartmentRef, { 
                    current_contract_id: "",
                    status: newStatus
                });
            }
        }
        
        transaction.delete(contractRef);
    });
};

export const getExpiringContracts = async (): Promise<Contract[]> => {
    if (isDemo) {
        const today = new Date();
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(today.getDate() + 60);
        return mockDb.contracts.filter(c => {
             if (c.status !== ContractStatus.Active || c.type !== 'rental') return false;
             if (!c.end_date) return false;
             const endDate = new Date(c.end_date);
             return endDate <= sixtyDaysFromNow;
        });
    }

    const snapshot = await db.collection('contracts')
        .where('status', '==', ContractStatus.Active)
        .where('type', '==', 'rental')
        .get();
    
    const contracts = snapshot.docs.map(doc => convertSnapshot<Contract>(doc));
    const today = new Date();
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(today.getDate() + 60);

    return contracts.filter(c => {
        if (!c.end_date) return false;
        const endDate = new Date(c.end_date);
        return endDate <= sixtyDaysFromNow;
    });
};

export const syncContractsAndApartments = async (userId: string) => {
    // For demo, no-op or simple logic if needed
    if (isDemo) return;

    const contracts = await getContracts();
    const today = new Date().toISOString().split('T')[0];
    
    const batch = db.batch();
    let hasUpdates = false;

    contracts.forEach(contract => {
        if (contract.type === 'rental' && contract.status === ContractStatus.Active && contract.end_date && contract.end_date < today) {
           // check expiry
        }
    });

    if (hasUpdates) {
        await batch.commit();
    }
};

// --- Payments ---
export const getPayments = async (): Promise<Payment[]> => {
  if (isDemo) { await delay(200); return [...mockDb.payments]; }
  const snapshot = await db.collection('payments').get();
  return snapshot.docs.map(doc => convertSnapshot<Payment>(doc));
};

export const addPayment = async (payment: Partial<Payment>, userId: string) => {
  if (isDemo) {
      const newPayment = { ...payment, id: generateId(), payment_id: generateId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: userId } as Payment;
      mockDb.payments.push(newPayment);
      return;
  }
  await db.collection('payments').add({
    ...payment,
    created_by: userId,
    updated_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

export const cancelPayment = async (paymentId: string, userId: string) => {
    if (isDemo) {
        const index = mockDb.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) mockDb.payments[index].status = PaymentStatus.Canceled;
        return;
    }
    await db.collection('payments').doc(paymentId).update({
        status: PaymentStatus.Canceled,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
};

export const markPaymentAsLate = async (paymentId: string, userId: string) => {
    if (isDemo) {
        const index = mockDb.payments.findIndex(p => p.id === paymentId);
        if (index !== -1) mockDb.payments[index].status = PaymentStatus.Late;
        return;
    }
    await db.collection('payments').doc(paymentId).update({
        status: PaymentStatus.Late,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    });
};

export const getReceiptData = async (paymentId: string): Promise<ReceiptData> => {
    if (isDemo) {
        const payment = mockDb.payments.find(p => p.id === paymentId);
        if (!payment) throw new Error("Paiement non trouvé");
        const client = mockDb.clients.find(c => c.id === payment.client_id);
        const contract = mockDb.contracts.find(c => c.id === payment.contract_id);
        if (!contract) throw new Error("Contrat non trouvé");
        const apartment = mockDb.apartments.find(a => a.id === contract.apartment_id);
        const project = mockDb.projects.find(p => p.id === contract.project_id);

        if (!client || !apartment || !project) throw new Error("Données associées manquantes (Client, Appartement ou Projet)");
        
        return { payment, client, contract, apartment, project };
    }

    const paymentSnap = await db.collection("payments").doc(paymentId).get();
    if (!paymentSnap.exists) throw new Error("Paiement non trouvé");
    const payment = convertSnapshot<Payment>(paymentSnap);

    const clientSnap = await db.collection("clients").doc(payment.client_id).get();
    const client = convertSnapshot<Client>(clientSnap);

    const contractSnap = await db.collection("contracts").doc(payment.contract_id).get();
    const contract = convertSnapshot<Contract>(contractSnap);
    
    const apartmentSnap = await db.collection("apartments").doc(contract.apartment_id).get();
    const apartment = convertSnapshot<Apartment>(apartmentSnap);

    const projectSnap = await db.collection("projects").doc(contract.project_id).get();
    const project = convertSnapshot<Project>(projectSnap);

    return { payment, client, contract, apartment, project };
};

export interface ReservationData {
    contract: Contract;
    client: Client;
    apartment: Apartment;
    project: Project;
    totalPaid: number;
}

export const getReservationData = async (contractId: string): Promise<ReservationData> => {
    if (isDemo) {
        const contract = mockDb.contracts.find(c => c.id === contractId);
        if (!contract) throw new Error("Contrat non trouvé");
        const client = mockDb.clients.find(c => c.id === contract.client_id);
        const apartment = mockDb.apartments.find(a => a.id === contract.apartment_id);
        const project = mockDb.projects.find(p => p.id === contract.project_id);
        
        if (!client || !apartment || !project) throw new Error("Données associées manquantes");

        const totalPaid = mockDb.payments
            .filter(p => p.contract_id === contractId && p.status === PaymentStatus.Paid)
            .reduce((sum, p) => sum + p.amount_dh, 0);

        return { contract, client, apartment, project, totalPaid };
    }

    const contractSnap = await db.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) throw new Error("Contrat non trouvé");
    const contract = convertSnapshot<Contract>(contractSnap);

    const clientSnap = await db.collection("clients").doc(contract.client_id).get();
    const client = convertSnapshot<Client>(clientSnap);

    const apartmentSnap = await db.collection("apartments").doc(contract.apartment_id).get();
    const apartment = convertSnapshot<Apartment>(apartmentSnap);

    const projectSnap = await db.collection("projects").doc(contract.project_id).get();
    const project = convertSnapshot<Project>(projectSnap);

    // Calculate total payments made for this contract (reservation amount)
    const paymentsQuery = await db.collection("payments")
        .where("contract_id", "==", contractId)
        .where("status", "==", PaymentStatus.Paid)
        .get();
    
    const totalPaid = paymentsQuery.docs
        .map(doc => convertSnapshot<Payment>(doc))
        .reduce((sum, p) => sum + p.amount_dh, 0);

    return { contract, client, apartment, project, totalPaid };
};
