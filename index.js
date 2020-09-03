const functions = require('firebase-functions');
const app=require("express")();
const FBAuth=require("./utility/fbAuth");

const cors=require("cors");
app.use(cors());
const {db}=require("./utility/admin");

const {
  getAllMemories,
  postOneMemory,
  getMemory,
  commentOnMemory,
  likeMemory,
  unlikeMemory,
  deleteMemory
}=require("./handlers/memories");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
}=require("./handlers/users");

//Memory route
app.get("/memories",getAllMemories);
app.post("/memory",FBAuth,postOneMemory);
app.get("/memory/:memoryId",getMemory);
app.post("/memory/:memoryId/comment",FBAuth,commentOnMemory);
app.get("/memory/:memoryId/like",FBAuth,likeMemory);
app.get("/memory/:memoryId/unlike",FBAuth,unlikeMemory);
app.delete("/memory/:memoryId",FBAuth,deleteMemory);

//users route
app.post("/signup",signup);
app.post("/login",login);
app.post("/user/image",FBAuth,uploadImage);
app.post("/user",FBAuth,addUserDetails);
app.get("/user",FBAuth,getAuthenticatedUser);
app.get("/user/:handle",getUserDetails);
app.post("/notifications",FBAuth,markNotificationsRead);

exports.api=functions.region("us-central1").https.onRequest(app);

exports.createNotificationOnLike=functions.region("us-central1").firestore.document(`likes/{id}`)
.onCreate((snapshot)=>{
  return db.doc(`/memories/${snapshot.data().memoryId}`).get()
  .then((doc)=>{
    if(doc.exists && doc.data().userName!==snapshot.data().userName){
      return db.doc(`/notifications/${snapshot.id}`).set({
        createdAt:new Date().toISOString(),
        recipient:doc.data().userName,
        sender:snapshot.data().userName,
        type:"like",
        read:false,
        memoryId:doc.id
      });
    }
  })

  .catch(err=>{
    console.error(err);
  });
});
exports.deleteNotificationOnUnlike=functions.region("us-central1").firestore.document(`likes/{id}`)
.onDelete((snapshot)=>{
  return db.doc(`/notifications/${snapshot.id}`)
  .delete()
  .catch(err=>{
    console.error(err);
    return;
  });
});
exports.createNotificationOnComment=functions.region("us-central1").firestore.document(`comments/{id}`)
.onCreate((snapshot)=>{
  return db.doc(`/memories/${snapshot.data().memoryId}`).get()
  .then(doc=>{
    if(doc.exists && doc.data().userName!==snapshot.data().userName){
      return db.doc(`/notifications/${snapshot.id}`).set({
        createdAt:new Date().toISOString(),
        recipient:doc.data().userName,
        sender:snapshot.data().userName,
        type:"comment",
        read:false,
        memoryId:doc.id
      });
    }
  })

  .catch(err=>{
    console.error(err);
    return;
  });
});
exports.onUserImageChange=functions.region("us-central1").firestore.document(`/users/{userId}`)
.onUpdate((change)=>{
  console.log(change.before.data());
    console.log(change.after.data());
    if(change.before.data().imageUrl!==change.after.data().imageUrl){
console.log("Image has changed");
      const batch=db.batch();
      return db.collection("memories").where("userName","==",change.before.data().handle).get()
      .then(data=>{
        data.forEach(doc=>{
          const memory=db.doc(`/memories/${doc.id}`);
          batch.update(memory,{userImage:change.after.data().imageUrl});
        });
        return batch.commit();
      });
    }else{
      return true;
    }
});
exports.onMemoryDelete=functions.region("us-central1").firestore.document(`/memories/{memoryId}`)
.onDelete((snapshot,context)=>{
  const memoryId=context.params.memoryId;
  const batch=db.batch();
  return db.collection("comments").where("memoryId","==",memoryId).get()
  .then(data=>{
    data.forEach(doc=>{
      batch.delete(db.doc(`/comments/${doc.id}`));
    });
    return db.collection("likes").where("memoryId","==",memoryId).get();
  })
  .then(data=>{
    data.forEach(doc=>{
      batch.delete(db.doc(`/likes/${doc.id}`));
    });
    return db.collection("notifications").where("memoryId","==",memoryId).get();
  })
  .then(data=>{
    data.forEach(doc=>{
      batch.delete(db.doc(`/notifications/${doc.id}`));
    });
    return batch.commit();
  })
  .catch(err=>{
    console.error(err);
  });
});
