import './workflow.css';
export function WorkflowIntro({number,title,description,steps}:{number:string;title:string;description:string;steps:string[]}){
 return <header className="flow-intro"><div className="flow-intro-copy"><span className="flow-kicker">QUY TRÌNH {number}</span><h2>{title}</h2><p>{description}</p></div><ol className="flow-steps" aria-label="Các bước trong quy trình">{steps.map((step,i)=><li key={step}><span>{String(i+1).padStart(2,'0')}</span>{step}</li>)}</ol></header>;
}
export function FlowSection({number,title,description}:{number:string;title:string;description?:string}){
 return <div className="flow-section-heading"><span>{number}</span><div><h3>{title}</h3>{description&&<p>{description}</p>}</div></div>;
}
