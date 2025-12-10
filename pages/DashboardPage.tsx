
import React, { useState, useEffect, useMemo } from 'react';
import { getContracts, getClients, getPayments, getExpiringContracts, getProjects, getApartments, syncContractsAndApartments } from '../services/api';
import { Contract, Client, Payment, ContractStatus, Project, Apartment, ApartmentStatus, PaymentStatus } from '../types';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DashboardSection from '../components/DashboardSection';
import { DollarSignIcon, AlertTriangleIcon, TrendingUpIcon, HomeIcon, FileTextIcon, BuildingIcon, CoinsIcon, ClockIcon, PlusIcon } from '../components/icons/Icons';
import { useAuth } from '../auth/AuthContext';

interface OverduePaymentInfo {
    client: Client;
    contract: Contract;
    monthsOverdue: number;
    apartment?: Apartment;
}

interface UnpaidExpiredInfo {
    client?: Client;
    contract: Contract;
    apartment?: Apartment;
    unpaidMonths: number;
}

interface UnsettledSaleInfo {
    client?: Client;
    contract: Contract;
    apartment?: Apartment;
    totalPaid: number;
    remaining: number;
}


type TimePeriod = 'this_month' | 'last_month' | 'last_3_months' | 'all_time';

const DashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [apartments, setApartments] = useState<Apartment[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expiringContracts, setExpiringContracts] = useState<Contract[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_month');
    const { user } = useAuth();

    useEffect(() => {
        const fetchDataAndSync = async () => {
            if (!user) return;
            try {
                setLoading(true);

                // First, sync expired contracts to ensure data integrity
                await syncContractsAndApartments(user.user_id);
                
                // Then, fetch all data
                const [apartmentsData, contractsData, clientsData, paymentsData, expiringData, projectsData] = await Promise.all([
                    getApartments(),
                    getContracts(),
                    getClients(),
                    getPayments(),
                    getExpiringContracts(),
                    getProjects()
                ]);
                setApartments(apartmentsData);
                setContracts(contractsData);
                setClients(clientsData);
                setPayments(paymentsData);
                setExpiringContracts(expiringData);
                setProjects(projectsData);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDataAndSync();
    }, [user]);

    const activeContracts = useMemo(() => contracts.filter(c => c.status === ContractStatus.Active), [contracts]);

    const timeFilteredPayments = useMemo(() => {
        const now = new Date();
        let startDate: Date;

        switch (timePeriod) {
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
                 return payments.filter(p => {
                    const paymentDate = new Date(p.payment_date);
                    return p.status === PaymentStatus.Paid && paymentDate >= startDate && paymentDate <= lastMonthEndDate;
                });
            case 'last_3_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                return payments.filter(p => {
                    const paymentDate = new Date(p.payment_date);
                    return p.status === PaymentStatus.Paid && paymentDate >= startDate;
                });
            case 'all_time':
                return payments.filter(p => p.status === PaymentStatus.Paid);
            case 'this_month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                return payments.filter(p => {
                    const paymentDate = new Date(p.payment_date);
                    return p.status === PaymentStatus.Paid && paymentDate >= startDate;
                });
        }
    }, [payments, timePeriod]);
    
    const rentalRevenue = useMemo(() => {
        const rentalContractIds = new Set(contracts.filter(c => c.type === 'rental').map(c => c.id));
        return timeFilteredPayments
            .filter(p => rentalContractIds.has(p.contract_id))
            .reduce((sum, p) => sum + p.amount_dh, 0);
    }, [timeFilteredPayments, contracts]);

    const salesRevenue = useMemo(() => {
        const saleContractIds = new Set(contracts.filter(c => c.type === 'sale').map(c => c.id));
        return timeFilteredPayments
            .filter(p => saleContractIds.has(p.contract_id))
            .reduce((sum, p) => sum + p.amount_dh, 0);
    }, [timeFilteredPayments, contracts]);


    const rentedApartmentsCount = useMemo(() => apartments.filter(a => a.status === ApartmentStatus.Rented).length, [apartments]);
    const soldApartmentsCount = useMemo(() => apartments.filter(a => a.status === ApartmentStatus.Sold).length, [apartments]);
    
    const occupancyRate = useMemo(() => {
        const rentableApartments = apartments.filter(a => a.status !== ApartmentStatus.Sold && a.status !== ApartmentStatus.Maintenance).length;
        if (rentableApartments === 0) return 0;
        return (rentedApartmentsCount / rentableApartments) * 100;
    }, [apartments, rentedApartmentsCount]);

    const overduePaymentsInfo = useMemo<OverduePaymentInfo[]>(() => {
        const today = new Date();
        const overdue: OverduePaymentInfo[] = [];
        
        activeContracts.filter(c => c.type === 'rental').forEach(contract => {
            const startDate = new Date(contract.start_date);
            const monthlyRent = contract.amount_dh;
            
            let monthsElapsed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
            if (today.getDate() >= startDate.getDate()) {
                monthsElapsed += 1;
            }
            if (contract.duration_months && monthsElapsed > contract.duration_months) {
                monthsElapsed = contract.duration_months;
            }

            const expectedTotal = Math.max(0, monthsElapsed * monthlyRent);

            const totalPaid = payments
                .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid)
                .reduce((sum, p) => sum + p.amount_dh, 0);

            if (totalPaid < expectedTotal - 1) {
                const remainingDebt = expectedTotal - totalPaid;
                const monthsOverdue = Math.ceil(remainingDebt / monthlyRent);
                
                if (monthsOverdue > 0) {
                     const client = clients.find(c => c.id === contract.client_id);
                     const apartment = apartments.find(a => a.id === contract.apartment_id);
                     if (client) {
                        overdue.push({ client, contract, monthsOverdue, apartment });
                     }
                }
            }
        });
        return overdue;
    }, [activeContracts, payments, clients, apartments]);
    
    const unpaidExpiredContractsInfo = useMemo<UnpaidExpiredInfo[]>(() => {
        const today = new Date().toISOString().split('T')[0];
        const endedOrExpiredContracts = contracts.filter(c => 
            c.type === 'rental' && 
            (c.status === ContractStatus.Ended || (c.status === ContractStatus.Active && c.end_date && c.end_date < today))
        );
        const results: UnpaidExpiredInfo[] = [];

        endedOrExpiredContracts.forEach(contract => {
            let duration = contract.duration_months || 0;
            if (contract.status === ContractStatus.Ended && contract.end_date && contract.start_date) {
                const start = new Date(contract.start_date);
                const end = new Date(contract.end_date);
                let dateDiffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                if (end.getDate() >= start.getDate()) dateDiffMonths++;
                if (dateDiffMonths > 0) {
                    duration = dateDiffMonths;
                }
            }

            const monthlyRent = contract.amount_dh || 0;
            const expectedTotal = duration * monthlyRent;

            const totalPaid = payments
                .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid)
                .reduce((sum, p) => sum + p.amount_dh, 0);

            if (totalPaid < expectedTotal - 1) {
                const unpaidAmount = expectedTotal - totalPaid;
                const unpaidMonths = Math.ceil(unpaidAmount / monthlyRent);
                
                results.push({
                    contract,
                    client: clients.find(c => c.id === contract.client_id),
                    apartment: apartments.find(a => a.id === contract.apartment_id),
                    unpaidMonths: unpaidMonths,
                });
            }
        });
        return results;
    }, [contracts, payments, clients, apartments]);

    const unsettledSalesInfo = useMemo<UnsettledSaleInfo[]>(() => {
        const saleContracts = contracts.filter(c => c.type === 'sale');
        const results: UnsettledSaleInfo[] = [];
        
        saleContracts.forEach(contract => {
            const totalPaid = payments
                .filter(p => p.contract_id === contract.id && p.status === PaymentStatus.Paid)
                .reduce((sum, p) => sum + p.amount_dh, 0);
            
            if (totalPaid < contract.amount_dh) {
                results.push({
                    contract,
                    client: clients.find(c => c.id === contract.client_id),
                    apartment: apartments.find(a => a.id === contract.apartment_id),
                    totalPaid,
                    remaining: contract.amount_dh - totalPaid
                });
            }
        });
        return results;
    }, [contracts, payments, clients, apartments]);
    
    const totalOverdueAndUnpaidCount = useMemo(() => {
        return overduePaymentsInfo.length + unpaidExpiredContractsInfo.length + unsettledSalesInfo.length;
    }, [overduePaymentsInfo, unpaidExpiredContractsInfo, unsettledSalesInfo]);


    const expiringContractsInfo = useMemo(() => {
        return expiringContracts.map(contract => ({
            client: clients.find(c => c.id === contract.client_id),
            apartment: apartments.find(a => a.id === contract.apartment_id),
            contract
        })).filter(item => item.client && item.apartment) as { client: Client, contract: Contract, apartment: Apartment }[];
    }, [expiringContracts, clients, apartments]);

    const recentlyEndedRentals = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return contracts.filter(c => 
            c.type === 'rental' && 
            c.status === ContractStatus.Ended && 
            c.end_date && 
            new Date(c.end_date) >= thirtyDaysAgo &&
            new Date(c.end_date) <= tomorrow
        ).map(contract => ({
            client: clients.find(c => c.id === contract.client_id),
            apartment: apartments.find(a => a.id === contract.apartment_id),
            contract
        }));
    }, [contracts, clients, apartments]);


    const renderOverdueList = (minMonths: number, maxMonths: number) => {
        const filtered = overduePaymentsInfo.filter(p => p.monthsOverdue >= minMonths && p.monthsOverdue <= maxMonths);
        if (filtered.length === 0) return <p className="text-sm text-gray-500 text-center py-4">Aucun.</p>;
        return (
             <ul className="divide-y divide-gray-100">
                {filtered.map(({ client, apartment, monthsOverdue }) => (
                    <li key={client.id} className="py-3 px-1">
                        <Link to={`/clients/${client.id}`} className="flex justify-between items-center group">
                            <div>
                               <p className="text-sm font-medium text-gray-800 group-hover:text-green-600">{(client.full_name || 'Client')}</p>
                               <p className="text-xs text-gray-500">{apartment?.name}</p>
                            </div>
                            <span className="text-sm font-bold text-red-600">{monthsOverdue} mois</span>
                        </Link>
                    </li>
                ))}
            </ul>
        )
    };
    
    const TimePeriodButton: React.FC<{period: TimePeriod, label: string}> = ({ period, label }) => {
        const isActive = timePeriod === period;
        return (
            <button
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    isActive ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
                {label}
            </button>
        )
    }

    if (loading) return <div className="flex justify-center items-center h-64"><div>Chargement du tableau de bord...</div></div>;

    // Empty state check
    if (projects.length === 0 && apartments.length === 0 && clients.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="bg-green-100 p-6 rounded-full mb-6">
                    <BuildingIcon className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Bienvenue sur Nafat Immobilier</h2>
                <p className="text-gray-600 max-w-md mb-8">Votre application est prête. Commencez par créer votre premier projet immobilier.</p>
                <Link 
                    to="/projets"
                    className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Créer un Projet
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-gray-800">Tableau de Bord</h2>
                <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg overflow-x-auto">
                    <TimePeriodButton period="this_month" label="Ce mois-ci" />
                    <TimePeriodButton period="last_month" label="Mois dernier" />
                    <TimePeriodButton period="last_3_months" label="3 derniers mois" />
                    <TimePeriodButton period="all_time" label="Tout" />
                </div>
            </div>

            {/* Notification Section */}
            <div className="mb-8 space-y-4">
                 {/* 1. Expired / Ended Recently */}
                 {recentlyEndedRentals.length > 0 && (
                    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <ClockIcon className="h-5 w-5 text-orange-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-orange-800">Contrats de location terminés récemment</h3>
                                <div className="mt-2 text-sm text-orange-700">
                                    <ul className="list-disc pl-5 space-y-1">
                                        {recentlyEndedRentals.map(({ contract, apartment, client }) => (
                                            <li key={contract.id}>
                                                Contrat pour <strong>{apartment?.name}</strong> ({client?.full_name}) terminé le {new Date(contract.end_date!).toLocaleDateString('fr-FR')}.
                                                <Link to={`/contrats`} className="ml-2 underline hover:text-orange-900 font-medium">Voir</Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 2. Unsettled Sales */}
                {unsettledSalesInfo.length > 0 && (
                     <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <CoinsIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">Ventes non soldées (Reste à payer)</h3>
                                <div className="mt-2 text-sm text-blue-700">
                                    <ul className="list-disc pl-5 space-y-1">
                                        {unsettledSalesInfo.map(({ contract, apartment, client, remaining }) => (
                                            <li key={contract.id}>
                                                <strong>{apartment?.name}</strong> ({client?.full_name}) - Reste: <strong>{remaining.toLocaleString()} DH</strong>
                                                <Link to={`/clients/${client?.id}`} className="ml-2 underline hover:text-blue-900 font-medium">Détails</Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 3. Unpaid Expired Contracts */}
                {unpaidExpiredContractsInfo.length > 0 && (
                     <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangleIcon className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Contrats terminés/expirés avec impayés</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <ul className="list-disc pl-5 space-y-1">
                                        {unpaidExpiredContractsInfo.map(({ contract, apartment, client, unpaidMonths }) => (
                                            <li key={contract.id}>
                                                <strong>{apartment?.name}</strong> ({client?.full_name}) - <strong>{unpaidMonths} mois impayés</strong>
                                                <Link to={`/clients/${client?.id}`} className="ml-2 underline hover:text-red-900 font-medium">Voir le client</Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    title="Revenus Locatifs"
                    value={`${rentalRevenue.toLocaleString()} DH`}
                    icon={<DollarSignIcon />}
                    color="green"
                />
                <StatCard 
                    title="Revenus Ventes"
                    value={`${salesRevenue.toLocaleString()} DH`}
                    icon={<DollarSignIcon />}
                    color="purple"
                />
                 <StatCard 
                    title="Propriétés Louées"
                    value={rentedApartmentsCount}
                    icon={<HomeIcon />}
                    color="blue"
                />
                <StatCard 
                    title="Taux d'Occupation"
                    value={`${occupancyRate.toFixed(1)}%`}
                    icon={<TrendingUpIcon />}
                    color="indigo"
                />
                <StatCard 
                    title="Paiements en Retard / Impayés"
                    value={totalOverdueAndUnpaidCount}
                    icon={<AlertTriangleIcon />}
                    color="red"
                />
                <StatCard 
                    title="Propriétés Vendues"
                    value={`${soldApartmentsCount}`}
                    icon={<BuildingIcon />}
                    color="yellow"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DashboardSection 
                    title="Suivi des Paiements en Retard (Contrats Actifs)"
                    icon={<AlertTriangleIcon className="text-red-500"/>}
                    className="lg:col-span-2"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6">
                        <div className="border-r border-gray-100 sm:pr-4">
                            <h4 className="font-semibold text-gray-700 mb-2 text-center text-sm border-b pb-2">1 Mois de Retard</h4>
                            {renderOverdueList(1, 1)}
                        </div>
                        <div className="border-r border-gray-100 sm:pr-4">
                            <h4 className="font-semibold text-gray-700 mb-2 text-center text-sm border-b pb-2">2 Mois de Retard</h4>
                            {renderOverdueList(2, 2)}
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2 text-center text-sm border-b pb-2">3+ Mois de Retard</h4>
                            {renderOverdueList(3, Infinity)}
                        </div>
                    </div>
                </DashboardSection>

                <DashboardSection
                    title="Contrats Expirés et Impayés"
                    icon={<AlertTriangleIcon className="text-orange-500" />}
                >
                     {unpaidExpiredContractsInfo.length > 0 ? (
                        <ul className="divide-y divide-gray-100 -mx-6 -my-6">
                            {unpaidExpiredContractsInfo.map(({ client, contract, apartment, unpaidMonths }) => (
                                <li key={contract.id} className="py-3 px-6 hover:bg-gray-50/50">
                                    <Link to={`/clients/${client?.id}`} className="flex justify-between items-center group">
                                      <div>
                                          <p className="text-sm font-medium text-gray-800 group-hover:text-green-600">{(client?.full_name || 'Client')}</p>
                                          <p className="text-xs text-gray-500">{apartment?.name}</p>
                                      </div>
                                      <span className="text-sm text-red-600 font-bold">{unpaidMonths} mois impayé{unpaidMonths > 1 ? 's' : ''}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-gray-500 text-center py-4">Aucun contrat expiré impayé.</p>}
                </DashboardSection>

                <DashboardSection
                    title="Contrats Expirant Bientôt"
                    icon={<FileTextIcon className="text-yellow-500" />}
                >
                    {expiringContractsInfo.length > 0 ? (
                        <ul className="divide-y divide-gray-100 -mx-6 -my-6">
                            {expiringContractsInfo.map(({ client, contract, apartment }) => (
                                <li key={contract.id} className="py-3 px-6 hover:bg-gray-50/50">
                                    <Link to={`/clients/${client?.id}`} className="flex justify-between items-center group">
                                      <div>
                                          <p className="text-sm font-medium text-gray-800 group-hover:text-green-600">{(client?.full_name || 'Client')}</p>
                                          <p className="text-xs text-gray-500">{apartment?.name}</p>
                                      </div>
                                      <span className="text-sm text-gray-600 font-medium">{new Date(contract.end_date!).toLocaleDateString('fr-FR')}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-gray-500 text-center py-4">Aucun contrat n'expire dans les 60 prochains jours.</p>}
                </DashboardSection>
            </div>
        </div>
    );
};

export default DashboardPage;
