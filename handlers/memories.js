const {db}=require("../utility/admin");

exports.getAllMemories=(req,res)=> {
  db.collection('memories').orderBy("createdAt","desc").get().then(data=>{
let memories=[];
    data.forEach(doc=>{
      memories.push({
        memoryId:doc.id,
        body:doc.data().body,
        userName:doc.data().userName,
        createdAt:doc.data().createdAt,
        commentCount:doc.data().commentCount,
        likeCount:doc.data().likeCount,
        userImage:doc.data().userImage
      });
    });
    return res.json(memories);
  })
  .catch((err)=>console.error(err));
};

exports.postOneMemory=(req,res)=>{
if(req.body.body.trim()===''){
  return res.status(400).json({body:"Body must not be empty"});
}
  const newMemory={
    body:req.body.body,
    userImage:req.user.imageUrl,
    userName:req.user.handle,
    createdAt:new Date().toISOString(),
    likeCount:0,
    commentCount:0
  };
db.collection('memories').add(newMemory).then(doc=>{
  const resMemory=newMemory;
  resMemory.memoryId=doc.id;
     res.json(resMemory);
  })
  .catch((err)=>{
    res.status(500).json({error:'something went wrong'});
    console.error(err);
  });
};
exports.getMemory=(req,res)=>{
  let memoryData={};
  db.doc(`/memories/${req.params.memoryId}`).get()
  .then((doc)=>{
    if(!doc.exists){
      return res.status(404).json({error:"Memory not found"});
    }
    memoryData=doc.data();
    memoryData.memoryId=doc.id;
    return db.collection("comments").orderBy("createdAt","desc").where("memoryId","==",req.params.memoryId).get();
  })
  .then((data)=>{
    memoryData.comments=[];
    data.forEach(doc=>{
      memoryData.comments.push(doc.data());
    });
    return res.json(memoryData);
  })
  .catch((err)=>{
    console.error(err);
    res.status(500).json({error:err.code});
  });
};
// Comment on a comments
exports.commentOnMemory=(req,res)=>{
  if(req.body.body.trim()==='')
  return res.status(400).json({comment:"Comment must not be empty"});
  const newComment={
    body:req.body.body,
    createdAt:new Date().toISOString(),
    memoryId:req.params.memoryId,
    userName:req.user.handle,
    userImage:req.user.imageUrl
  };
  db.doc(`/memories/${req.params.memoryId}`).get()
  .then(doc=>{
    if(!doc.exists){
      return res.status(404).json({error:"Memory not found"});
    }
    return doc.ref.update({commentCount:doc.data().commentCount+1});
  })
  .then(()=>{
    return db.collection("comments").add(newComment);
  })
  .then(()=>{
    res.json(newComment);
  })
  .catch(err=>{
    connsole.error(err);
    res.status(500).json({error:"Something went wrong"});
  });
};

exports.likeMemory=(req,res)=>{
  const likeDocument=db.collection("likes").where("userName","==",req.user.handle)
  .where("memoryId","==",req.params.memoryId).limit(1);
  const memoryDocument=db.doc(`/memories/${req.params.memoryId}`);

  let memoryData;
  memoryDocument.get()
  .then(doc=>{
    if(doc.exists){
      memoryData=doc.data();
      memoryData.memoryId=doc.id;
      return likeDocument.get();
    }else{
      return res.status(404).json({error:"Memory not found"});
    }
  })
  .then(data=>{
    if(data.empty){
      return db.collection("likes").add({
        memoryId:req.params.memoryId,
        userName:req.user.handle
      })
      .then(()=>{
        memoryData.likeCount++;
        return memoryDocument.update({likeCount:memoryData.likeCount});
      })
      .then(()=>{
        return res.json(memoryData);
      });
    }else{
      return res.status(400).json({error:"Memory already liked"});
    }
  })
  .catch(err=>{
    console.error(err);
    res.status(500).json({error:err.code});
  });
};
exports.unlikeMemory=(req,res)=>{
  const likeDocument=db.collection("likes").where("userName","==",req.user.handle)
  .where("memoryId","==",req.params.memoryId).limit(1);
  const memoryDocument=db.doc(`/memories/${req.params.memoryId}`);
  let memoryData;
  memoryDocument.get()
  .then(doc=>{
    if(doc.exists){
      memoryData=doc.data();
      memoryData.memoryId=doc.id;
      return likeDocument.get();
    }else{
      return res.status(404).json({error:"Memory not found"});
    }
  })
  .then(data=>{
    if(data.empty){
      return res.status(400).json({error:"Memory not liked"});

    }else{
      return db.doc(`/likes/${data.docs[0].id}`).delete()
      .then(()=>{
        memoryData.likeCount--;
        return memoryDocument.update({likeCount:memoryData.likeCount});
      })
      .then(()=>{
        res.json(memoryData);
      });
    }
  })
  .catch(err=>{
    console.error(err);
    res.status(500).json({error:err.code});
  });
};
exports.deleteMemory=(req,res)=>{
  const document=db.doc(`/memories/${req.params.memoryId}`);
  document.get()
  .then(doc=>{
    if(!doc.exists){
      return res.status(404).json({error:"Memory not found"});
    }
    if(doc.data().userName!==req.user.handle){
      res.status(403).json({error:"Unauthorized"});
    }else{
      return document.delete();
    }
  })
  .then(()=>{
    res.json({message:"Memory deleted successfully"});
  })
  .catch(err=>{
    console.error(err);
    return res.status(500).json({error:err.code});
  });
};
