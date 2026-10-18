import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import youtubeSearchApi from 'youtube-search-api';

dotenv.config();

const app=express();
const PORT=process.env.PORT||3000;
const MONGO_URI=String(process.env.MONGO_URI||'').trim();
const PUBLIC_URL=String(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const SESSION_SECRET=process.env.SESSION_SECRET||'zuplay-dev-only-change-me';
const isProd=process.env.NODE_ENV==='production'||Boolean(process.env.RENDER);

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'}));

let mongoReady=false;
if(MONGO_URI){
  mongoose.connect(MONGO_URI).then(()=>{
    mongoReady=true;
    console.log('[MongoDB] conectado');
  }).catch(err=>console.error('[MongoDB]',err.message));
}else{
  console.warn('[MongoDB] MONGO_URI não configurada; login e sincronização ficam desativados.');
}
if(isProd&&SESSION_SECRET==='zuplay-dev-only-change-me'){
  console.warn('[Auth] Configure SESSION_SECRET no ambiente de produção.');
}

const sessionConfig={
  secret:SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  proxy:true,
  cookie:{
    httpOnly:true,
    secure:isProd,
    sameSite:'lax',
    maxAge:1000*60*60*24*30
  }
};
if(MONGO_URI){
  sessionConfig.store=MongoStore.create({
    mongoUrl:MONGO_URI,
    collectionName:'sessions',
    ttl:60*60*24*30,
    autoRemove:'native'
  });
}
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

const userSchema=new mongoose.Schema({
  provider:{type:String,required:true,enum:['google','facebook']},
  providerId:{type:String,required:true},
  email:{type:String,default:''},
  displayName:{type:String,default:''},
  avatar:{type:String,default:''},
  lastLoginAt:{type:Date,default:Date.now}
},{timestamps:true});
userSchema.index({provider:1,providerId:1},{unique:true});
const User=mongoose.models.User||mongoose.model('User',userSchema);

const appDataSchema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,required:true,unique:true,index:true},
  favorites:{type:Array,default:[]},
  history:{type:Array,default:[]},
  playlists:{type:mongoose.Schema.Types.Mixed,default:{}},
  taste:{type:mongoose.Schema.Types.Mixed,default:{}},
  settings:{type:mongoose.Schema.Types.Mixed,default:{}}
},{timestamps:true,minimize:false});
const AppData=mongoose.models.AppData||mongoose.model('AppData',appDataSchema);

function providerProfile(provider,profile){
  return {
    provider,
    providerId:String(profile.id),
    email:String(profile.emails?.[0]?.value||'').slice(0,254),
    displayName:String(profile.displayName||profile.username||'Usuário ZUPLAY').slice(0,120),
    avatar:String(profile.photos?.[0]?.value||'').slice(0,1000),
    lastLoginAt:new Date()
  };
}
async function findOrCreateUser(provider,profile,done){
  try{
    if(!mongoReady)return done(new Error('MongoDB indisponível'));
    const data=providerProfile(provider,profile);
    const user=await User.findOneAndUpdate(
      {provider:data.provider,providerId:data.providerId},
      {$set:data},
      {new:true,upsert:true,setDefaultsOnInsert:true}
    );
    done(null,user);
  }catch(err){done(err)}
}
passport.serializeUser((user,done)=>done(null,String(user._id)));
passport.deserializeUser(async(id,done)=>{
  try{
    if(!mongoReady)return done(null,false);
    done(null,await User.findById(id));
  }catch(err){done(err)}
});

const googleEnabled=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&MONGO_URI);
if(googleEnabled){
  passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:`${PUBLIC_URL}/auth/google/callback`,
    state:true
  },(_access,_refresh,profile,done)=>findOrCreateUser('google',profile,done)));
}

const facebookEnabled=Boolean(process.env.FACEBOOK_APP_ID&&process.env.FACEBOOK_APP_SECRET&&MONGO_URI);
if(facebookEnabled){
  passport.use(new FacebookStrategy({
    clientID:process.env.FACEBOOK_APP_ID,
    clientSecret:process.env.FACEBOOK_APP_SECRET,
    callbackURL:`${PUBLIC_URL}/auth/facebook/callback`,
    profileFields:['id','displayName','photos','email'],
    state:true
  },(_access,_refresh,profile,done)=>findOrCreateUser('facebook',profile,done)));
}

