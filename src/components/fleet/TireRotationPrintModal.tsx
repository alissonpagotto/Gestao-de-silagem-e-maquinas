import React from 'react';
import { X, Printer } from 'lucide-react';
import { TireRotationLog, Machinery, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';
import { getPositionReadableLabel } from '../../lib/tireAndAxlePresets';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';

interface TireRotationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  rotationLog: TireRotationLog | null;
  vehicle: Machinery | null;
  companyProfile?: CompanyProfile;
}

export const TireRotationPrintModal: React.FC<TireRotationPrintModalProps> = ({
  isOpen,
  onClose,
  rotationLog,
  vehicle,
  companyProfile,
}) => {
  if (!isOpen || !rotationLog) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
      <div 
        id="printable-tire-rotation"
        className="bg-[#cad4e6] rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] border border-black shadow-2xl flex flex-col justify-between mx-auto my-auto overflow-hidden print:h-auto print:max-h-none print:max-w-none print:shadow-none print:border-none print:rounded-none print:w-full print:bg-white"
      >
        
        {/* Header - Not printed */}
        <div className="px-5 py-3 border-b border-black flex items-center justify-between bg-[#cad4e6] shrink-0 print:hidden">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-black text-black font-['Outfit']">
              Comprovante de Rodízio de Pneus
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-white border border-black text-black">
              {rotationLog.vehiclePlate}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Documento</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#cad4e6] print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-4xl mx-auto p-6 sm:p-8 space-y-5 text-stone-900 bg-white border border-black rounded-xl shadow-md print:max-w-none print:border-none print:rounded-none print:shadow-none print:p-2">
          
          {/* Cabeçalho Corporativo Padronizado */}
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle="COMPROVANTE DE RODÍZIO DE PNEUS"
            reportSubtitle={`Data da Operação: ${formatDateBR(rotationLog.date)}`}
            documentTypeBadge={`O.S. RODÍZIO Nº ${rotationLog.id.slice(-6).toUpperCase()}`}
          />

          {/* Dados do Veículo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-stone-50 border border-stone-200 text-xs break-inside-avoid">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Veículo / Placa</span>
              <span className="font-extrabold text-stone-900 text-sm">{rotationLog.vehiclePlate}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Modelo / Marca</span>
              <span className="font-semibold text-stone-800">{rotationLog.vehicleModel || vehicle?.model || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">KM Atual</span>
              <span className="font-semibold text-stone-800">{rotationLog.kmAtRotation ? `${rotationLog.kmAtRotation.toLocaleString('pt-BR')} km` : '-'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Horímetro Atual</span>
              <span className="font-semibold text-stone-800">{rotationLog.hourMeterAtRotation ? `${rotationLog.hourMeterAtRotation.toLocaleString('pt-BR')} h` : '-'}</span>
            </div>
          </div>

          {/* Tipo de Rodízio */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-sky-200 bg-sky-50/60 text-xs break-inside-avoid">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#0963cb] block">Tipo de Rodízio Executado</span>
              <span className="font-bold text-stone-900 text-sm">{rotationLog.rotationTypeName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#0963cb] block">Operador / Responsável</span>
              <span className="font-semibold text-stone-900">{rotationLog.operatorName || 'Oficina Própria'}</span>
            </div>
            {rotationLog.cost ? (
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0963cb] block">Custo do Serviço</span>
                <span className="font-extrabold text-stone-900">{formatCurrencyBRL(rotationLog.cost)}</span>
              </div>
            ) : null}
          </div>

          {/* Tabela de Movimentações */}
          <div className="space-y-2 break-inside-avoid">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Movimentação e Posicionamento dos Pneus
            </h4>
            <table className="w-full border border-stone-200 text-xs rounded-lg overflow-hidden text-left">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                <tr>
                  <th className="p-2.5">Código / Fogo</th>
                  <th className="p-2.5">Posição Anterior</th>
                  <th className="p-2.5">Nova Posição</th>
                  <th className="p-2.5 text-center">Sulco Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {rotationLog.tireMovements.map((mov, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                    <td className="p-2.5 font-bold text-stone-900">{mov.fireNumber}</td>
                    <td className="p-2.5 text-stone-600">
                      <span className="px-1.5 py-0.5 rounded bg-stone-100 font-bold text-[11px] mr-1">{mov.fromPosition}</span>
                      {getPositionReadableLabel(mov.fromPosition)}
                    </td>
                    <td className="p-2.5 text-stone-900 font-bold">
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[11px] mr-1">{mov.toPosition}</span>
                      {getPositionReadableLabel(mov.toPosition)}
                    </td>
                    <td className="p-2.5 text-center font-bold text-stone-800">
                      {mov.treadDepthMm ? `${mov.treadDepthMm.toFixed(1)} mm` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observações */}
          {rotationLog.notes && (
            <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 text-xs break-inside-avoid">
              <span className="text-[10px] uppercase font-bold text-stone-500 block mb-0.5">Observações da Operação</span>
              <p className="text-stone-700">{rotationLog.notes}</p>
            </div>
          )}

          {/* Rodapé Corporativo Padronizado com Assinaturas */}
          <PrintReportFooter
            showSignatures={true}
            signatureLabels={['Responsável Técnico / Mecânico', 'Gestor de Frota / Encarregado']}
            companyName={companyProfile?.tradeName || 'Silagem Fácil ERP'}
            authCode={`ROD-${rotationLog.id.slice(-6).toUpperCase()}`}
          />

          </div>
        </div>

      </div>
    </div>
  );
};
