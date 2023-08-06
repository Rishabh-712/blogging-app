const express =require('express');
const cors=require('cors');
const mongoose = require('mongoose');
const User=require('./models/user');
var bcrypt = require('bcryptjs');
const jwt=require('jsonwebtoken');
const cookieParser=require('cookie-parser');
const multer  = require('multer');
const fs=require('fs');
const Post=require('./models/post');
const dotenv=require('dotenv');

dotenv.config({path:"./.env"});

const DB=process.env.DATABASE;
const CLIENT=process.env.CLIENTURL;

const uploadMiddleware = multer({ dest: './uploads/' });

const secret="adddfefeegrnnkkfknkefeef";

const app=express();

var salt = bcrypt.genSaltSync(10);

app.use(cors({credentials:true,origin:CLIENT}));
app.use("*",cors({
    origin:true,
    credentials:true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));


    mongoose.connect(DB,{
        useNewUrlParser:true,
        useUnifiedTopology:true,
    }).then(()=>{
        console.log("Database connected successfully");
    }).catch((err)=>{
        console.log("Error while connecting with database",err.message);
    })


app.post('/register',async(req,res)=>{
    const {email,password}=req.body;
    try{
        const userDoc=await User.create({email,password:bcrypt.hashSync(password, salt)});
        res.json(userDoc);
    }catch(e){
        res.status(400).json(e);
    }  
    
});
/////////////////////////////////////////////////////////////////

app.post('/login',async(req,res)=>{
    const {email,password}=req.body;

    const userDoc=await User.findOne({email});
    if(userDoc!=null){

        const passCheck=bcrypt.compareSync(password, userDoc.password);
        
        if(passCheck){
            //logged in
            jwt.sign({email,id:userDoc._id},secret,{expiresIn: '72h'},(err,token)=>{
                if(err) console.log(err);
                // res.cookie('token',token,{httpOnly:true});
                // res.setHeader('Set-Cookie' ,`token=${token}`);
                // res.cookie('token', token, { domain: 'https://the-saint-blogging.onrender.com'});
                res.json({id:userDoc._id,email,token});
            }); 

        }else {
            res.status(400).json('wrong credentials');
    }
        
    }else{
        res.status(400).json('wrong credentials');
    }   

});

//////////////////////////////////////////////////////////////////////

app.get('/profile',(req,res)=>{
    const {token}=req.cookie;
    console.log(token);
    if(typeof token ==='undefined'){

        res.json({});

    }else{

        jwt.verify(token,secret,(err,info)=>{
            if(err){
                console.log('Error can not verify token');
                res.sendStatus(403);
            }else{
                res.json(info);
            }
            
        });

    }
    

});

////////////////////////////////////////////////////////////////////////

app.post('/logout',(req,res)=>{

    res.cookie('token','').json('ok');
});

app.post('/post',uploadMiddleware.single('file'), async(req,res)=>{
    const {originalname,path}=req.file;
    const parts=originalname.split('.');
    const ext=parts[parts.length -1];
    let newPath="";
    newPath=path+'.'+ext;
    fs.renameSync(path,newPath);  

    const {token}=req.body;
    if(typeof token ==='undefined'){

        res.json({ tok: 'false' });

    }else{

        jwt.verify(token,secret,async(err,info)=>{
            if(err)throw err;
            const {title,summary,content}=req.body;
    
            const postDoc=await Post.insertOne({
                title,
                summary,
                content,
                cover:newPath,
                email:info.id,
            }); 
    
            res.json(postDoc);
    
        });

    }
    
    

    
    
});

app.put('/post',uploadMiddleware.single('file'),async(req,res)=>{
    let newPath=null;
    if(req.file){
        const {originalname,path}=req.file;
        const parts=originalname.split('.');
        const ext=parts[parts.length -1];
        const newPath=path+'.'+ext;
        fs.renameSync(path,newPath); 
    }
    const {token}=req.body;

    if(typeof token ==='undefined'){
        res.json({ tok: 'false' });
        console.log("updating is not allowed");
    }else{

        jwt.verify(token,secret,{},async(err,info)=>{

            if(err) throw err;
    
            const {id,title,summary,content}=req.body;
            const postDoc=await Post.findById(id);
            const isAuthor=JSON.stringify(postDoc.email)===JSON.stringify(info.id); 
            if(!isAuthor){
               return res.status(400).json("You are not the author");
            }
            await postDoc.updateOne({
                title,summary,content,cover:newPath?newPath:postDoc.cover,
            });
    
            res.json(postDoc);
    
        });

    }
     
    

});


app.get('/post',async(req,res)=>{
    res.json(await Post.find().populate('email',['email']).sort({createdAt:-1}).limit(20));
})
//////////////////////////////////////////////////////////

app.get('/post/:id',async(req,res)=>{
    const {id}=req.params;
    // console.log(id);
    const postDoc=await Post.findById(id);
    res.json(postDoc);

});

const PORT=8000|process.env.PORT;

app.listen(PORT,()=>{
    console.log("server running on port 8000");
});
