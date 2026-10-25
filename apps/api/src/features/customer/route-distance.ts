import { z } from 'zod';
import { BadRequestException, ServiceUnavailableException } from '../../shared/core/error.response';
const point = z.object({ country:z.enum(['VN','CN','TH']), city:z.string().trim().min(1).max(100), ward:z.string().trim().max(100) }).strict();
export const routeDistanceSchema = z.object({ from:point, to:point }).strict();
type Point = z.infer<typeof point>;
type JsonRequest = (url:string) => Promise<any>;
let queue = Promise.resolve();
let lastRequest = 0;
let queued = 0;
const request:JsonRequest = url => {
  if(queued>=20)return Promise.reject(new Error('Map queue full'));
  queued++;
  const work = queue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequest))));
    lastRequest = Date.now();
    const response = await fetch(url, { signal:AbortSignal.timeout(10000), headers:{'User-Agent':'HorseTransport/1.0 route-estimates'} });
    if (!response.ok) throw new Error('Map service unavailable');
    return response.json();
  }).finally(()=>{queued--;});
  queue = work.then(() => undefined, () => undefined);
  return work;
};
const nativeName = (name:string) => name.split(' / ').map(part => part.split(' · ').slice(-1)[0]).join(', ').replace(/\s*\([^)]*\)/g,'').replace(/^(Tỉnh|Thành phố|Phường|Xã)\s+/i,'');
const normalized = (name:string) => nativeName(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/^(tinh|thanh pho|phuong|xa)\s+/,'').replace(/\s/g,'');
export class RouteDistanceService {
  private cache = new Map<string,{until:number;value:any}>();
  private pending = new Map<string,Promise<any>>();
  constructor(private get:JsonRequest = request) {}
  private async cached(key:string, work:()=>Promise<any>) {
    const entry=this.cache.get(key);
    if(entry&&entry.until>Date.now())return entry.value;
    if(this.pending.has(key))return this.pending.get(key)!;
    const pending=work().then(value=>{if(this.cache.size>=1000)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,{value,until:Date.now()+86400000});return value;}).finally(()=>this.pending.delete(key));
    this.pending.set(key,pending);return pending;
  }
  private locate(p:Point) {
    return this.cached('point:'+JSON.stringify(p),async()=>{
      for(const local of p.ward?[true,false]:[false]) {
        const url=new URL('/api/',process.env.ROUTE_GEOCODER_URL||'https://photon.komoot.io');
        url.searchParams.set('q',[local?nativeName(p.ward):'',nativeName(p.city)].filter(Boolean).join(', '));
        url.searchParams.set('countrycode',p.country);url.searchParams.set('limit','5');
        const data=await this.get(url.toString());
        const match=data.features?.find((f:any)=>{
          const props=f.properties||{}, coordinates=f.geometry?.coordinates;
          const expected=normalized(local?p.ward.split(' / ').slice(-1)[0]:p.city);
          const region=normalized([props.state,props.city,props.county,props.name].filter(Boolean).join(' '));
          return props.osm_value!=='historic' && props.countrycode?.toUpperCase()===p.country && expected && normalized(props.name||'').includes(expected) && (!local||region.includes(normalized(p.city))) &&
            Array.isArray(coordinates)&&coordinates.length===2&&coordinates.every(Number.isFinite)&&Math.abs(coordinates[0])<=180&&Math.abs(coordinates[1])<=90;
        });
        if(match)return {coordinates:match.geometry.coordinates,precision:local?'ward':'city'};
      }
      throw new BadRequestException('Chưa xác định được khu vực trên bản đồ. Vui lòng kiểm tra tỉnh/thành và xã/phường.');
    });
  }
  async estimate(input:z.infer<typeof routeDistanceSchema>) {
    try {
      return await this.cached('route:'+JSON.stringify(input),async()=>{
        const from=await this.locate(input.from),to=await this.locate(input.to);
        if(from.coordinates.join(',')===to.coordinates.join(','))throw new BadRequestException('Hai điểm nằm trong cùng khu vực bản đồ; chưa đủ dữ liệu để ước tính quãng đường.');
        const url=new URL(`/route/v1/driving/${from.coordinates.join(',')};${to.coordinates.join(',')}`,process.env.ROUTE_ROUTER_URL||'https://router.project-osrm.org');
        url.searchParams.set('overview','false');url.searchParams.set('radiuses','5000;5000');
        const data=await this.get(url.toString()),distance=data.routes?.[0]?.distance;
        if(data.code!=='Ok'||!Number.isFinite(distance)||distance<=0||distance>10000000)throw new BadRequestException('Chưa tìm được tuyến đường bộ phù hợp giữa hai điểm.');
        return {distanceKm:Math.max(1,Math.round(distance/1000)),precision:from.precision==='ward'&&to.precision==='ward'?'ward':'city',source:'OpenStreetMap / OSRM'};
      });
    } catch(error) {
      if(error instanceof BadRequestException)throw error;
      throw new ServiceUnavailableException('Chưa kết nối được dịch vụ bản đồ. Vui lòng thử lại để tính quãng đường.');
    }
  }
}
