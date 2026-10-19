import { useRef } from 'react';
import { tripDetailTabs } from '../constants/trip-status.constants';
import type { TripDetailTab } from '../types/trip.types';

interface Props {
  activeTab: TripDetailTab;
  onTabChange: (tab: TripDetailTab) => void;
}

export default function TripDetailTabs({ activeTab, onTabChange }: Props) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="trip-tabs" role="tablist" aria-label="Chi tiết chuyến">
      {tripDetailTabs.map((tab, index) => (
        <button
          key={tab.id} ref={element => { buttons.current[index] = element; }}
          id={`trip-tab-${tab.id}`} type="button" role="tab"
          tabIndex={activeTab === tab.id ? 0 : -1}
          aria-selected={activeTab === tab.id}
          aria-controls={activeTab === tab.id ? `trip-tabpanel-${tab.id}` : undefined}
          className={`trip-tab${activeTab === tab.id ? ' trip-tab-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={event => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % tripDetailTabs.length;
            else if (event.key === 'ArrowLeft') next = (index + tripDetailTabs.length - 1) % tripDetailTabs.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tripDetailTabs.length - 1;
            else return;
            event.preventDefault();
            onTabChange(tripDetailTabs[next].id);
            buttons.current[next]?.focus();
          }}
        >{tab.label}</button>
      ))}
    </div>
  );
}
