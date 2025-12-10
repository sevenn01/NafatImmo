
import React, { useState, useEffect, useRef } from 'react';
import { Payment, Client, Contract, Apartment, Project, ReceiptData } from '../types';
import { CloseIcon, PrinterIcon, FileTextIcon } from '../components/icons/Icons';
import { getReceiptData } from '../services/api';

declare global {
    interface Window {
        html2pdf: any;
    }
}

interface ReceiptProps {
    paymentId: string;
    onClose: () => void;
}

const LabeledField = ({ frLabel, arLabel, value }: { frLabel: string, arLabel: string, value: string | number | null | undefined }) => (
    <div className="relative flex items-end h-8 text-sm">
        <span className="bg-white pr-2 font-medium text-black">{frLabel}</span>
        <div className="flex-grow border-b border-dotted border-black text-center font-semibold text-black">
            <span className="bg-white px-2">{value || ''}</span>
        </div>
        <span className="bg-white pl-2 font-medium text-black" style={{ direction: 'rtl' }}>{arLabel}</span>
    </div>
);

const PaymentCheckbox = ({ label, arLabel, checked }: { label: string, arLabel: string, checked: boolean }) => (
    <div className="flex items-center text-sm">
        <div className="flex items-center">
            <div className="w-4 h-4 border border-black flex justify-center items-center mr-2">
                {checked && <div className="font-bold text-black -translate-y-px">X</div>}
            </div>
            <span className="font-medium text-black w-20">{label}</span>
        </div>
        <div className="flex-grow border-b border-dotted border-black mx-2"></div>
        <span className="font-medium text-black text-right" style={{ direction: 'rtl' }}>{arLabel}</span>
    </div>
);


