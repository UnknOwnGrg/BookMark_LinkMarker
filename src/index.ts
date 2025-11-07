import 'dotenv/config';
import express from 'express';
import { ContentModel, ShareModel, TagModel, UserModel } from './db.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { JWT_PASSWORD } from './config.js';
import { z } from 'zod';
import { userMiddleware } from './middleware.js';
import { random } from './utils.js';

// Zod schemas for input validation
const userSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username cannot exceed 50 characters')
        .trim(),
    password: z.string()
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password cannot exceed 100 characters')
});

const contentSchema = z.object({
    title: z.string()
        .min(1, 'Title is required')
        .max(200, 'Title cannot exceed 200 characters')
        .trim(),
    link: z.string()
        .max(2000, 'URL cannot exceed 2000 characters')
});


const app = express(); 
app.use(express.json()); 

//Signin Done
app.post("/signin", async (req, res) => {
    try {
        // Validate input using Zod schema
        const validatedData = userSchema.parse(req.body);
        
        // Check if user already exists
        const existingUser = await UserModel.findOne({ 
            username: validatedData.username 
        });
        
        if (existingUser) {
            return res.status(409).json({
                status: "error",
                message: "Username already exists"
            });
        }

        // Create new user with validated data
        await UserModel.create({
            username: validatedData.username,
            password: validatedData.password
        });

        res.status(201).json({
            status: "success",
            message: "User created successfully"
        });

    } catch (error) {
    

        console.error("Signin error:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

//Login Done
app.post("/login", async (req, res) => {
    try {
        // Validate input using Zod schema
        const validatedData = userSchema.parse(req.body);

        // Find user
        const user = await UserModel.findOne({ 
            username: validatedData.username 
        });
        
        if (!user) {
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials"
            });
        }

        // Verify password
        const isValidPassword = await user.comparePassword(validatedData.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials"
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            JWT_PASSWORD as string,
            { expiresIn: '24h' }
        );

        res.json({
            status: "success",
            message: "Login successful",
            token
        });

    } catch (error) {

        console.error("Login error:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

//Adding the Content for User
app.post("/content", userMiddleware, async(req, res)=>{
    try {
        // Validate input using Zod schema
        const validatedData = contentSchema.parse(req.body);

        // Create content directly - no need to find user first
        const content = await ContentModel.create({
            title: validatedData.title, 
            link: validatedData.link, 
            tags: [], 
            userId: req.userId 
        });

        res.status(201).json({
            status: "success",
            message: "Content added successfully",
            data: content
        });
       
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: "error",
                message: "Validation failed",
                errors: error.issues
            });
        }
        
        console.error("Content creation error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to add content"
        });
    }
}); 

app.get("/content", userMiddleware, async (req, res) => {
    try {
        // Find ALL content for this user, not just one
        const contents = await ContentModel.find({
            userId: req.userId  // Correct field name
        }).populate("userId", "username").populate("tags", "name color"); 

        res.json({
            status: "success",
            data: contents
        });
    } catch (error) {
        console.error("Get content error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch content"
        });
    }
}); 

app.delete("/content", userMiddleware, async (req, res) => {
    try {
        const { contentId } = req.body;
        
        if (!contentId) {
            return res.status(400).json({
                status: "error",
                message: "Content ID is required"
            });
        }

        // Delete specific content that belongs to this user
        const deletedContent = await ContentModel.findOneAndDelete({
            _id: contentId,
            userId: req.userId  // Ensure user can only delete their own content
        });

        if (!deletedContent) {
            return res.status(404).json({
                status: "error",
                message: "Content not found or you don't have permission to delete it"
            });
        }

        res.json({
            status: "success",
            message: "Content deleted successfully"
        });
    } catch (error) {
        console.error("Delete content error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to delete content"
        });
    }
});

//To Share
app.post("/brain/share", userMiddleware, async (req, res) => {
    try {
        const { share } = req.body;
        
        if (share) {
            // Enable sharing
            const existingLink = await ShareModel.findOne({
                userId: req.userId
            });

            if (existingLink) {
                return res.json({
                    status: "success",
                    hash: existingLink.hash
                });
            }

            // Create new share link
            const hash = random(10);
            await ShareModel.create({
                userId: req.userId,
                hash: hash
            });

            res.json({
                status: "success",
                hash,
                message: "Share link created"
            });
        } else {
            // Disable sharing
            await ShareModel.deleteOne({
                userId: req.userId
            });

            res.json({
                status: "success",
                message: "Share link removed"
            });
        }
    } catch (error) {
        console.error("Share error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to process share request"
        });
    }
});

app.get("/brain/:shareLink", async (req, res) => {
    try {
        const hash = req.params.shareLink;
        
        // Find the share record (no authentication needed for public access)
        const link = await ShareModel.findOne({ hash });

        if (!link) {
            return res.status(404).json({
                status: "error",
                message: "Share link not found"
            });
        }

        // Get user's content
        const content = await ContentModel.find({
            userId: link.userId
        }).populate("tags", "name color");
        
        // Get user info
        const user = await UserModel.findOne({
            _id: link.userId
        });

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }

        res.json({
            status: "success",
            data: {
                username: user.username,
                content: content,
                sharedAt: link.createdAt
            }
        });
    } catch (error) {
        console.error("Get shared content error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch shared content"
        });
    }
});


async function main(){
   if(!process.env.MONGODB_URL){
    throw new Error("MongoDB Connection string is required");
   }

   try{
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to MongoDB"); 

    app.listen(process.env.PORT, ()=> console.log("Connected to PORT : "+process.env.PORT)); 
   }catch(error){
    console.log("Failed to connect to MongoDB", error);
    process.exit(1);
   }
}

main();