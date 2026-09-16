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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
      <div 
        id="printable-tire-rotation"
        className="bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full"
      >
        
        {/* Header - Not printed */}
        <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-800/50 print:hidden">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
              Comprovante de Rodízio de Pneus
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-100 text-sky-800">
              {rotationLog.vehiclePlate}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0963cb] hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Documento</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-5 text-stone-900 bg-white print:p-2 print:overflow-visible">
          
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
  );
};
