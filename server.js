const express=require("express"),path=require("path"),app=express();
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"dist")));
app.post("/api/claude",async(req,res)=>{
  const k=process.env.ANTHROPIC_API_KEY;
  if(!k)return res.status(500).json({error:"ANTHROPIC_API_KEY not set"});
  try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01"},body:JSON.stringify(req.body)});res.json(await r.json());}
  catch(e){res.status(500).json({error:e.message});}
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"dist","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("running"));
