export const vehicleNames={LIGHT:'Xe 2 ngựa · LIGHT',MEDIUM:'Xe 6 ngựa · MEDIUM',HEAVY:'Xe 9 ngựa · HEAVY'};
export const vehicleOptions = [
{capacity:2,vehicleClass:'LIGHT',label:vehicleNames.LIGHT},
{capacity:4,vehicleClass:'MEDIUM',label:'Xe 4 ngựa · MEDIUM'},
{capacity:6,vehicleClass:'MEDIUM',label:vehicleNames.MEDIUM},
{capacity:9,vehicleClass:'HEAVY',label:vehicleNames.HEAVY},
] as const;
export function vehicleLabel(b:{vehicleClass?:string;vehicleCapacity?:number}|null|undefined){return vehicleOptions.find(v=>v.vehicleClass===b?.vehicleClass&&v.capacity===b?.vehicleCapacity)?.label||vehicleNames[b?.vehicleClass as keyof typeof vehicleNames]||'Chưa chọn';}
