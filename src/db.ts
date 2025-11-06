import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

interface IUser {
    username: string;
    password: string;
    //it has Used the Promise<boolean> because it is performing a asynchronous operation
    //so that's why the Promise<boolean> is used.
    comparePassword(candidatePassword: string): Promise<boolean>;
}

interface Content{
    title? : string;
    link : string;
    tags : mongoose.Types.ObjectId[]; // Array of ObjectIds referencing Tag
    userId : mongoose.Types.ObjectId; // ObjectId referencing User
}

interface ITag {
    name: string;
    color?: string;
}

const UserSchema = new mongoose.Schema<IUser>({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    }
});

const ContentSchema  = new mongoose.Schema<Content>({
    title : {
        type : String, 
        required : true ,
        unique : true, 
    }, 
    link : {
        type : String, 
        required : true
    }, 
    tags : [{ type : mongoose.Schema.Types.ObjectId , ref : 'Tag'}], 
    userId : { type : mongoose.Schema.Types.ObjectId , ref : 'User', required: true}
}); 

const TagSchema = new mongoose.Schema<ITag>({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    color: {
        type: String,
        default: '#007bff'
    }
}); 



// Hash password before saving
//It is the Middleware from the mongoose
UserSchema.pre('save', async function(next) {
    //If password is modified then it will again hash and then pass
    if (!this.isModified('password')) return next();

    //Just hashing the Password
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Method to compare password for login
// Simply it is a Parameterized function function comparePassword(pass : string) : Promise{};
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

export const UserModel = mongoose.model<IUser>('User', UserSchema);
export const ContentModel = mongoose.model<Content>('Content', ContentSchema);
export const TagModel = mongoose.model<ITag>('Tag', TagSchema);