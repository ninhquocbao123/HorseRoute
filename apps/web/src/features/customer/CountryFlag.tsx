const star='0,-10 2.35,-3.24 9.51,-3.09 3.8,1.24 5.88,8.09 0,4 -5.88,8.09 -3.8,1.24 -9.51,-3.09 -2.35,-3.24';

/** Inline flags also render on Windows systems without flag emoji fonts. */
export default function CountryFlag({country}:{country:string}){
  return <svg className="bc-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
    {country==='TH'?<><path fill="#a51931" d="M0 0h30v20H0z"/><path fill="#fff" d="M0 3.33h30v13.34H0z"/><path fill="#2d2a4a" d="M0 6.67h30v6.66H0z"/></>:<>
      <path fill={country==='CN'?'#de2910':'#da251d'} d="M0 0h30v20H0z"/>
      {country==='VN'?<polygon points={star} transform="translate(15 10) scale(.65)" fill="#ffdf00"/>:<g fill="#ffde00"><polygon points={star} transform="translate(5 5) scale(.3)"/>{[[10,2,23],[12,4,46],[12,7,69],[10,9,20]].map(([x,y,angle])=><polygon key={y} points={star} transform={`translate(${x} ${y}) rotate(${angle}) scale(.1)`}/>)}</g>}
    </>}
  </svg>;
}
