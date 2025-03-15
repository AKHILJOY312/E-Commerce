const mongoose=require('mongoose');

const userSchema = new mongoose.Schema({
    name:{ type:String, required:true},
    email:{ type:String,required:true,unique:true},
    password:{ type: String, required:true},
    phone:{ type:String},
    isAdmin: { type : Boolean, default:false},
    isActive:{ type:Boolean, default: Date.now },
    created_at :{ type:Date, default:Date.now},
    updated_at :{ type: Date, default: Date.now}

});

module.exports = mongoose.model('User',userSchema);