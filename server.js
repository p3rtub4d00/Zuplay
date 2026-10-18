import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import youtubeSearchApi from 'youtube-search-api';
dotenv.config();
const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.static('public'));
app.get('/health',(_req,res)=>res.json({ok:true,service:'zuplay'}));
app.get('/api/search',async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,120);
 if(!q)return res.status(400).json({error:'Informe uma busca'});
 try{
  const result=await youtubeSearchApi.GetListByKeyword(q,false,18);
  const items=(result.items||[]).filter(x=>x.id&&x.title&&x.type!=='channel'&&x.type!=='playlist').map(x=>({
   id:typeof x.id==='string'?x.id:x.id.videoId,
   title:x.title,
   channel:x.channel?.name||x.channel?.title||'YouTube',
   thumbnail:x.thumbnail?.thumbnails?.[0]?.url||x.thumbnail?.url||'',
   description:x.description||''
  })).filter(x=>typeof x.id==='string'&&/^[a-zA-Z0-9_-]{11}$/.test(x.id));
  res.json({items});
 }catch(e){console.error('[YouTube search]',e.message);res.status(502).json({error:'Não foi possível consultar o YouTube agora.'})}
});

app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('ZUPLAY iniciado'));
