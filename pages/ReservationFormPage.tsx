
import React, { useState, useEffect, useRef } from 'react';
import { ReservationData } from '../services/api';
import { CloseIcon, PrinterIcon, FileTextIcon } from '../components/icons/Icons';
import { getReservationData } from '../services/api';

declare global {
    interface Window {
        html2pdf: any;
    }
}

interface ReservationFormProps {
    contractId: string;
    onClose: () => void;
}

const ReservationFormPage: React.FC<ReservationFormProps> = ({ contractId, onClose }) => {
    const [data, setData] = useState<ReservationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!contractId) {
                setError("ID de contrat manquant.");
                setLoading(false);
                return;
            }
            try {
                const resData = await getReservationData(contractId);
                setData(resData);
            } catch (err: any) {
                setError(err.message || "Une erreur est survenue.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [contractId]);
    
    const handleDownloadPdf = () => {
        const element = printRef.current;
        if (element && window.html2pdf) {
            const filename = `bon_reservation_${data?.contract.id.substring(data.contract.id.length - 6)}.pdf`;
            const opt = {
                margin:       0.5,
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'cm', format: 'a4', orientation: 'portrait' }
            };
            window.html2pdf().from(element).set(opt).save();
        } else {
            console.error("html2pdf library not found or element is missing.");
        }
    };
    
    const handlePrint = () => {
        window.print();
    };

    if (!contractId) return null;

    const renderContent = () => {
        if (loading) return <div className="p-10 text-center font-sans">Chargement du document...</div>;
        if (error) return <div className="p-10 text-center font-sans text-red-500">Erreur: {error}</div>;
        if (!data) return <div className="p-10 text-center font-sans">Aucune donnée à afficher.</div>;

        const { contract, client, apartment, project, totalPaid } = data;
        
        // Helper to format currency
        const formatMoney = (amount: number) => amount ? amount.toLocaleString('fr-FR') : '0';

        // Assuming today as signature date for now, or contract start date
        const signatureDate = new Date(contract.start_date);
        const day = signatureDate.getDate().toString().padStart(2, '0');
        const month = (signatureDate.getMonth() + 1).toString().padStart(2, '0');
        const year = signatureDate.getFullYear();

        const BonDeReservation = () => (
            <div className="bg-white p-8 w-full max-w-4xl mx-auto font-serif text-black leading-relaxed" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                <header className="text-center mb-8">
                    <h1 className="text-2xl font-bold uppercase mb-2">NAFAT IMMO SARL</h1>
                    <h2 className="text-lg font-bold underline mb-4">Projet : {project.project_name}</h2>
                    <p className="font-bold text-sm">Adresse : MIMOZA II LOT 34 ET 15, AIN SBAA, CASABLANCA</p>
                </header>

                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold uppercase">BON DE RÉSERVATION N° : {contract.id.substring(contract.id.length - 6).toUpperCase()}</h2>
                </div>

                <div className="space-y-4 mb-8">
                    <p>Je soussigné(e) : <span className="font-bold">{client.full_name}</span></p>
                    <p>CIN : <span className="font-bold">{client.cin_number}</span></p>
                    <p>Adresse : <span className="font-bold">{client.address}</span></p>
                    <p>Téléphone : <span className="font-bold">{client.phone}</span></p>
                </div>

                <div className="mb-6">
                    <p className="mb-4">
                        Déclare avoir réservé un bien immobilier auprès de la société NAFAT IMMO, dans le cadre du projet {project.project_name}, dont les caractéristiques sont les suivantes :
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Référence de l’appartement : <span className="font-bold">{apartment.name}</span> / {project.project_name}</li>
                        <li>Superficie : <span className="font-bold">{apartment.surface_m2}</span> m²</li>
                        <li>Étage : <span className="font-bold">{apartment.floor || 'RDC'}</span></li>
                        <li>Prix total : <span className="font-bold">{contract.type === 'sale' ? formatMoney(contract.amount_dh) : formatMoney(apartment.price_dh)}</span> MAD</li>
                        <li>Montant de la réservation versé : <span className="font-bold">{formatMoney(totalPaid)}</span> MAD</li>
                        <li>
                            Mode de paiement : 
                            <span className="mx-2">Espèces</span> / 
                            <span className="mx-2">Chèque</span> / 
                            <span className="mx-2">Virement</span> 
                            (rayer la mention inutile)
                        </li>
                    </ul>
                </div>

                <div className="mb-8">
                    <p>
                        Le présent bon de réservation est valable pour une durée de ______ jours à compter de la date de signature. 
                        Passé ce délai, la société se réserve le droit de disposer du bien.
                    </p>
                </div>

                <div className="flex justify-between mt-12 mb-8">
                    <div>
                        <p>Fait à Casablanca, le {day} / {month} / {year}</p>
                        <p className="mt-4 font-bold">Signature du client :</p>
                    </div>
                    <div>
                        <p className="mt-8 font-bold">Signature de la société :</p>
                    </div>
                </div>
            </div>
        );

        const RecuDeReservation = () => (
             <div className="bg-white p-8 w-full max-w-4xl mx-auto font-serif text-black leading-relaxed mt-4 border-t-2 border-dashed border-gray-400 pt-8 page-break-before" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                <header className="text-center mb-8">
                    <h1 className="text-2xl font-bold uppercase mb-2">NAFAT IMMO</h1>
                    <h2 className="text-lg font-bold">Projet : {project.project_name}</h2>
                    <p className="text-sm">Adresse : MIMOZA II LOT 34 ET 15, AIN SBAA, CASABLANCA</p>
                </header>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-blue-600 mb-4">REÇU DE RÉSERVATION N° : {contract.id.substring(contract.id.length - 6).toUpperCase()}</h2>
                    <p className="mb-4">Nous soussignés, la société NAFAT IMMO, reconnaissons avoir reçu de :</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Nom du client : <span className="font-bold border-b border-black inline-block min-w-[200px]">{client.full_name}</span></li>
                        <li>CIN : <span className="font-bold border-b border-black inline-block min-w-[200px]">{client.cin_number}</span></li>
                        <li>Adresse : <span className="font-bold border-b border-black inline-block min-w-[300px]">{client.address}</span></li>
                    </ul>
                </div>

                <div className="mb-6 space-y-2">
                    <p>La somme de : <span className="font-bold border-b border-black inline-block min-w-[150px]">{formatMoney(totalPaid)}</span> MAD</p>
                    <p>En date du : <span className="font-bold">{day} / {month} / {year}</span></p>
                    <p>Mode de paiement : Espèces / Chèque / Virement (rayer la mention inutile)</p>
                </div>

                <div className="mb-6">
                    <p className="mb-2">Concernant la réservation de :</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Référence de l’appartement : <span className="font-bold">{apartment.name}</span></li>
                        <li>Superficie : <span className="font-bold">{apartment.surface_m2}</span> m²</li>
                        <li>Étage : <span className="font-bold">{apartment.floor || 'RDC'}</span></li>
                        <li>Prix total du bien : <span className="font-bold">{contract.type === 'sale' ? formatMoney(contract.amount_dh) : formatMoney(apartment.price_dh)}</span> MAD</li>
                        <li>Montant de réservation versé : <span className="font-bold">{formatMoney(totalPaid)}</span> MAD</li>
                    </ul>
                </div>

                <div className="mb-8">
                    <p>Ce reçu est délivré pour servir et valoir ce que de droit.</p>
                </div>

                <div className="flex justify-between mt-12 mb-8">
                    <div>
                         <p>Fait à Casablanca, le {day} / {month} / {year}</p>
                    </div>
                    <div>
                        <p className="font-bold">Signature de la société :</p>
                        <p className="text-sm mt-8 text-right">(Tampon)</p>
                    </div>
                </div>
            </div>
        );

        return (
            <div ref={printRef} className="bg-gray-100 p-4">
                 {/* Page 1 */}
                <div className="bg-white shadow-lg mb-4 mx-auto max-w-[21cm] min-h-[29.7cm] p-[1cm]">
                    <BonDeReservation />
                </div>
                {/* Page 2 */}
                <div className="bg-white shadow-lg mx-auto max-w-[21cm] min-h-[29.7cm] p-[1cm]">
                    <RecuDeReservation />
                </div>
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
                        .fixed.inset-0 {
                            background: white;
                            position: absolute;
                            overflow: visible;
                        }
                        .modal-content, .modal-content * {
                            visibility: visible;
                        }
                        .modal-content {
                           position: absolute;
                           left: 0;
                           top: 0;
                           width: 100%;
                           margin: 0;
                           padding: 0;
                           background: white;
                        }
                        .shadow-lg {
                            box-shadow: none !important;
                            margin: 0 !important;
                            width: 100% !important;
                            max-width: none !important;
                        }
                         .page-break-before {
                            page-break-before: always;
                        }
                        /* Hide header buttons when printing */
                        .print-hide {
                            display: none !important;
                        }
                    }
                `}
            </style>
            <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-5xl flex flex-col my-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center border-b p-4 bg-white rounded-t-lg print-hide">
                    <h3 className="text-lg font-semibold text-gray-800">Bon de Réservation</h3>
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
                 <div className="overflow-y-auto modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
};

export default ReservationFormPage;
