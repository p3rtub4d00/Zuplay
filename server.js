import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();
const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.static('public'));
app.get('/health',(_req,res)=>res.json({ok:true,service:'zuplay'}));
app.get('/api/search',async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,120);
 if(!q)return res.status(400).json({error:'Informe uma busca'});
 if(!process.env.YOUTUBE_API_KEY)return res.status(503).json({error:'Configure YOUTUBE_API_KEY no Render para habilitar a pesquisa.'});
 try{
  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.search=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'18',q,key:process.env.YOUTUBE_API_KEY});
  const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(!response.ok)return res.status(response.status).json({error:data.error?.message||'Falha na busca'});
  res.json({items:(data.items||[]).map(x=>({id:x.id.videoId,title:x.snippet.title,channel:x.snippet.channelTitle,thumbnail:x.snippet.thumbnails?.medium?.url||'',description:x.snippet.description}))});
 }catch(e){res.status(502).json({error:'Não foi possível consultar o YouTube agora.'})}
});
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('ZUPLAY iniciado'));
