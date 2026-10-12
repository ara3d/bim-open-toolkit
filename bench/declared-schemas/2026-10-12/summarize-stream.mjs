import {readFileSync} from 'node:fs';
const ev=readFileSync(process.argv[2],'utf8').split('\n').filter(Boolean).map(JSON.parse);
let i=0;for(const e of ev){
 if(e.type==='assistant')for(const c of e.message.content){if(c.type==='tool_use'){console.log(++i,c.name.replace('mcp__bimopenflow-duckdb__',''),JSON.stringify(c.input).slice(0,200));}else if(c.type==='text')console.log('TEXT',c.text.slice(0,1200));}
 if(e.type==='result')console.log('RESULT',e.subtype,'ms',e.duration_ms,'api',e.duration_api_ms,'turns',e.num_turns,'cost',e.total_cost_usd,JSON.stringify(e.usage),'\n',e.result);
}
