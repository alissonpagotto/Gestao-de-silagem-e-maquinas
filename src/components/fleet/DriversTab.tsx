import React from 'react';
import { FleetDriversView, FleetDriversViewProps } from './FleetDriversView';

export type DriversTabProps = FleetDriversViewProps;

export const DriversTab: React.FC<DriversTabProps> = (props) => {
  return <FleetDriversView {...props} />;
};

export default DriversTab;
