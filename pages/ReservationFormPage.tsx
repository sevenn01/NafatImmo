
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
            const filename = `bon_reservation_${data?.contract.id.substring(0, 6).toUpperCase()}.pdf`;
            const opt = {
                margin:       [1, 1, 1, 1],
                filename:     filename,
                image:        { type: 'jpeg', quality: 1 },
                html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
                jsPDF:        { unit: 'cm', format: 'a4', orientation: 'portrait' }
            };
            window.html2pdf().from(element).set(opt).save();
        }
    };
    
    const handlePrint = () => { window.print(); };

    if (!contractId) return null;

    const renderContent = () => {
        if (loading) return <div className="p-10 text-center font-sans text-gray-600">Chargement des documents...</div>;
        if (error) return <div className="p-10 text-center font-sans text-red-500 font-bold">Erreur: {error}</div>;
        if (!data) return <div className="p-10 text-center font-sans">Aucune donnée trouvée.</div>;

        const { contract, client, apartment, project, totalPaid } = data;
        const signatureDate = new Date(contract.start_date);
        const day = signatureDate.getDate().toString().padStart(2, '0');
        const month = (signatureDate.getMonth() + 1).toString().padStart(2, '0');
        const year = signatureDate.getFullYear();
        
        const formattedTotal = contract.amount_dh.toLocaleString('fr-FR');
        const formattedPaid = totalPaid.toLocaleString('fr-FR');

        // Layout styles matching the screenshots
        const pageContainer = "bg-white p-12 w-full mx-auto text-black leading-relaxed font-serif mb-10 relative border border-gray-200";
        const headerTitle = "text-2xl font-bold text-center mb-2 uppercase";
        const projectTitle = "text-lg font-bold text-center mb-2";
        const addressText = "text-sm font-semibold text-center mb-10";
        const docTitle = "text-xl font-bold text-center mb-12 uppercase tracking-wide";
        const fieldLabel = "font-medium text-lg mb-4";
        const bulletList = "space-y-4 mb-10 list-none ml-4";
        const signatureRow = "mt-20 flex justify-between font-bold text-lg px-4";

        return (
            <div ref={printRef} className="print:p-0">
                {/* PAGE 1: BON DE RÉSERVATION */}
                <div className={pageContainer} style={{ minHeight: '28cm' }}>
                    <h1 className={headerTitle}>NAFAT IMMO SARL</h1>
                    <h2 className={projectTitle}>Projet : <span className="underline">{project.project_name}</span></h2>
                    <p className={addressText}>Adresse : MIMOZA II LOT 34 ET 15, AIN SBAA, CASABLANCA</p>

                    <h3 className={docTitle}>BON DE RÉSERVATION N° : {contract.id.substring(0, 6).toUpperCase()}</h3>

                    <div className="space-y-6 mb-12">
                        <p className="text-lg">Je soussigné(e) : <span className="font-bold ml-2">{client.full_name}</span></p>
                        <p className="text-lg">CIN : <span className="font-bold ml-2">{client.cin_number}</span></p>
                        <p className="text-lg">Adresse : <span className="font-bold ml-2">{client.address}</span></p>
                        <p className="text-lg">Téléphone : <span className="font-bold ml-2">{client.phone}</span></p>
                    </div>

                    <p className="text-lg mb-8 leading-snug">
                        Déclare avoir réservé un bien immobilier auprès de la société NAFAT IMMO, dans le cadre du projet {project.project_name}, dont les caractéristiques sont les suivantes :
                    </p>

                    <ul className={bulletList}>
                        <li className="text-lg">• Référence de l'appartement : <strong>{apartment.name}</strong> / {project.project_name}</li>
                        <li className="text-lg">• Superficie : <strong>{apartment.surface_m2} m²</strong></li>
                        <li className="text-lg">• Étage : <strong>{apartment.floor || 'RDC'}</strong></li>
                        <li className="text-lg">• Prix total : <strong>{formattedTotal} MAD</strong></li>
                        <li className="text-lg">• Montant de la réservation versé : <strong>{formattedPaid} MAD</strong></li>
                        <li className="text-lg">• Mode de paiement : Espèces  /  Chèque  /  Virement  (rayer la mention inutile)</li>
                    </ul>

                    <p className="text-lg mb-12">
                        Le présent bon de réservation est valable pour une durée de ________ jours à compter de la date de signature. Passé ce délai, la société se réserve le droit de disposer du bien.
                    </p>

                    <div className="mt-16">
                        <p className="text-lg mb-8">Fait à Casablanca, le {day} / {month} / {year}</p>
                        <div className={signatureRow}>
                            <p>Signature du client :</p>
                            <p>Signature de la société :</p>
                        </div>
                    </div>
                </div>

                {/* PAGE BREAK FOR PDF */}
                <div className="html2pdf__page-break"></div>

                {/* PAGE 2: REÇU DE RÉSERVATION */}
                <div className={pageContainer} style={{ minHeight: '28cm' }}>
                    <div className="border-t border-dashed border-gray-400 mb-10 w-full"></div>
                    
                    <h1 className={headerTitle}>NAFAT IMMO</h1>
                    <h2 className={projectTitle}>Projet : <span className="underline">{project.project_name}</span></h2>
                    <p className={addressText}>Adresse : MIMOZA II LOT 34 ET 15, AIN SBAA, CASABLANCA</p>

                    <h3 className="text-xl font-bold text-center uppercase text-blue-600 mb-10 tracking-widest">
                        REÇU DE RÉSERVATION N° : {contract.id.substring(0, 6).toUpperCase()}
                    </h3>

                    <p className="text-lg mb-8">Nous soussignés, la société NAFAT IMMO, reconnaissons avoir reçu de :</p>

                    <div className="space-y-6 mb-10">
                        <div className="flex items-end text-lg">
                            <span className="font-bold min-w-[160px]">• Nom du client :</span>
                            <span className="flex-grow border-b border-black font-bold pb-1 ml-2">{client.full_name}</span>
                        </div>
                        <div className="flex items-end text-lg">
                            <span className="font-bold min-w-[160px]">• CIN :</span>
                            <span className="flex-grow border-b border-black font-bold pb-1 ml-2">{client.cin_number}</span>
                        </div>
                        <div className="flex items-end text-lg">
                            <span className="font-bold min-w-[160px]">• Adresse :</span>
                            <span className="flex-grow border-b border-black font-bold pb-1 ml-2">{client.address}</span>
                        </div>
                    </div>

                    <div className="space-y-6 mb-10 text-lg">
                        <p>La somme de : <span className="font-bold text-xl border-b border-black px-6">{formattedPaid}</span> MAD</p>
                        <p>En date du : <span className="font-bold">{day} / {month} / {year}</span></p>
                        <p>Mode de paiement : Espèces / Chèque / Virement (rayer la mention inutile)</p>
                    </div>

                    <div className="mt-12 mb-10">
                        <p className="font-bold text-lg mb-4">Concernant la réservation de :</p>
                        <ul className="space-y-3 ml-6">
                            <li className="text-lg">• Référence de l'appartement : <strong>{apartment.name}</strong></li>
                            <li className="text-lg">• Superficie : <strong>{apartment.surface_m2} m²</strong></li>
                            <li className="text-lg">• Étage : <strong>{apartment.floor || 'RDC'}</strong></li>
                            <li className="text-lg">• Prix total du bien : <strong>{formattedTotal} MAD</strong></li>
                            <li className="text-lg">• Montant de réservation versé : <strong>{formattedPaid} MAD</strong></li>
                        </ul>
                    </div>

                    <p className="text-lg mb-16 italic font-medium">Ce reçu est délivré pour servir et valoir ce que de droit.</p>

                    <div className="flex justify-between items-start text-lg">
                        <div>
                            <p className="mb-4">Fait à Casablanca, le {day} / {month} / {year}</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold mb-20 underline">Signature de la société :</p>
                            <p className="text-sm text-gray-500 font-sans">(Tampon)</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-start p-4 overflow-auto backdrop-blur-sm">
             <style>
                {`
                    @media print {
                        body > *, .fixed.inset-0 { visibility: hidden; }
                        .modal-content, .modal-content * { visibility: visible; }
                        .modal-content { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
                        .print-hide { display: none !important; }
                    }
                `}
            </style>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col my-4 md:my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center bg-gray-900 px-6 py-4 print-hide">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <FileTextIcon className="w-5 h-5 mr-3 text-green-400" />
                        Bon de Réservation & Reçu
                    </h3>
                    <div className="flex items-center space-x-3">
                        <button onClick={handlePrint} className="flex items-center px-5 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 text-sm font-bold shadow-lg transition-all active:scale-95">
                            <PrinterIcon className="w-4 h-4 mr-2" /> Imprimer
                        </button>
                        <button onClick={handleDownloadPdf} className="flex items-center px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 text-sm font-bold shadow-lg transition-all active:scale-95">
                            <FileTextIcon className="w-4 h-4 mr-2" /> Télécharger PDF
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors bg-gray-800 rounded-full ml-4">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                 <div className="overflow-y-auto bg-gray-100 p-6 md:p-10 modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
};

export default ReservationFormPage;
