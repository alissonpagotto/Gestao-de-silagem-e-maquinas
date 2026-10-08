import React from 'react';
import { FleetVehiclesView, FleetVehiclesViewProps } from './FleetVehiclesView';

export type VehiclesTabProps = FleetVehiclesViewProps;

export const VehiclesTab: React.FC<VehiclesTabProps> = (props) => {
  return <FleetVehiclesView {...props} />;
};

export default VehiclesTab;
