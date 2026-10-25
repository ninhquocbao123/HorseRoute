import type { PricingConfig, EstimateInput, PriceEstimate } from '@my-project/shared';
export function initializeLanding(root:HTMLElement,onNavigate:(path:string)=>void,onLookup:(code:string,phone:string)=>Promise<{message:string;step:number}>,priceBook:{id:string;title:string;config:PricingConfig}|null,calculate:(input:EstimateInput)=>PriceEstimate):()=>void;