function requireAuth(req,res,next){
  if(req.isAuthenticated?.()&&req.user)return next();
  res.status(401).json({error:'Faça login para sincronizar seus dados.'});
}
function cleanVideo(v){
  if(!v||typeof v!=='object')return null;
  const id=String(v.id||'');
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))return null;
  return {
    id,
    title:String(v.title||'').slice(0,240),
    channel:String(v.channel||'YouTube').slice(0,160),
    thumbnail:String(v.thumbnail||'').slice(0,1000),
    description:String(v.description||'').slice(0,1000)
  };
}
function cleanList(value,max){
  return (Array.isArray(value)?value:[]).map(cleanVideo).filter(Boolean).slice(0,max);
}
function cleanPlaylists(value){
  const out={};
  if(!value||typeof value!=='object')return out;
  for(const [rawName,raw] of Object.entries(value).slice(0,80)){
    const name=String(raw?.name||rawName).trim().slice(0,60);
    if(!name)continue;
    out[name]={name,items:cleanList(Array.isArray(raw)?raw:raw?.items,500)};
  }
  return out;
}
function cleanTaste(value){
  const out={};
  if(!value||typeof value!=='object')return out;
  for(const [k,v] of Object.entries(value).slice(0,40)){
    const n=Number(v);
    if(Number.isFinite(n)&&n>=0)out[String(k).slice(0,40)]=Math.min(Math.floor(n),1_000_000);
  }
  return out;
}

app.get('/health',(_req,res)=>res.json({
  ok:true,
  service:'zuplay',
  mongo:mongoReady,
  auth:{google:googleEnabled,facebook:facebookEnabled}
}));

app.get('/api/auth/providers',(_req,res)=>res.json({google:googleEnabled,facebook:facebookEnabled}));
app.get('/api/me',async(req,res)=>{
  if(!req.user)return res.json({authenticated:false,user:null,data:null});
  const data=mongoReady?await AppData.findOne({userId:req.user._id}).lean():null;
  res.json({
    authenticated:true,
    user:{id:String(req.user._id),name:req.user.displayName,email:req.user.email,avatar:req.user.avatar,provider:req.user.provider},
    data:data?{favorites:data.favorites||[],history:data.history||[],playlists:data.playlists||{},taste:data.taste||{},settings:data.settings||{}}:null
  });
});

app.get('/auth/google',(req,res,next)=>{
  if(!googleEnabled)return res.status(503).send('Login com Google ainda não foi configurado.');
  passport.authenticate('google',{scope:['profile','email']})(req,res,next);
});
app.get('/auth/google/callback',
  (req,res,next)=>googleEnabled?passport.authenticate('google',{failureRedirect:'/?login=error'})(req,res,next):res.redirect('/?login=disabled'),
  (_req,res)=>res.redirect('/?login=success')
);

app.get('/auth/facebook',(req,res,next)=>{
  if(!facebookEnabled)return res.status(503).send('Login com Facebook ainda não foi configurado.');
  passport.authenticate('facebook',{scope:['email']})(req,res,next);
});
app.get('/auth/facebook/callback',
  (req,res,next)=>facebookEnabled?passport.authenticate('facebook',{failureRedirect:'/?login=error'})(req,res,next):res.redirect('/?login=disabled'),
  (_req,res)=>res.redirect('/?login=success')
);

app.post('/api/logout',(req,res,next)=>{
  req.logout(err=>{
    if(err)return next(err);
    req.session.destroy(()=>res.json({ok:true}));
  });
});

app.get('/api/user-data',requireAuth,async(req,res)=>{
  if(!mongoReady)return res.status(503).json({error:'Banco de dados indisponível.'});
  const data=await AppData.findOne({userId:req.user._id}).lean();
  res.json({data:data?{
    favorites:data.favorites||[],
    history:data.history||[],
    playlists:data.playlists||{},
    taste:data.taste||{},
    settings:data.settings||{}
  }:null});
});

app.put('/api/user-data',requireAuth,async(req,res)=>{
  if(!mongoReady)return res.status(503).json({error:'Banco de dados indisponível.'});
  const body=req.body||{};
  const data={
    favorites:cleanList(body.favorites,1000),
    history:cleanList(body.history,1000),
    playlists:cleanPlaylists(body.playlists),
    taste:cleanTaste(body.taste),
    settings:{
      shuffle:Boolean(body.settings?.shuffle),
      repeat:['off','all','one'].includes(body.settings?.repeat)?body.settings.repeat:'off'
    }
  };
  await AppData.findOneAndUpdate({userId:req.user._id},{$set:data},{upsert:true,new:true,setDefaultsOnInsert:true});
  res.json({ok:true});
});

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

app.use(express.static('public'));

app.use((err,_req,res,_next)=>{
  console.error('[Servidor]',err);
  res.status(500).json({error:'Erro interno do servidor.'});
});

app.listen(PORT,'0.0.0.0',()=>console.log(`ZUPLAY iniciado em ${PORT}`));
