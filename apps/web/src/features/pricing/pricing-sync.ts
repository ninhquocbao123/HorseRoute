const key='wdp:pricing-published';
export function notifyPricingPublished(){
 window.dispatchEvent(new Event(key));
 try{localStorage.setItem(key,`${Date.now()}:${Math.random()}`);}catch{/* Focus and interval refresh remain available. */}
}
export function onPricingPublished(refresh:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===key)refresh();};
 window.addEventListener(key,refresh);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(key,refresh);window.removeEventListener('storage',storage);};
}