const ReceiptPage: React.FC<ReceiptProps> = ({ paymentId, onClose }) => {
    const [data, setData] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchReceiptData = async () => {
            if (!paymentId) {
                setError("ID de paiement manquant.");
                setLoading(false);
                return;
            }
            try {
                const receiptData = await getReceiptData(paymentId);
                setData(receiptData);
            } catch (err: any) {
                setError(err.message || "Une erreur est survenue.");
            } finally {
                setLoading(false);
            }
        };

        fetchReceiptData();
    }, [paymentId]);
    
    const handleDownloadPdf = () => {
        const element = receiptRef.current;
        if (element && window.html2pdf) {
            const isRental = data?.contract.type === 'rental';
            const filename = `${isRental ? 'quittance' : 'recu'}_${data?.payment.id.substring(data.payment.id.length - 6)}.pdf`;
            const opt = {
                margin:       0.5,
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'cm', format: 'a4', orientation: 'portrait' }
            };
            window.html2pdf().from(element).set(opt).save();
        } else {
            console.error("html2pdf library not found or receipt element is missing.");
        }
    };
    
    const handlePrint = () => {
        window.print();
    };

    if (!paymentId) return null;
    
    const getPaymentDetailValue = (p: Payment, detail: 'account' | 'bank') => {
        if (detail === 'account') {
            switch (p.payment_method) {
                case 'cheque': return p.cheque_number;
                case 'virement': return p.transfer_series;
                case 'effet': return p.effect_number;
                default: return null;
            }
        }
        if (detail === 'bank') {
            return p.payment_method === 'cheque' ? p.bank_name : null;
        }
        return null;
    };


    const renderContent = () => {
        if (loading) return <div className="p-10 text-center font-sans">Chargement du reçu...</div>;
        if (error) return <div className="p-10 text-center font-sans text-red-500">Erreur: {error}</div>;
        if (!data) return <div className="p-10 text-center font-sans">Aucune donnée à afficher.</div>;

        const { payment, client, contract, apartment, project } = data;
        const isRental = contract.type === 'rental';

        return (
            <div id="printable-receipt" ref={receiptRef} className="bg-white p-8 w-full max-w-4xl mx-auto font-sans flex flex-col text-black" style={{ fontFamily: "'Arial', sans-serif" }}>
                <header className="grid grid-cols-[auto_1fr_auto] items-center border-b-2 border-black pb-4">
                    <div className="flex items-center space-x-2">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        <div className="text-center border-r-2 border-l-2 border-black px-2 py-1">
                            <h1 className="text-xl font-bold tracking-wider">NAFAT IMMO</h1>
                            <p className="text-xs tracking-widest">REAL ESTANE</p>
                        </div>
                    </div>
                     <div className="flex items-center h-full px-4">
                        <div className="w-px h-full bg-black"></div>
                        <div className="text-center text-xs px-4">
                            <p>314 D, 2 éme étage</p>
                            <p>Riad Salam - Agadir</p>
                            <p>Tél.: 06.61.28.33.10</p>
                        </div>
                        <div className="w-px h-full bg-black"></div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-baseline justify-center space-x-4">
                            {isRental ? (
                                <>
                                    <h2 className="text-3xl font-bold">QUITTANCE DE LOYER</h2>
                                    <p className="text-xl font-semibold" style={{direction: 'rtl'}}>إيصال كراء</p>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-4xl font-bold">REÇU</h2>
                                    <p className="text-2xl font-semibold" style={{direction: 'rtl'}}>توصيل</p>
                                </>
                            )}
                        </div>
                        <p className="mt-2 text-lg font-mono tracking-widest">{payment.id.substring(payment.id.length - 6).toUpperCase()}</p>
                    </div>
                </header>

                <main className="mt-6 flex-grow space-y-4 text-sm">
                    <div className="space-y-1 pt-4">
                      <LabeledField frLabel="Dossier N°" arLabel="رقم الملف" value={contract.id.substring(contract.id.length - 6).toUpperCase()} />
                       {isRental ? (
                        <LabeledField frLabel="Loyer Mensuel" arLabel="المبلغ الشهري للكراء" value={`${contract.amount_dh.toLocaleString('fr-FR')} DH`} />
                      ) : (
                        <LabeledField frLabel="Montant Total du Contrat" arLabel="المبلغ الإجمالي للعقد" value={`${contract.amount_dh.toLocaleString('fr-FR')} DH`} />
                      )}
                    </div>
                    
                    <div className="space-y-1 pt-4">
                      <LabeledField frLabel="Nom et Prénom" arLabel="الإسم العائلي و الشخصي" value={client.full_name} />
                      <LabeledField frLabel="Adresse" arLabel="العنوان" value={client.address} />
                    </div>
                    
                    <div className="space-y-1 pt-4">
                        <LabeledField frLabel="Objet" arLabel="الموضوع" value={payment.payment_for} />
                    
                         <div className="flex space-x-8">
                            <div className="flex-1">
                                <LabeledField frLabel="Type" arLabel="النوع" value={apartment.type === 'apartment' ? 'Appartement' : 'Garage'} />
                            </div>
                            <div className="flex-1">
                                <LabeledField frLabel="Programme" arLabel="مشروع" value={project.project_name} />
                            </div>
                        </div>
                        <LabeledField frLabel="Date" arLabel="التاريخ" value={new Date(payment.payment_date).toLocaleDateString('fr-FR')} />
                    </div>

                    <div className="pt-4">
                        <div className="flex justify-between items-center text-sm font-medium">
                           <span className="font-bold text-black">{isRental ? "Montant du Loyer Payé" : "Montant D'AVANCE"}</span>
                           <span className="font-bold text-black" style={{direction: 'rtl'}}>{isRental ? "مبلغ الكراء المؤدى" : "المبلغ المستلم"}</span>
                        </div>
                        <div className="border-2 border-black w-full text-center py-2 mt-1 font-bold text-lg text-black">{`${payment.amount_dh.toLocaleString('fr-FR')} DH`} </div>
                    </div>


                    <div className="pt-6">
                        <h3 className="font-bold text-black text-sm inline-block border-b-2 border-black pb-px">Mode de Paiement <span style={{direction: 'rtl'}} className="ml-4">طريقة الأداء</span></h3>
                        <div className="mt-4 grid grid-cols-1 gap-y-2 text-sm">
                            <PaymentCheckbox label="Espèces" arLabel="نقدا" checked={payment.payment_method === 'especes'} />
                            <PaymentCheckbox label="Virement" arLabel="تحويل" checked={payment.payment_method === 'virement'} />
                            <PaymentCheckbox label="Chèque" arLabel="شيك" checked={payment.payment_method === 'cheque'} />
                        </div>
                        <div className="mt-4 space-y-1 text-sm">
                            <LabeledField frLabel="Compte N°" value={getPaymentDetailValue(payment, 'account')} arLabel="حساب رقم" />
                            <LabeledField frLabel="Banque" value={getPaymentDetailValue(payment, 'bank')} arLabel="بنك" />
                        </div>
                    </div>
                </main>

                <footer className="mt-auto pt-8 flex items-end justify-between space-x-4 text-sm">
                    <div className="w-1/2 border-2 border-black p-2 text-xs">
                       {isRental 
                         ? "Cette quittance annule tous les reçus qui auraient pu être donnés précédemment pour acomptes versés sur le présent terme."
                         : "Le présent reçu est nul non avenu si un des articles du contrat de vente signé et légalisé par le client n'est pas respecté."
                       }
                    </div>
                    <div className="w-1/2 flex justify-end space-x-4">
                        <div className="border-2 border-black w-40 h-24 p-1">
                            <p className="font-bold text-center text-xs">{isRental ? "Locataire" : "Acheteur"} <span style={{direction: 'rtl'}}>{isRental ? "المكتري" : "المشتري"}</span></p>
                        </div>
                        <div className="border-2 border-black w-40 h-24 p-1">
                             <p className="font-bold text-center text-xs">Le Responsable <span style={{direction: 'rtl'}}>المسؤول</span></p>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 overflow-auto">
            <style>
                {`
                    @media print {
                        body > *, .fixed.inset-0 {
                            visibility: hidden;
                        }
                        #printable-receipt, #printable-receipt * {
                            visibility: visible;
                        }
                        #printable-receipt {
                           position: absolute;
                           left: 0;
                           top: 0;
                           width: 100%;
                           height: 100%;
                           margin: 0;
                           padding: 1.5rem; /* Simulate the visual padding */
                           border: none;
                           box-shadow: none;
                           color-adjust: exact;
                           -webkit-print-color-adjust: exact;
                        }
                         @page {
                            size: A4;
                            margin: 0;
                        }
                    }
                `}
            </style>
            <div className="bg-slate-100 rounded-lg shadow-xl w-auto flex flex-col my-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center border-b p-4 bg-white rounded-t-lg">
                    <h3 className="text-lg font-semibold text-gray-800">Aperçu de la {data?.contract.type === 'rental' ? 'Quittance' : 'Reçu'}</h3>
                    <div className="flex items-center space-x-4">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                            <PrinterIcon className="w-4 h-4 mr-2" /> Imprimer
                        </button>
                         <button onClick={handleDownloadPdf} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                            <FileTextIcon className="w-4 h-4 mr-2" /> Télécharger PDF
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close modal">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                 <div className="overflow-y-auto p-4 modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
};

export default ReceiptPage;
